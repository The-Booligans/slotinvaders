// thor — M5Stack AtomS3 + RPLIDAR C1, self-learning bike counter.
//
// On boot:
//   1. Join Wi-Fi.
//   2. Scan the full 360° arc for ~CALIBRATION_MS, build a per-bin
//      histogram of returns, and pick the longest contiguous arc whose bins
//      consistently see a return in a bike-plausible range. That is the
//      stand direction, learned automatically.
//   3. Split that arc into SLOTS equal angular bays.
//
// Then forever:
//   For every full lidar rotation, update an EMA of the nearest return per
//   slot. Hysteresis thresholds classify each slot as occupied or free, and
//   the aggregate occupied count is POSTed to the backend every
//   REPORT_INTERVAL_MS as a normal reading:
//
//     POST ${API_BASE}/api/v1/readings
//     X-Api-Key: ${DEVICE_API_KEY}
//     Content-Type: application/json
//     { "occupied": N, "seq": SEQ, "fw": "...", "rssi": R }
//
// Alongside the reading, thor also uploads a tiny SVG sketch of the current
// slot state to the debug app, so a LiDAR unit has something to look at
// (cameras upload a JPEG the same way):
//
//     POST ${API_BASE}/api/v1/debug/images
//     X-Api-Key: ${DEVICE_API_KEY}
//     Content-Type: image/svg+xml
//     <svg …>…</svg>
//
// Wiring: RPLIDAR C1 on the AtomS3 Grove port — G1/G2 → lidar TX/RX (the two
// are auto-swapped at boot), 5V and GND to the lidar's 5V and GND.

#include <M5Unified.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>

#include "secrets.h"

static constexpr char      API_BASE[]            = "https://func-velostands-37sp3n5axfjna.azurewebsites.net";
static constexpr char      HOSTNAME[]            = "thor";
static constexpr char      FW_VERSION[]          = "0.2.0-lidar";
static constexpr uint32_t  LIDAR_BAUD            = 460800;
static constexpr uint32_t  REPORT_INTERVAL_MS    = 10000;
static constexpr uint32_t  UPLOAD_TIMEOUT_MS     = 10000;
static constexpr uint32_t  CALIBRATION_MS        = 8000;   // how long to profile the room
static constexpr int       BIN_DEG               = 2;      // angular bin width in degrees
static constexpr int       BINS                  = 360 / BIN_DEG;
static constexpr float     BIKE_RANGE_MIN_MM     = 250.f;
static constexpr float     BIKE_RANGE_MAX_MM     = 1800.f;
static constexpr float     OCCUPIED_MM           = 650.f;  // slot ≤ this → bike
static constexpr float     FREE_MM               = 850.f;  // slot ≥ this → free; between → hold previous state
static constexpr float     EMA_ALPHA             = 0.3f;
static constexpr int       SLOTS                 = 8;      // tune to match the physical stand
static constexpr int       STABLE_LATCH          = 3;      // need this many consecutive scans before flipping

// RPLIDAR commands
enum : uint8_t {
  CMD_STOP       = 0x25,
  CMD_SCAN       = 0x20,
  CMD_GET_INFO   = 0x50,
  CMD_GET_HEALTH = 0x52,
};

struct Point { float angle; float dist; };
static Point points[1024];
static size_t pointCount = 0;
static int rxPin = 1, txPin = 2;

// Calibration state (used only during the calibration window).
static uint16_t calibMin[BINS];
static uint32_t calibHits[BINS];
static uint32_t calibRotations = 0;

// Operating state.
static float    slotEMA[SLOTS];
static bool     slotOccupied[SLOTS];
static int      slotStable[SLOTS];
static float    arcStartDeg = 0;
static float    arcEndDeg   = 0;
static float    slotWidthDeg = 0;
static bool     calibrated   = false;
static uint32_t seq          = 0;
static uint32_t lastReport   = 0;

// ---------------- RPLIDAR UART plumbing ------------------------------------

static void lidarSend(uint8_t cmd) {
  const uint8_t req[] = {0xA5, cmd};
  Serial1.write(req, sizeof req);
}

