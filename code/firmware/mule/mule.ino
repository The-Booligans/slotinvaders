// mule — M5Stack AtomS3R-CAM-M12 (ESP32-S3 + OV3660), on-device bike counter
// with an Edge Impulse YOLO-derived object detection model.
//
// Plan A device: the image never leaves the stand. On each cycle we grab a
// JPEG from the OV3660, decode it to RGB888, feed it to the Edge Impulse YOLO
// model, count the detections labelled "bicycle" above MIN_CONFIDENCE, and
// POST only that integer to the backend:
//
//   POST ${API_BASE}/api/v1/readings
//   X-Api-Key: ${DEVICE_API_KEY}
//   Content-Type: application/json
//   { "occupied": N, "seq": SEQ, "fw": "...", "rssi": R }
//
// The Edge Impulse model is pulled in via its exported Arduino library (see
// README.md for how to drop it in — the sketch does not compile without it).
// The include name below is what Edge Impulse Studio emits for a project
// named "slotinvaders-bike-yolo"; rename to match your deployment target.

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include "esp_camera.h"
#include "img_converters.h"

#include <slotinvaders-bike-yolo_inferencing.h>
#include "edge-impulse-sdk/dsp/image/image.hpp"

#include "secrets.h"

// AtomS3R-CAM-M12 camera pin map (OV3660, M12 lens).
// Same as hydra — docs.m5stack.com/en/homeassistant/cameras/atoms3r_m12
#define PWDN_GPIO_NUM   -1
#define RESET_GPIO_NUM  -1
#define POWER_GPIO_NUM  18   // active-low enable for the camera module
#define XCLK_GPIO_NUM   21
#define SIOD_GPIO_NUM   12
#define SIOC_GPIO_NUM    9
#define Y9_GPIO_NUM     13
#define Y8_GPIO_NUM     11
#define Y7_GPIO_NUM     17
#define Y6_GPIO_NUM      4
#define Y5_GPIO_NUM     48
#define Y4_GPIO_NUM     46
#define Y3_GPIO_NUM     42
#define Y2_GPIO_NUM      3
#define VSYNC_GPIO_NUM  10
#define HREF_GPIO_NUM   14
#define PCLK_GPIO_NUM   40

static constexpr char     API_BASE[]            = "https://func-velostands-37sp3n5axfjna.azurewebsites.net";
static constexpr char     HOSTNAME[]            = "mule";
static constexpr char     FW_VERSION[]          = "0.1.0-yolo";
static constexpr char     BIKE_LABEL[]          = "bicycle";
static constexpr float    MIN_CONFIDENCE        = 0.55f;
static constexpr uint32_t REPORT_INTERVAL_MS    = 10000;
static constexpr uint32_t UPLOAD_TIMEOUT_MS     = 15000;

static uint32_t seq        = 0;
static uint32_t lastReport = 0;

// Scratch buffer for the model input (RGB888, EI_CLASSIFIER_INPUT_{W,H}×3).
// Lives in PSRAM; allocated once in setup() so loop() stays allocation-free.
static uint8_t* rgbInput = nullptr;

// ---------------- Camera ----------------------------------------------------

static bool initCamera() {
  camera_config_t cfg = {};
  cfg.ledc_channel = LEDC_CHANNEL_0;
  cfg.ledc_timer   = LEDC_TIMER_0;
  cfg.pin_d0 = Y2_GPIO_NUM;
  cfg.pin_d1 = Y3_GPIO_NUM;
  cfg.pin_d2 = Y4_GPIO_NUM;
  cfg.pin_d3 = Y5_GPIO_NUM;
  cfg.pin_d4 = Y6_GPIO_NUM;
  cfg.pin_d5 = Y7_GPIO_NUM;
  cfg.pin_d6 = Y8_GPIO_NUM;
  cfg.pin_d7 = Y9_GPIO_NUM;
  cfg.pin_xclk     = XCLK_GPIO_NUM;
  cfg.pin_pclk     = PCLK_GPIO_NUM;
  cfg.pin_vsync    = VSYNC_GPIO_NUM;
  cfg.pin_href     = HREF_GPIO_NUM;
  cfg.pin_sccb_sda = SIOD_GPIO_NUM;
  cfg.pin_sccb_scl = SIOC_GPIO_NUM;
  cfg.pin_pwdn     = PWDN_GPIO_NUM;
  cfg.pin_reset    = RESET_GPIO_NUM;
  cfg.xclk_freq_hz = 20000000;
  cfg.pixel_format = PIXFORMAT_JPEG;   // JPEG off the sensor, decode in RAM
  cfg.frame_size   = FRAMESIZE_VGA;    // 640×480 — downscaled to the model input
  cfg.jpeg_quality = 12;
  cfg.fb_count     = 1;
  cfg.fb_location  = CAMERA_FB_IN_PSRAM;
  cfg.grab_mode    = CAMERA_GRAB_WHEN_EMPTY;
  cfg.sccb_i2c_port = 0;

  const esp_err_t err = esp_camera_init(&cfg);
  if (err != ESP_OK) {
    Serial.printf("[mule] esp_camera_init: 0x%x\n", err);
    return false;
  }
  return true;
}

