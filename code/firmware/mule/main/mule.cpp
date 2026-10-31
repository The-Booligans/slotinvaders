// mule — M5Stack AtomS3R-CAM-M12 (ESP32-S3 + OV3660), on-device YOLO bike counter.
//
// On boot:
//   1. Join Wi-Fi (STA, 2.4 GHz).
//   2. Fetch per-device knobs from GET /api/v1/device/config so the report
//      cadence and confidence threshold can be tuned without reflashing.
//      Compile-time defaults are used if the fetch fails.
//   3. Power the camera on, init esp-camera for the AtomS3R-M12 pin map,
//      load the YOLO11n COCO detector.
//
// Then forever:
//   For every captured frame, run YOLO11 inference, count detections whose
//   category is "bicycle" (COCO class 1) and whose score is >= minScore.
//   Every reportIntervalMs the count is POSTed to the backend as a normal
//   reading:
//
//     POST ${API_BASE}/api/v1/readings
//     X-Api-Key: ${DEVICE_API_KEY}
//     Content-Type: application/json
//     { "occupied": N, "seq": SEQ, "fw": "...", "rssi": R }
//
//   Alongside the reading, the latest camera frame is JPEG-encoded and
//   uploaded to the debug app so operators can see what the camera sees
//   (same path as hydra and thor use):
//
//     POST ${API_BASE}/api/v1/debug/images
//     X-Api-Key: ${DEVICE_API_KEY}
//     Content-Type: image/jpeg
//     X-Seq: SEQ
//     <jpeg bytes>
//
// Only the integer count ever reaches the ingest endpoint. The debug image
// is held in memory on the Function App and never written to Cosmos.

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <algorithm>
#include <string>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/event_groups.h"

#include "esp_err.h"
#include "esp_log.h"
#include "esp_system.h"
#include "esp_timer.h"
#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_netif.h"
#include "esp_http_client.h"
#include "esp_crt_bundle.h"
#include "esp_mac.h"
#include "nvs_flash.h"
#include "driver/gpio.h"

#include "esp_camera.h"
#include "img_converters.h"

#include "coco_detect.hpp"
#include "dl_image_define.hpp"

#include "secrets.h"

static const char *TAG = "mule";

static constexpr char     API_BASE[]        = "https://func-velostands-37sp3n5axfjna.azurewebsites.net";
static constexpr char     FW_VERSION[]      = "0.1.0-yolo";
static constexpr int      HTTP_TIMEOUT_MS   = 10000;
static constexpr int      BICYCLE_CATEGORY  = 1;    // COCO class id for bicycle.
static constexpr size_t   RESPONSE_CAP      = 1024; // config/reading response body cap.

// Compile-time defaults. Overridden at boot by GET /api/v1/device/config.
static constexpr uint32_t DEFAULT_REPORT_INTERVAL_MS = 10000;
static constexpr float    DEFAULT_MIN_SCORE          = 0.35f;
static constexpr int      DEFAULT_MAX_SLOTS          = 40;

// Live config, filled by fetchConfig() (or kept at defaults on failure).
static uint32_t reportIntervalMs = DEFAULT_REPORT_INTERVAL_MS;
static float    minScore         = DEFAULT_MIN_SCORE;
static int      maxSlots         = DEFAULT_MAX_SLOTS;

static uint32_t seq        = 0;
static int      lastRssi   = 0;

// Wi-Fi event-group handshake: GOT_IP sets this bit; everything blocks on it.
static EventGroupHandle_t wifiEvents = nullptr;
static constexpr int WIFI_CONNECTED_BIT = BIT0;

// ---------------- Wi-Fi ---------------------------------------------------