static bool readExact(uint8_t* buf, size_t len, uint32_t timeoutMs) {
  const uint32_t start = millis();
  size_t got = 0;
  while (got < len) {
    if (Serial1.available()) {
      buf[got++] = Serial1.read();
    } else if (millis() - start > timeoutMs) {
      return false;
    } else {
      delay(1);
    }
  }
  return true;
}

static bool readDescriptor(uint8_t expectedType, uint32_t timeoutMs) {
  const uint32_t start = millis();
  bool sawA5 = false;
  while (millis() - start < timeoutMs) {
    if (!Serial1.available()) {
      delay(1);
      continue;
    }
    const uint8_t b = Serial1.read();
    if (sawA5 && b == 0x5A) {
      uint8_t rest[5];
      return readExact(rest, sizeof rest, 100) && rest[4] == expectedType;
    }
    sawA5 = b == 0xA5;
  }
  return false;
}

static void drain() {
  delay(20);
  while (Serial1.available()) Serial1.read();
}

static void openUart() {
  Serial1.end();
  Serial1.setRxBufferSize(8192);
  Serial1.begin(LIDAR_BAUD, SERIAL_8N1, rxPin, txPin);
}

static bool getInfo() {
  drain();
  lidarSend(CMD_GET_INFO);
  uint8_t info[20];
  if (!readDescriptor(0x04, 300) || !readExact(info, sizeof info, 200)) return false;
  Serial.printf("[thor] lidar model 0x%02X fw %u.%02u hw %u\n",
                info[0], info[2], info[1], info[3]);
  return true;
}

static void getHealth() {
  drain();
  lidarSend(CMD_GET_HEALTH);
  uint8_t h[3];
  if (readDescriptor(0x06, 300) && readExact(h, sizeof h, 200)) {
    static const char* names[] = {"good", "warning", "error"};
    Serial.printf("[thor] lidar health %s (code %u)\n",
                  h[0] < 3 ? names[h[0]] : "?", h[1] | h[2] << 8);
  }
}

static bool connectLidar() {
  for (int attempt = 0; attempt < 4; attempt++) {
    Serial.printf("[thor] lidar try RX=G%d TX=G%d\n", rxPin, txPin);
    openUart();
    lidarSend(CMD_STOP);
    if (getInfo()) return true;
    std::swap(rxPin, txPin);
  }
  return false;
}

static void startScan() {
  lidarSend(CMD_STOP);
  drain();
  lidarSend(CMD_SCAN);
  if (!readDescriptor(0x81, 1000)) Serial.println("[thor] no scan descriptor, reading anyway");
}

// ---------------- Self-learning direction + slot layout --------------------

static void resetCalibration() {
  for (int i = 0; i < BINS; i++) { calibMin[i] = 0; calibHits[i] = 0; }
  calibRotations = 0;
}

static void applyScanToCalibration() {
  bool seen[BINS] = {};
  uint16_t best[BINS] = {};
  for (size_t i = 0; i < pointCount; i++) {
    const Point& p = points[i];
    if (p.dist <= 0) continue;
    const int bin = int(p.angle / BIN_DEG) % BINS;
    if (bin < 0 || bin >= BINS) continue;
    if (p.dist >= BIKE_RANGE_MIN_MM && p.dist <= BIKE_RANGE_MAX_MM) {
      seen[bin] = true;
      if (best[bin] == 0 || p.dist < best[bin]) best[bin] = uint16_t(p.dist);
    }
  }
  for (int b = 0; b < BINS; b++) {
    if (seen[b]) {
      calibHits[b]++;
      if (calibMin[b] == 0 || best[b] < calibMin[b]) calibMin[b] = best[b];
    }
  }
  calibRotations++;
}

// Longest contiguous arc (wrap-aware) where ≥ MIN_HIT_RATIO of rotations saw
// a bike-range return. That is the stand direction.
static bool pickStandArc(float& outStartDeg, float& outEndDeg) {
  constexpr float MIN_HIT_RATIO = 0.35f;
  if (calibRotations < 5) return false;
  bool isStand[BINS];
  int populated = 0;
  for (int b = 0; b < BINS; b++) {
    const float ratio = float(calibHits[b]) / float(calibRotations);
    isStand[b] = ratio >= MIN_HIT_RATIO;
    if (isStand[b]) populated++;
  }
  if (populated < 3) return false;

  int bestStart = -1, bestLen = 0;
  int curStart = -1, curLen = 0;
  for (int i = 0; i < BINS * 2; i++) {
    const int b = i % BINS;
    if (isStand[b]) {
      if (curStart < 0) curStart = b;
      curLen++;
      if (curLen > bestLen) { bestLen = curLen; bestStart = curStart; }
    } else {
      curStart = -1;
      curLen = 0;
    }
    if (bestLen >= BINS) break;
  }
  if (bestLen <= 0) return false;
  outStartDeg = float(bestStart % BINS) * BIN_DEG;
  outEndDeg   = outStartDeg + float(bestLen) * BIN_DEG;
  return true;
}

