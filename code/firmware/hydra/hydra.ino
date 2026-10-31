// hydra — M5Stack AtomS3R-CAM-M12 (ESP32-S3 + OV3660), debug uploader.
//
// Joins Wi-Fi, takes a JPEG every 10 s and POSTs it to the debug endpoint:
//   POST https://func-velostands-37sp3n5axfjna.azurewebsites.net/api/v1/debug/images
//   X-Api-Key: ${DEVICE_API_KEY}
//   X-Seq: <frame id>
//   Content-Type: image/jpeg
//   <JPEG bytes>
//
// The debug app at code/debug fetches it back from
//   GET  <API_BASE>/api/v1/debug/devices/hydra/image
// and shows it. Nothing is written to Cosmos; the backend keeps the latest
// frame in memory, one per device.

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include "esp_camera.h"

#include "secrets.h"

// AtomS3R-CAM-M12 camera pin map (OV3660, M12 lens).
// Source: docs.m5stack.com/en/homeassistant/cameras/atoms3r_m12
#define PWDN_GPIO_NUM   -1
#define RESET_GPIO_NUM  -1
// The CAM-M12 has an on-board power switch for the camera module. It must be
// driven LOW (active-low enable) a few hundred ms before esp_camera_init, or
// the sensor stays unpowered and the I2C probe times out.
#define POWER_GPIO_NUM  18
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

static constexpr uint32_t CAPTURE_EVERY_MS = 10000;
static constexpr uint32_t UPLOAD_TIMEOUT_MS = 15000;
static constexpr char     HOSTNAME[]       = "hydra";
static constexpr char     API_BASE[]       = "https://func-velostands-37sp3n5axfjna.azurewebsites.net";

static uint32_t frameId = 0;
static uint32_t nextCaptureAt = 0;

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
  cfg.pixel_format = PIXFORMAT_JPEG;
  cfg.frame_size   = FRAMESIZE_SVGA;  // 800×600 — ~50 KB JPEG, enough to count bikes
  cfg.jpeg_quality = 12;              // 0-63, lower = better
  cfg.fb_count     = 1;
  cfg.fb_location  = CAMERA_FB_IN_PSRAM;
  cfg.grab_mode    = CAMERA_GRAB_WHEN_EMPTY;
  cfg.sccb_i2c_port = 0;

  const esp_err_t err = esp_camera_init(&cfg);
  if (err != ESP_OK) {
    Serial.printf("[hydra] esp_camera_init: 0x%x\n", err);
    return false;
  }
  return true;
}

static bool uploadFrame(const uint8_t* buf, size_t len, uint32_t id) {
  // API_BASE is HTTPS; hackathon-grade: skip cert validation.
  // For production this should pin the Azure root CA or use setCACertBundle().
  WiFiClientSecure tls;
  tls.setInsecure();

  HTTPClient http;
  const String url = String(API_BASE) + "/api/v1/debug/images";
  http.setTimeout(UPLOAD_TIMEOUT_MS);
  http.setConnectTimeout(UPLOAD_TIMEOUT_MS);
  if (!http.begin(tls, url)) {
    Serial.println("[hydra] http.begin failed");
    return false;
  }
  http.addHeader("Content-Type", "image/jpeg");
  http.addHeader("X-Api-Key", DEVICE_API_KEY);
  http.addHeader("X-Seq", String(id));

  const uint32_t started = millis();
  const int code = http.POST(const_cast<uint8_t*>(buf), len);
  const uint32_t took = millis() - started;
  if (code <= 0) {
    Serial.printf("[hydra] upload failed: %s (%u ms)\n",
                  http.errorToString(code).c_str(), took);
    http.end();
    return false;
  }
  const String body = http.getString();
  Serial.printf("[hydra] upload #%u  %u B  HTTP %d  %u ms  %s\n",
                id, unsigned(len), code, took, body.c_str());
  http.end();
  return code >= 200 && code < 300;
}

static void captureAndUpload() {
  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("[hydra] fb_get failed");
    return;
  }
  frameId++;
  uploadFrame(fb->buf, fb->len, frameId);
  esp_camera_fb_return(fb);
}

static void scanAndPrint() {
  Serial.println("[hydra] scanning 2.4 GHz networks");
  const int n = WiFi.scanNetworks();
  if (n <= 0) {
    Serial.println("[hydra] scan found no networks");
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
    Serial.printf("[hydra]   %s%-32s  ch%2d  %4d dBm  %s\n",
                  target ? "* " : "  ",
                  ssid.c_str(), ch, rssi, open ? "open" : "secured");
  }
  Serial.printf("[hydra] target SSID \"%s\" %s on 2.4 GHz\n",
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
  Serial.printf("[hydra] joining %s", WIFI_SSID);
  for (int i = 0; i < 60 && WiFi.status() != WL_CONNECTED; i++) {
    delay(500);
    Serial.print('.');
  }
  Serial.println();
  if (WiFi.status() != WL_CONNECTED) {
    Serial.printf("[hydra] wifi status=%d\n", (int)WiFi.status());
    return false;
  }
  Serial.printf("[hydra] ip %s  rssi %d dBm\n",
                WiFi.localIP().toString().c_str(), WiFi.RSSI());
  return true;
}

void setup() {
  Serial.begin(115200);
  Serial.setTxTimeoutMs(0);
  delay(1500);
  Serial.println();
  Serial.println("[hydra] boot (debug uploader)");

  // Enable the camera's power switch (active low on the AtomS3R-CAM-M12) and
  // give the sensor's rail time to settle before probing. Without this the
  // sensor stays off and the SCCB probe times out.
  pinMode(POWER_GPIO_NUM, OUTPUT);
  digitalWrite(POWER_GPIO_NUM, LOW);
  delay(500);
  int cameraTries = 0;
  while (!initCamera()) {
    cameraTries++;
    if (cameraTries >= 5) {
      Serial.println("[hydra] camera init failed 5× — rebooting");
      delay(500);
      ESP.restart();
    }
    Serial.printf("[hydra] camera init retry %d\n", cameraTries);
    delay(500);
  }
  Serial.println("[hydra] camera ok");

  if (!joinWifi()) {
    Serial.println("[hydra] wifi failed — rebooting");
    delay(2000);
    ESP.restart();
  }

  Serial.printf("[hydra] uploading to %s/api/v1/debug/images every %u s\n",
                API_BASE, unsigned(CAPTURE_EVERY_MS / 1000));
  // Grab the first frame right away.
  captureAndUpload();
  nextCaptureAt = millis() + CAPTURE_EVERY_MS;
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[hydra] wifi dropped — reconnecting");
    if (!joinWifi()) {
      delay(5000);
      return;
    }
  }
  if ((int32_t)(millis() - nextCaptureAt) >= 0) {
    captureAndUpload();
    nextCaptureAt = millis() + CAPTURE_EVERY_MS;
  }
  delay(50);
}
