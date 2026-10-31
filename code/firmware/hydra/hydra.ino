// hydra — M5Stack AtomS3R-CAM-M12 (ESP32-S3 + OV3660).
//
// Joins Wi-Fi, takes a JPEG every 30 s and keeps the latest one in PSRAM.
// On the same LAN the laptop can reach it at:
//   http://hydra.local/            — HTML page, auto-refreshes every 30 s
//   http://hydra.local/photo.jpg   — the latest frame, straight bytes
// Fallback to http://<ip>/ (printed to the USB console at boot) if mDNS fails.

#include <WiFi.h>
#include <WebServer.h>
#include <ESPmDNS.h>
#include "esp_camera.h"

#include "secrets.h"

// AtomS3R-CAM-M12 camera pin map (OV3660, M12 lens).
// Source: docs.m5stack.com/en/homeassistant/cameras/atoms3r_m12
#define PWDN_GPIO_NUM   -1
#define RESET_GPIO_NUM  -1
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

static constexpr uint32_t CAPTURE_EVERY_MS = 30000;
static constexpr char     HOSTNAME[]       = "hydra";

WebServer server(80);

// Latest capture, in PSRAM. Owned by this file — freed on the next capture.
static uint8_t* lastJpg = nullptr;
static size_t   lastLen = 0;
static uint32_t lastAt  = 0;
static uint32_t frameId = 0;

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
  cfg.frame_size   = FRAMESIZE_SVGA;  // 800×600 — plenty for counting bikes, ~50 KB
  cfg.jpeg_quality = 12;              // 0-63, lower = better
  cfg.fb_count     = 2;
  cfg.fb_location  = CAMERA_FB_IN_PSRAM;
  cfg.grab_mode    = CAMERA_GRAB_LATEST;

  const esp_err_t err = esp_camera_init(&cfg);
  if (err != ESP_OK) {
    Serial.printf("[hydra] esp_camera_init: 0x%x\n", err);
    return false;
  }
  return true;
}

static void capture() {
  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("[hydra] fb_get failed");
    return;
  }
  // Copy out into a buffer we own so the driver can recycle its frame buffer.
  uint8_t* buf = (uint8_t*)ps_malloc(fb->len);
  if (!buf) {
    Serial.println("[hydra] ps_malloc failed");
    esp_camera_fb_return(fb);
    return;
  }
  memcpy(buf, fb->buf, fb->len);
  const size_t len = fb->len;
  esp_camera_fb_return(fb);

  uint8_t* old = lastJpg;
  lastJpg = buf;
  lastLen = len;
  lastAt  = millis();
  frameId++;
  if (old) free(old);
  Serial.printf("[hydra] frame #%u  %u bytes\n", frameId, unsigned(len));
}

static void handleIndex() {
  const String ip = WiFi.localIP().toString();
  String html = F("<!doctype html><meta charset=utf-8><title>hydra</title>"
                  "<style>body{margin:0;background:#111;color:#eee;"
                  "font-family:system-ui,sans-serif;text-align:center}"
                  "img{max-width:100%;height:auto;display:block;margin:0 auto}"
                  "p{opacity:.6;font-size:14px;margin:12px}</style>"
                  "<h2>hydra</h2>"
                  "<img id=i src=\"/photo.jpg?t=0\">"
                  "<p>IP: ");
  html += ip;
  html += F(" · auto-refresh every 30s</p>"
            "<script>setInterval(()=>{document.getElementById('i').src="
            "'/photo.jpg?t='+Date.now()},30000)</script>");
  server.send(200, "text/html", html);
}

static void handlePhoto() {
  if (!lastJpg || lastLen == 0) {
    server.send(503, "text/plain", "no capture yet");
    return;
  }
  server.sendHeader("Cache-Control", "no-store");
  server.send_P(200, "image/jpeg", (const char*)lastJpg, lastLen);
}

void setup() {
  Serial.begin(115200);
  // Keeps prints non-blocking when no USB monitor is attached.
  Serial.setTxTimeoutMs(0);
  delay(1500);
  Serial.println();
  Serial.println("[hydra] boot");

  if (!initCamera()) {
    Serial.println("[hydra] camera init failed — halting");
    while (true) delay(1000);
  }
  Serial.println("[hydra] camera ok");

  WiFi.mode(WIFI_STA);
  WiFi.setHostname(HOSTNAME);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.printf("[hydra] joining %s", WIFI_SSID);
  for (int i = 0; i < 60 && WiFi.status() != WL_CONNECTED; i++) {
    delay(500);
    Serial.print('.');
  }
  Serial.println();
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[hydra] wifi failed — rebooting");
    delay(2000);
    ESP.restart();
  }
  Serial.printf("[hydra] ip %s\n", WiFi.localIP().toString().c_str());

  if (MDNS.begin(HOSTNAME)) {
    MDNS.addService("http", "tcp", 80);
    Serial.printf("[hydra] http://%s.local/\n", HOSTNAME);
  }

  server.on("/", handleIndex);
  server.on("/photo.jpg", handlePhoto);
  server.begin();

  // Grab a frame right away so the first page load isn't blank.
  capture();
}

void loop() {
  server.handleClient();
  if (millis() - lastAt >= CAPTURE_EVERY_MS) capture();
  delay(1);
}