// ---------------- YOLO inference -------------------------------------------

// Edge Impulse feeds the model via a callback that returns normalised pixels
// at the model's input resolution. rgbInput already holds the resized frame.
static int rgbFeature(size_t offset, size_t length, float* out_ptr) {
  size_t out_i = 0;
  const size_t pixel_start = offset;
  for (size_t i = 0; i < length; i++) {
    const size_t px = (pixel_start + i) * 3;
    const uint8_t r = rgbInput[px + 0];
    const uint8_t g = rgbInput[px + 1];
    const uint8_t b = rgbInput[px + 2];
    out_ptr[out_i++] = (float)((r << 16) | (g << 8) | b);
  }
  return 0;
}

static int countBikes() {
  signal_t signal;
  signal.total_length = EI_CLASSIFIER_INPUT_WIDTH * EI_CLASSIFIER_INPUT_HEIGHT;
  signal.get_data = &rgbFeature;

  ei_impulse_result_t result = {};
  const EI_IMPULSE_ERROR r = run_classifier(&signal, &result, false);
  if (r != EI_IMPULSE_OK) {
    Serial.printf("[mule] run_classifier failed: %d\n", r);
    return -1;
  }

  int bikes = 0;
  for (uint32_t i = 0; i < result.bounding_boxes_count; i++) {
    const ei_impulse_result_bounding_box_t& bb = result.bounding_boxes[i];
    if (bb.value < MIN_CONFIDENCE) continue;
    if (strcmp(bb.label, BIKE_LABEL) != 0) continue;
    bikes++;
  }
  Serial.printf("[mule] inferred bikes=%d  (dsp=%lu ms, cls=%lu ms, anom=%lu ms)\n",
                bikes,
                (unsigned long)result.timing.dsp,
                (unsigned long)result.timing.classification,
                (unsigned long)result.timing.anomaly);
  return bikes;
}

// Grab a JPEG from the sensor, decode to RGB888, downscale to the model's
// expected input shape in-place in rgbInput, then run the detector.
static int captureAndCount() {
  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("[mule] fb_get failed");
    return -1;
  }

  // Decode JPEG to a temporary RGB888 buffer at the camera's native size.
  const size_t rgb_len = (size_t)fb->width * fb->height * 3;
  uint8_t* rgb = (uint8_t*)ps_malloc(rgb_len);
  if (!rgb) {
    Serial.println("[mule] ps_malloc for decode failed");
    esp_camera_fb_return(fb);
    return -1;
  }
  const bool ok = fmt2rgb888(fb->buf, fb->len, fb->format, rgb);
  const int srcW = fb->width;
  const int srcH = fb->height;
  esp_camera_fb_return(fb);
  if (!ok) {
    Serial.println("[mule] fmt2rgb888 failed");
    free(rgb);
    return -1;
  }

  // Centre-crop to a square then resize to the model's input resolution.
  const int side = srcW < srcH ? srcW : srcH;
  const int x0 = (srcW - side) / 2;
  const int y0 = (srcH - side) / 2;
  ei::image::processing::crop_and_interpolate_rgb888(
      rgb, srcW, srcH,
      x0, y0, side, side,
      rgbInput,
      EI_CLASSIFIER_INPUT_WIDTH,
      EI_CLASSIFIER_INPUT_HEIGHT);
  free(rgb);

  return countBikes();
}

// ---------------- Wi-Fi + reading POST --------------------------------------

static void scanAndPrint() {
  Serial.println("[mule] scanning 2.4 GHz networks");
  const int n = WiFi.scanNetworks();
  if (n <= 0) {
    Serial.println("[mule] scan found no networks");
    return;
  }
  bool sawTarget = false;
  for (int i = 0; i < n; i++) {
    const String ssid = WiFi.SSID(i);
    const int rssi = WiFi.RSSI(i);
    const int ch = WiFi.channel(i);
    const bool open = WiFi.encryptionType(i) == WIFI_AUTH_OPEN;
    const bool target = ssid == WIFI_SSID;
    if (target) sawTarget = true;
    Serial.printf("[mule]   %s%-32s  ch%2d  %4d dBm  %s\n",
                  target ? "* " : "  ",
                  ssid.c_str(), ch, rssi, open ? "open" : "secured");
  }
  Serial.printf("[mule] target SSID \"%s\" %s on 2.4 GHz\n",
                WIFI_SSID, sawTarget ? "FOUND" : "NOT FOUND");
  WiFi.scanDelete();
}