static void onWifiEvent(void *, esp_event_base_t base, int32_t id, void *data) {
    if (base == WIFI_EVENT && id == WIFI_EVENT_STA_START) {
        esp_wifi_connect();
    } else if (base == WIFI_EVENT && id == WIFI_EVENT_STA_DISCONNECTED) {
        ESP_LOGW(TAG, "wifi disconnected, retrying");
        xEventGroupClearBits(wifiEvents, WIFI_CONNECTED_BIT);
        esp_wifi_connect();
    } else if (base == IP_EVENT && id == IP_EVENT_STA_GOT_IP) {
        auto *ev = static_cast<ip_event_got_ip_t *>(data);
        ESP_LOGI(TAG, "ip " IPSTR, IP2STR(&ev->ip_info.ip));
        xEventGroupSetBits(wifiEvents, WIFI_CONNECTED_BIT);
    }
}

static bool joinWifi() {
    wifiEvents = xEventGroupCreate();

    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    esp_netif_create_default_wifi_sta();

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));

    ESP_ERROR_CHECK(esp_event_handler_instance_register(
        WIFI_EVENT, ESP_EVENT_ANY_ID, &onWifiEvent, nullptr, nullptr));
    ESP_ERROR_CHECK(esp_event_handler_instance_register(
        IP_EVENT, IP_EVENT_STA_GOT_IP, &onWifiEvent, nullptr, nullptr));

    wifi_config_t wc = {};
    strncpy(reinterpret_cast<char *>(wc.sta.ssid),     WIFI_SSID,     sizeof(wc.sta.ssid) - 1);
    strncpy(reinterpret_cast<char *>(wc.sta.password), WIFI_PASSWORD, sizeof(wc.sta.password) - 1);

    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wc));
    ESP_ERROR_CHECK(esp_wifi_start());

    ESP_LOGI(TAG, "joining %s", WIFI_SSID);
    const EventBits_t bits = xEventGroupWaitBits(
        wifiEvents, WIFI_CONNECTED_BIT, pdFALSE, pdTRUE, pdMS_TO_TICKS(30000));
    return (bits & WIFI_CONNECTED_BIT) != 0;
}

static int currentRssi() {
    wifi_ap_record_t ap;
    if (esp_wifi_sta_get_ap_info(&ap) == ESP_OK) return ap.rssi;
    return 0;
}

// ---------------- Tiny JSON number scanner --------------------------------
//
// The backend returns small, canonical JSON. A full parser is overkill, so
// we scan for "<key>":<number> inside a response body with a known upper
// bound. Same approach as thor.

static bool extractNumber(const char *body, const char *key, double &out) {
    char needle[64];
    const int n = snprintf(needle, sizeof(needle), "\"%s\":", key);
    if (n <= 0 || n >= static_cast<int>(sizeof(needle))) return false;

    const char *p = strstr(body, needle);
    if (!p) return false;
    p += n;
    while (*p == ' ' || *p == '\t') p++;

    char *end = nullptr;
    const double v = strtod(p, &end);
    if (end == p) return false;
    out = v;
    return true;
}

static const char *findConfigBlock(const char *body) {
    const char *p = strstr(body, "\"config\":{");
    return p ? p + 9 : nullptr; // move past the opening brace
}

// ---------------- HTTPS helpers -------------------------------------------
//
// Minimal buffered GET/POST on top of esp_http_client. HTTPS validates
// against the ESP certificate bundle so Azure rotations don't brick us
// (architecture.md).

struct ResponseBuf {
    char   data[RESPONSE_CAP];
    size_t len;
};

static esp_err_t appendResponse(esp_http_client_event_t *evt) {
    if (evt->event_id != HTTP_EVENT_ON_DATA) return ESP_OK;
    auto *buf = static_cast<ResponseBuf *>(evt->user_data);
    if (!buf) return ESP_OK;
    const size_t room = sizeof(buf->data) - 1 - buf->len;
    const size_t take = std::min(room, static_cast<size_t>(evt->data_len));
    if (take > 0) {
        memcpy(buf->data + buf->len, evt->data, take);
        buf->len += take;
        buf->data[buf->len] = '\0';
    }
    return ESP_OK;
}