static void resetSlots() {
  for (int s = 0; s < SLOTS; s++) {
    slotEMA[s] = 0;
    slotOccupied[s] = false;
    slotStable[s] = 0;
  }
}

static int angularSlot(float angle) {
  float a = angle - arcStartDeg;
  if (a < 0) a += 360.f;
  if (a >= arcEndDeg - arcStartDeg) return -1;
  const int s = int(a / slotWidthDeg);
  return (s >= 0 && s < SLOTS) ? s : -1;
}

static int classifyScan() {
  float minDist[SLOTS];
  int   cnt[SLOTS] = {};
  for (int s = 0; s < SLOTS; s++) minDist[s] = 1e9f;
  for (size_t i = 0; i < pointCount; i++) {
    const Point& p = points[i];
    if (p.dist <= 0) continue;
    const int s = angularSlot(p.angle);
    if (s < 0) continue;
    if (p.dist < minDist[s]) minDist[s] = p.dist;
    cnt[s]++;
  }
  int occupiedCount = 0;
  for (int s = 0; s < SLOTS; s++) {
    if (cnt[s] > 0 && minDist[s] < 1e9f) {
      slotEMA[s] = slotEMA[s] == 0 ? minDist[s] : slotEMA[s] + EMA_ALPHA * (minDist[s] - slotEMA[s]);
    }
    const bool wasOccupied = slotOccupied[s];
    bool want = wasOccupied;
    if (slotEMA[s] > 0 && slotEMA[s] <= OCCUPIED_MM) want = true;
    else if (slotEMA[s] >= FREE_MM) want = false;
    if (want != wasOccupied) {
      slotStable[s]++;
      if (slotStable[s] >= STABLE_LATCH) {
        slotOccupied[s] = want;
        slotStable[s] = 0;
      }
    } else {
      slotStable[s] = 0;
    }
    if (slotOccupied[s]) occupiedCount++;
  }
  return occupiedCount;
}

static void renderSlots(int occupiedCount) {
  Serial.printf("[thor] arc %.0f..%.0f  slots %d  occupied %d/%d  ",
                arcStartDeg, arcEndDeg, SLOTS, occupiedCount, SLOTS);
  for (int s = 0; s < SLOTS; s++) Serial.print(slotOccupied[s] ? "B" : ".");
  Serial.print("  dist:");
  for (int s = 0; s < SLOTS; s++) {
    if (slotEMA[s] <= 0) Serial.print(" ----");
    else Serial.printf(" %4d", int(slotEMA[s]));
  }
  Serial.println(" mm");

  // Small on-device status: counter + strip of blocks.
  M5.Display.fillScreen(TFT_BLACK);
  M5.Display.setCursor(2, 2);
  M5.Display.setTextColor(TFT_WHITE);
  M5.Display.setTextSize(1);
  M5.Display.printf("thor %d/%d\n", occupiedCount, SLOTS);
  const int W = M5.Display.width();
  const int H = 10;
  const int y = 20;
  const int bw = (W - 2) / SLOTS;
  for (int s = 0; s < SLOTS; s++) {
    const uint16_t color = slotOccupied[s] ? TFT_ORANGE : TFT_DARKGREEN;
    M5.Display.fillRect(1 + s * bw, y, bw - 1, H, color);
  }
}

// ---------------- Wi-Fi + HTTP report --------------------------------------