static bool joinWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.setHostname(HOSTNAME);
  WiFi.disconnect(true, true);
  delay(200);
  scanAndPrint();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.printf("[mule] joining %s", WIFI_SSID);
  for (int i = 0; i < 60 && WiFi.status() != WL_CONNECTED; i++) {
    delay(500);
    Serial.print('.');
  }
  Serial.println();
  if (WiFi.status() != WL_CONNECTED) {
    Serial.printf("[mule] wifi status=%d\n", (int)WiFi.status());
    return false;
  }
  Serial.printf("[mule] ip %s  rssi %d dBm\n",
                WiFi.localIP().toString().c_str(), WiFi.RSSI());
  return true;
}

static bool reportReading(int occupied) {
  WiFiClientSecure tls;
  tls.setInsecure();
  HTTPClient http;
  const String url = String(API_BASE) + "/api/v1/readings";
  http.setTimeout(UPLOAD_TIMEOUT_MS);
  http.setConnectTimeout(UPLOAD_TIMEOUT_MS);
  if (!http.begin(tls, url)) {
    Serial.println("[mule] http.begin failed");
    return false;
  }
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Api-Key", DEVICE_API_KEY);
  seq++;
  String body;
  body.reserve(128);
  body = "{\"occupied\":";
  body += occupied;
  body += ",\"seq\":";
  body += seq;
  body += ",\"fw\":\"";
  body += FW_VERSION;
  body += "\",\"rssi\":";
  body += WiFi.RSSI();
  body += "}";
  const uint32_t started = millis();
  const int code = http.POST(body);
  const uint32_t took = millis() - started;
  const String resp = (code > 0) ? http.getString() : String();
  if (code <= 0) {
    Serial.printf("[mule] report failed: %s (%u ms)\n",
                  http.errorToString(code).c_str(), took);
  } else {
    Serial.printf("[mule] report seq=%u occupied=%d  HTTP %d  %u ms  %s\n",
                  seq, occupied, code, took, resp.c_str());
  }
  http.end();
  return code >= 200 && code < 300;
}

// ---------------- setup / loop ---------------------------------------------

void setup() {
  Serial.begin(115200);
  Serial.setTxTimeoutMs(0);
  delay(1500);
  Serial.println();
  Serial.printf("[mule] boot (on-device YOLO, model=%s %dx%d)\n",
                EI_CLASSIFIER_PROJECT_NAME,
                EI_CLASSIFIER_INPUT_WIDTH, EI_CLASSIFIER_INPUT_HEIGHT);

  pinMode(POWER_GPIO_NUM, OUTPUT);
  digitalWrite(POWER_GPIO_NUM, LOW);
  delay(500);
  int cameraTries = 0;
  while (!initCamera()) {
    cameraTries++;
    if (cameraTries >= 5) {
      Serial.println("[mule] camera init failed 5× — rebooting");
      delay(500);
      ESP.restart();
    }
    Serial.printf("[mule] camera init retry %d\n", cameraTries);
    delay(500);
  }
  Serial.println("[mule] camera ok");

  const size_t rgb_bytes = EI_CLASSIFIER_INPUT_WIDTH * EI_CLASSIFIER_INPUT_HEIGHT * 3;
  rgbInput = (uint8_t*)ps_malloc(rgb_bytes);
  if (!rgbInput) {
    Serial.printf("[mule] ps_malloc(%u) for model input failed — rebooting\n",
                  (unsigned)rgb_bytes);
    delay(2000);
    ESP.restart();
  }

  if (!joinWifi()) {
    Serial.println("[mule] wifi failed — rebooting");
    delay(2000);
    ESP.restart();
  }

  Serial.printf("[mule] posting counts to %s/api/v1/readings every %u s\n",
                API_BASE, unsigned(REPORT_INTERVAL_MS / 1000));
  lastReport = millis() - REPORT_INTERVAL_MS;  // trigger an immediate first report
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[mule] wifi dropped — reconnecting");
    if (!joinWifi()) {
      delay(5000);
      return;
    }
  }

  if ((millis() - lastReport) >= REPORT_INTERVAL_MS) {
    const int bikes = captureAndCount();
    if (bikes >= 0) {
      reportReading(bikes);
    }
    lastReport = millis();
  }

  delay(50);
}