// ---------------- Config fetch --------------------------------------------
//
// GET /api/v1/device/config, authenticated with X-Api-Key, returns
//   { "device":"mule", "stand":"flow-main-1", "slots":40,
//     "reportIntervalSeconds":60,
//     "config": { "reportIntervalMs":10000, "minScore":0.35, ... } }
//
// Only the keys we recognise are read. Missing keys keep their default.

static void applyConfig(const char *body) {
    double v;
    // Stand-level fields (top of the response). They aren't inside "config"
    // so we read them from the full body.
    if (extractNumber(body, "slots", v) && v >= 1 && v <= 1000) {
        maxSlots = static_cast<int>(v + 0.5);
    }

    const char *cfg = findConfigBlock(body);
    if (!cfg) {
        ESP_LOGI(TAG, "no config block, keeping defaults");
        return;
    }
    if (extractNumber(cfg, "reportIntervalMs", v) && v >= 1000 && v <= 600000) {
        reportIntervalMs = static_cast<uint32_t>(v);
    }
    if (extractNumber(cfg, "minScore", v) && v >= 0.0 && v <= 1.0) {
        minScore = static_cast<float>(v);
    }
    ESP_LOGI(TAG, "config: reportIntervalMs=%u minScore=%.2f maxSlots=%d",
             static_cast<unsigned>(reportIntervalMs), minScore, maxSlots);
}

static bool fetchConfig() {
    ResponseBuf buf = {};
    esp_http_client_config_t cfg = {};
    const std::string url = std::string(API_BASE) + "/api/v1/device/config";
    cfg.url               = url.c_str();
    cfg.timeout_ms        = HTTP_TIMEOUT_MS;
    cfg.event_handler     = appendResponse;
    cfg.user_data         = &buf;
    cfg.crt_bundle_attach = esp_crt_bundle_attach;

    esp_http_client_handle_t h = esp_http_client_init(&cfg);
    if (!h) return false;
    esp_http_client_set_header(h, "X-Api-Key", DEVICE_API_KEY);

    const int64_t t0 = esp_timer_get_time();
    const esp_err_t err = esp_http_client_perform(h);
    const int code = esp_http_client_get_status_code(h);
    const int64_t ms = (esp_timer_get_time() - t0) / 1000;

    bool ok = false;
    if (err == ESP_OK && code >= 200 && code < 300) {
        ESP_LOGI(TAG, "config fetch HTTP %d  %lld ms  %u B",
                 code, ms, static_cast<unsigned>(buf.len));
        applyConfig(buf.data);
        ok = true;
    } else {
        ESP_LOGW(TAG, "config fetch failed: err=%s HTTP %d  %lld ms",
                 esp_err_to_name(err), code, ms);
    }
    esp_http_client_cleanup(h);
    return ok;
}

// ---------------- Reading POST --------------------------------------------

static bool reportReading(int occupied) {
    char body[192];
    const int bodyLen = snprintf(body, sizeof(body),
        "{\"occupied\":%d,\"seq\":%u,\"fw\":\"%s\",\"rssi\":%d}",
        occupied, static_cast<unsigned>(seq), FW_VERSION, lastRssi);
    if (bodyLen <= 0 || bodyLen >= static_cast<int>(sizeof(body))) return false;

    ResponseBuf buf = {};
    esp_http_client_config_t cfg = {};
    const std::string url = std::string(API_BASE) + "/api/v1/readings";
    cfg.url               = url.c_str();
    cfg.method            = HTTP_METHOD_POST;
    cfg.timeout_ms        = HTTP_TIMEOUT_MS;
    cfg.event_handler     = appendResponse;
    cfg.user_data         = &buf;
    cfg.crt_bundle_attach = esp_crt_bundle_attach;

    esp_http_client_handle_t h = esp_http_client_init(&cfg);
    if (!h) return false;
    esp_http_client_set_header(h, "X-Api-Key", DEVICE_API_KEY);
    esp_http_client_set_header(h, "Content-Type", "application/json");
    esp_http_client_set_post_field(h, body, bodyLen);

    const int64_t t0 = esp_timer_get_time();
    const esp_err_t err = esp_http_client_perform(h);
    const int code = esp_http_client_get_status_code(h);
    const int64_t ms = (esp_timer_get_time() - t0) / 1000;

    if (err != ESP_OK) {
        ESP_LOGE(TAG, "report failed: %s (%lld ms)", esp_err_to_name(err), ms);
    } else {
        ESP_LOGI(TAG, "report seq=%u occupied=%d  HTTP %d  %lld ms  %s",
                 static_cast<unsigned>(seq), occupied, code, ms, buf.data);
    }
    esp_http_client_cleanup(h);
    return err == ESP_OK && code >= 200 && code < 300;
}