static bool joinWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.setHostname(HOSTNAME);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.printf("[thor] joining %s", WIFI_SSID);
  for (int i = 0; i < 60 && WiFi.status() != WL_CONNECTED; i++) {
    delay(500);
    Serial.print('.');
  }
  Serial.println();
  if (WiFi.status() != WL_CONNECTED) {
    Serial.printf("[thor] wifi status=%d\n", (int)WiFi.status());
    return false;
  }
  Serial.printf("[thor] ip %s  rssi %d dBm\n",
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
    Serial.println("[thor] http.begin failed");
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
    Serial.printf("[thor] report failed: %s (%u ms)\n",
                  http.errorToString(code).c_str(), took);
  } else {
    Serial.printf("[thor] report seq=%u occupied=%d  HTTP %d  %u ms  %s\n",
                  seq, occupied, code, took, resp.c_str());
  }
  http.end();
  return code >= 200 && code < 300;
}

// ---------------- Debug SVG upload ----------------------------------------
//
// The debug app renders whatever the camera devices POST to /debug/images.
// LiDAR has no camera, so we draw a tiny SVG sketch of the slot strip and
// upload that at the same cadence. The backend accepts image/svg+xml and
// serves it back with the right Content-Type; the debug app's <img> tag then
// renders it like any other frame.

static void appendSlotRects(String& svg, int viewW) {
  const int stripY = 32, stripH = 36, stripX = 10;
  const int stripW = viewW - 20;
  const float slotPx = float(stripW) / SLOTS;
  for (int s = 0; s < SLOTS; s++) {
    const int x = stripX + int(s * slotPx);
    const int w = int(slotPx) - 2;
    const char* fill = slotOccupied[s] ? "#f97316" : "#166534";
    svg += "<rect x=\"";
    svg += x;
    svg += "\" y=\"";
    svg += stripY;
    svg += "\" width=\"";
    svg += w;
    svg += "\" height=\"";
    svg += stripH;
    svg += "\" rx=\"4\" fill=\"";
    svg += fill;
    svg += "\"/>";
    svg += "<text x=\"";
    svg += x + w / 2;
    svg += "\" y=\"";
    svg += stripY + stripH / 2 + 4;
    svg += "\" text-anchor=\"middle\" fill=\"#f8fafc\">";
    if (slotEMA[s] > 0) svg += int(slotEMA[s]);
    else                svg += "&#183;";
    svg += "</text>";
  }
}

static bool uploadDebugSvg(int occupiedCount) {
  const int W = 320, H = 110;
  String svg;
  svg.reserve(2048);
  svg += "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 ";
  svg += W;
  svg += " ";
  svg += H;
  svg += "\" font-family=\"ui-monospace, SFMono-Regular, Menlo, monospace\" font-size=\"11\">";
  svg += "<rect width=\"100%\" height=\"100%\" fill=\"#0b0f14\"/>";
  svg += "<text x=\"10\" y=\"18\" fill=\"#e2e8f0\">thor &#183; ";
  svg += occupiedCount;
  svg += "/";
  svg += SLOTS;
  svg += " occupied &#183; arc ";
  svg += int(arcStartDeg);
  svg += "&#176;..";
  svg += int(arcEndDeg);
  svg += "&#176;</text>";
  appendSlotRects(svg, W);
  svg += "<text x=\"10\" y=\"";
  svg += H - 8;
  svg += "\" fill=\"#94a3b8\">seq ";
  svg += seq;
  svg += " &#183; fw ";
  svg += FW_VERSION;
  svg += " &#183; ";
  svg += WiFi.RSSI();
  svg += " dBm</text></svg>";

  WiFiClientSecure tls;
  tls.setInsecure();
  HTTPClient http;
  const String url = String(API_BASE) + "/api/v1/debug/images";
  http.setTimeout(UPLOAD_TIMEOUT_MS);
  http.setConnectTimeout(UPLOAD_TIMEOUT_MS);
  if (!http.begin(tls, url)) {
    Serial.println("[thor] debug http.begin failed");
    return false;
  }
  http.addHeader("Content-Type", "image/svg+xml");
  http.addHeader("X-Api-Key", DEVICE_API_KEY);
  http.addHeader("X-Seq", String(seq));
  const uint32_t started = millis();
  const int code = http.POST(
    reinterpret_cast<uint8_t*>(const_cast<char*>(svg.c_str())),
    svg.length());
  const uint32_t took = millis() - started;
  if (code <= 0) {
    Serial.printf("[thor] debug upload failed: %s (%u ms)\n",
                  http.errorToString(code).c_str(), took);
  } else {
    Serial.printf("[thor] debug svg %u B  HTTP %d  %u ms\n",
                  unsigned(svg.length()), code, took);
  }
  http.end();
  return code >= 200 && code < 300;
}

// ---------------- Lidar frame reader + state machine -----------------------

// Reads bytes from the lidar UART and fills `points`. Returns true whenever a
// full rotation has just closed (caller then consumes `points`).
static bool pumpLidar() {
  uint8_t n[5];
  while (Serial1.available() >= 5) {
    n[0] = Serial1.read();
    const bool start = n[0] & 1;
    if (start == bool(n[0] & 2)) continue;  // out of sync, slide one byte
    if (!readExact(n + 1, 4, 10)) return false;
    if (!(n[1] & 1)) continue;

    if (start && pointCount > 0) return true;  // rotation complete
    if (pointCount < sizeof points / sizeof points[0]) {
      points[pointCount++] = {
        float((n[1] >> 1) | (n[2] << 7)) / 64.0f,
        float(n[3] | (n[4] << 8)) / 4.0f,
      };
    }
  }
  return false;
}

static void calibrateDirection() {
  Serial.printf("[thor] learning direction for %u ms …\n", unsigned(CALIBRATION_MS));
  M5.Display.fillScreen(TFT_BLACK);
  M5.Display.setCursor(2, 2);
  M5.Display.setTextColor(TFT_WHITE);
  M5.Display.print("learning\narc...");
  resetCalibration();
  const uint32_t until = millis() + CALIBRATION_MS;
  while (millis() < until) {
    if (pumpLidar()) {
      applyScanToCalibration();
      pointCount = 0;
    }
  }
  Serial.printf("[thor] calibration done: %u rotations\n", unsigned(calibRotations));

  if (!pickStandArc(arcStartDeg, arcEndDeg)) {
    Serial.println("[thor] could not identify a stand arc — defaulting to 60°–120°");
    arcStartDeg = 60.f;
    arcEndDeg   = 120.f;
  }
  slotWidthDeg = (arcEndDeg - arcStartDeg) / float(SLOTS);
  resetSlots();
  calibrated = true;
  Serial.printf("[thor] stand arc %.0f°..%.0f°  (%.1f° per slot, %d slots)\n",
                arcStartDeg, arcEndDeg, slotWidthDeg, SLOTS);
}

// ---------------- setup / loop ---------------------------------------------

void setup() {
  M5.begin();
  Serial.begin(115200);
  Serial.setTxTimeoutMs(0);
  delay(1500);
  Serial.println();
  Serial.println("[thor] boot (lidar self-learning)");
  M5.Display.fillScreen(TFT_BLACK);
  M5.Display.setCursor(2, 2);
  M5.Display.setTextColor(TFT_WHITE);
  M5.Display.print("thor boot\nwifi...");

  if (!joinWifi()) {
    Serial.println("[thor] wifi failed — rebooting");
    delay(2000);
    ESP.restart();
  }

  if (!connectLidar()) {
    Serial.println("[thor] no lidar found on G1/G2 — check wiring and 5V power. Halting.");
    M5.Display.fillScreen(TFT_BLACK);
    M5.Display.setCursor(2, 2);
    M5.Display.setTextColor(TFT_RED);
    M5.Display.print("no lidar\ncheck wiring");
    while (true) delay(1000);
  }
  getHealth();
  startScan();

  calibrateDirection();
  lastReport = millis();
}

void loop() {
  M5.update();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[thor] wifi dropped — reconnecting");
    joinWifi();
  }

  if (pumpLidar()) {
    const int occupied = classifyScan();
    renderSlots(occupied);
    pointCount = 0;
    if (calibrated && (millis() - lastReport) >= REPORT_INTERVAL_MS) {
      reportReading(occupied);
      uploadDebugSvg(occupied);
      lastReport = millis();
    }
  }

  // BtnA re-triggers calibration if the sensor was moved.
  if (M5.BtnA.wasPressed()) {
    Serial.println("[thor] BtnA — re-calibrating");
    pointCount = 0;
    calibrated = false;
    calibrateDirection();
    lastReport = millis();
  }
}