// ---------------- Debug JPEG upload ---------------------------------------
//
// Mirrors hydra's upload. Non-fatal if it fails: the count has already landed
// and the next cycle will try again.

static bool uploadDebugJpeg(const uint8_t *jpg, size_t len) {
    char seqStr[16];
    snprintf(seqStr, sizeof(seqStr), "%u", static_cast<unsigned>(seq));

    esp_http_client_config_t cfg = {};
    const std::string url = std::string(API_BASE) + "/api/v1/debug/images";
    cfg.url               = url.c_str();
    cfg.method            = HTTP_METHOD_POST;
    cfg.timeout_ms        = HTTP_TIMEOUT_MS;
    cfg.crt_bundle_attach = esp_crt_bundle_attach;

    esp_http_client_handle_t h = esp_http_client_init(&cfg);
    if (!h) return false;
    esp_http_client_set_header(h, "X-Api-Key", DEVICE_API_KEY);
    esp_http_client_set_header(h, "Content-Type", "image/jpeg");
    esp_http_client_set_header(h, "X-Seq", seqStr);
    esp_http_client_set_post_field(h, reinterpret_cast<const char *>(jpg), len);

    const int64_t t0 = esp_timer_get_time();
    const esp_err_t err = esp_http_client_perform(h);
    const int code = esp_http_client_get_status_code(h);
    const int64_t ms = (esp_timer_get_time() - t0) / 1000;

    if (err != ESP_OK) {
        ESP_LOGW(TAG, "debug upload failed: %s (%lld ms)", esp_err_to_name(err), ms);
    } else {
        ESP_LOGI(TAG, "debug jpeg %u B  HTTP %d  %lld ms",
                 static_cast<unsigned>(len), code, ms);
    }
    esp_http_client_cleanup(h);
    return err == ESP_OK && code >= 200 && code < 300;
}

// ---------------- Camera + YOLO -------------------------------------------
//
// AtomS3R-CAM-M12 pin map, lifted verbatim from the BaselHack starter.

static esp_err_t initCamera() {
    // Camera power rail — AtomS3R routes 3V3_CAM through GPIO18 (active low).
    gpio_config_t power = {};
    power.pin_bit_mask = 1ULL << 18;
    power.mode = GPIO_MODE_OUTPUT;
    ESP_ERROR_CHECK(gpio_config(&power));
    ESP_ERROR_CHECK(gpio_set_level(GPIO_NUM_18, 0));
    vTaskDelay(pdMS_TO_TICKS(500));

    camera_config_t cfg = {};
    cfg.pin_pwdn  = -1;
    cfg.pin_reset = -1;
    cfg.pin_xclk  = 21;
    cfg.pin_sccb_sda = 12;
    cfg.pin_sccb_scl = 9;

    cfg.pin_d7 = 13;
    cfg.pin_d6 = 11;
    cfg.pin_d5 = 17;
    cfg.pin_d4 = 4;
    cfg.pin_d3 = 48;
    cfg.pin_d2 = 46;
    cfg.pin_d1 = 42;
    cfg.pin_d0 = 3;

    cfg.pin_vsync = 10;
    cfg.pin_href  = 14;
    cfg.pin_pclk  = 40;

    cfg.xclk_freq_hz = 20000000;
    cfg.ledc_timer   = LEDC_TIMER_0;
    cfg.ledc_channel = LEDC_CHANNEL_0;

    cfg.pixel_format = PIXFORMAT_RGB565;
    cfg.frame_size   = FRAMESIZE_QVGA;    // 320×240, the sweet spot for YOLO11n_s8.
    cfg.jpeg_quality = 12;
    cfg.fb_count     = 1;
    cfg.fb_location  = CAMERA_FB_IN_PSRAM;
    cfg.grab_mode    = CAMERA_GRAB_WHEN_EMPTY;

    return esp_camera_init(&cfg);
}

static int countBicycles(COCODetect *detector, camera_fb_t *frame) {
    dl::image::img_t img = {};
    img.data     = frame->buf;
    img.width    = frame->width;
    img.height   = frame->height;
    img.pix_type = dl::image::DL_IMAGE_PIX_TYPE_RGB565BE;

    auto &results = detector->run(img);
    int bikes = 0;
    for (const auto &r : results) {
        if (r.category == BICYCLE_CATEGORY && r.score >= minScore) bikes++;
    }
    // Clamp to the stand's slot count so the backend never 422s a count that
    // slightly exceeds capacity (two overlapping detections, say).
    if (bikes > maxSlots) bikes = maxSlots;
    return bikes;
}

// ---------------- app_main -----------------------------------------------

extern "C" void app_main(void) {
    ESP_LOGI(TAG, "boot — mule yolo bike counter %s", FW_VERSION);

    esp_err_t nvs = nvs_flash_init();
    if (nvs == ESP_ERR_NVS_NO_FREE_PAGES || nvs == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        nvs = nvs_flash_init();
    }
    ESP_ERROR_CHECK(nvs);

    if (!joinWifi()) {
        ESP_LOGE(TAG, "wifi join timed out — rebooting");
        vTaskDelay(pdMS_TO_TICKS(2000));
        esp_restart();
    }
    lastRssi = currentRssi();
    fetchConfig();

    if (initCamera() != ESP_OK) {
        ESP_LOGE(TAG, "camera init failed — halting");
        while (true) vTaskDelay(pdMS_TO_TICKS(1000));
    }
    ESP_LOGI(TAG, "camera ok, loading YOLO11…");
    COCODetect *detector = new COCODetect(COCODetect::YOLO11N_S8_V1);
    ESP_LOGI(TAG, "detector ready");

    int64_t lastReportMs = 0;
    while (true) {
        camera_fb_t *frame = esp_camera_fb_get();
        if (!frame) {
            ESP_LOGW(TAG, "frame grab failed");
            vTaskDelay(pdMS_TO_TICKS(500));
            continue;
        }

        const int bikes = countBicycles(detector, frame);
        ESP_LOGI(TAG, "bikes=%d", bikes);

        const int64_t nowMs = esp_timer_get_time() / 1000;
        if (nowMs - lastReportMs >= reportIntervalMs) {
            lastReportMs = nowMs;
            lastRssi = currentRssi();
            seq++;

            // Pick up any backend-side config changes.
            fetchConfig();
            reportReading(bikes);

            // JPEG the frame for the debug viewer. Non-fatal if it fails.
            uint8_t *jpg = nullptr;
            size_t   jpgLen = 0;
            if (frame2jpg(frame, 60, &jpg, &jpgLen)) {
                uploadDebugJpeg(jpg, jpgLen);
                free(jpg);
            }
        }

        esp_camera_fb_return(frame);
        // Keep ~1 fps so the detector thread doesn't starve the Wi-Fi task.
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}
