// thor — M5Stack AtomS3 + RPLIDAR C1, self-learning bike counter.
//
// On boot:
//   1. Join Wi-Fi.
//   2. Fetch the device config from GET /api/v1/device/config so the number
//      of slot bays, the occupied/free thresholds, the EMA alpha and the
//      report interval all come from the backend. Compile-time defaults are
//      used if the fetch fails.
//   3. Scan the full 360° arc for ~calibrationMs, build a per-bin histogram
//      of returns, and pick the longest contiguous arc whose bins consistently
//      see a return in a bike-plausible range. That is the stand direction,
//      learned automatically.
//   4. Split that arc into `slots` equal angular bays.
//
// Then forever:
//   For every full lidar rotation, update an EMA of the nearest return per
//   slot. Hysteresis thresholds classify each slot as occupied or free, and
//   the aggregate occupied count is POSTed to the backend every
//   reportIntervalMs as a normal reading:
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
static constexpr char      FW_VERSION[]          = "0.3.0-lidar";
static constexpr uint32_t  LIDAR_BAUD            = 460800;
static constexpr uint32_t  UPLOAD_TIMEOUT_MS     = 10000;
static constexpr int       BIN_DEG               = 2;      // angular bin width in degrees
static constexpr int       BINS                  = 360 / BIN_DEG;
static constexpr int       MAX_SLOTS             = 32;     // array sizing cap — the actual slot count is runtime

// Compile-time defaults. Overridden at boot by GET /api/v1/device/config.
static constexpr uint32_t  DEFAULT_REPORT_INTERVAL_MS = 10000;
static constexpr uint32_t  DEFAULT_CALIBRATION_MS     = 8000;
static constexpr float     DEFAULT_BIKE_RANGE_MIN_MM  = 250.f;
static constexpr float     DEFAULT_BIKE_RANGE_MAX_MM  = 1800.f;
static constexpr float     DEFAULT_OCCUPIED_MM        = 650.f;
static constexpr float     DEFAULT_FREE_MM            = 850.f;
static constexpr float     DEFAULT_EMA_ALPHA          = 0.3f;
static constexpr int       DEFAULT_SLOTS              = 8;
static constexpr int       DEFAULT_STABLE_LATCH       = 3;

// Live config, filled from the backend (or the defaults above).
static uint32_t reportIntervalMs = DEFAULT_REPORT_INTERVAL_MS;
static uint32_t calibrationMs    = DEFAULT_CALIBRATION_MS;
static float    bikeRangeMinMm   = DEFAULT_BIKE_RANGE_MIN_MM;
static float    bikeRangeMaxMm   = DEFAULT_BIKE_RANGE_MAX_MM;
static float    occupiedMm       = DEFAULT_OCCUPIED_MM;
static float    freeMm           = DEFAULT_FREE_MM;
static float    emaAlpha         = DEFAULT_EMA_ALPHA;
static int      slots            = DEFAULT_SLOTS;
static int      stableLatch      = DEFAULT_STABLE_LATCH;

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

// Operating state. Arrays sized to MAX_SLOTS; only the first `slots` are used.
static float    slotEMA[MAX_SLOTS];
static bool     slotOccupied[MAX_SLOTS];
static int      slotStable[MAX_SLOTS];
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
    if (p.dist >= bikeRangeMinMm && p.dist <= bikeRangeMaxMm) {
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
  for (int s = 0; s < MAX_SLOTS; s++) {
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
  return (s >= 0 && s < slots) ? s : -1;
}

static int classifyScan() {
  float minDist[MAX_SLOTS];
  int   cnt[MAX_SLOTS] = {};
  for (int s = 0; s < slots; s++) minDist[s] = 1e9f;
  for (size_t i = 0; i < pointCount; i++) {
    const Point& p = points[i];
    if (p.dist <= 0) continue;
    const int s = angularSlot(p.angle);
    if (s < 0) continue;
    if (p.dist < minDist[s]) minDist[s] = p.dist;
    cnt[s]++;
  }
  int occupiedCount = 0;
  for (int s = 0; s < slots; s++) {
    if (cnt[s] > 0 && minDist[s] < 1e9f) {
      slotEMA[s] = slotEMA[s] == 0 ? minDist[s] : slotEMA[s] + emaAlpha * (minDist[s] - slotEMA[s]);
    }
    const bool wasOccupied = slotOccupied[s];
    bool want = wasOccupied;
    if (slotEMA[s] > 0 && slotEMA[s] <= occupiedMm) want = true;
    else if (slotEMA[s] >= freeMm) want = false;
    if (want != wasOccupied) {
      slotStable[s]++;
      if (slotStable[s] >= stableLatch) {
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
                arcStartDeg, arcEndDeg, slots, occupiedCount, slots);
  for (int s = 0; s < slots; s++) Serial.print(slotOccupied[s] ? "B" : ".");
  Serial.print("  dist:");
  for (int s = 0; s < slots; s++) {
    if (slotEMA[s] <= 0) Serial.print(" ----");
    else Serial.printf(" %4d", int(slotEMA[s]));
  }
  Serial.println(" mm");

  // Small on-device status: counter + strip of blocks.
  M5.Display.fillScreen(TFT_BLACK);
  M5.Display.setCursor(2, 2);
  M5.Display.setTextColor(TFT_WHITE);
  M5.Display.setTextSize(1);
  M5.Display.printf("thor %d/%d\n", occupiedCount, slots);
  const int W = M5.Display.width();
  const int H = 10;
  const int y = 20;
  const int bw = (W - 2) / slots;
  for (int s = 0; s < slots; s++) {
    const uint16_t color = slotOccupied[s] ? TFT_ORANGE : TFT_DARKGREEN;
    M5.Display.fillRect(1 + s * bw, y, bw - 1, H, color);
  }
}

// ---------------- Config fetch ---------------------------------------------
//
// The backend holds thresholds + slot count + report interval per device.
// GET /api/v1/device/config, authenticated with X-Api-Key, returns:
//
//   { "device":"thor", "stand":"kaegen-hof-1", "slots":40,
//     "reportIntervalSeconds":60,
//     "config": { "slots":8, "occupiedMm":650, "freeMm":850, ... } }
//
// Only the keys we recognise are read. Missing keys keep their default. The
// payload is small (< 300 B), so a handrolled scanner is enough — no need to
// drag ArduinoJson in just for this.

// Extracts the "config":{...} inner object from the response, so later lookups
// never see the top-level envelope keys (e.g. "slots":40 for the whole stand).
static String extractConfigBlock(const String& body) {
  const int start = body.indexOf("\"config\":{");
  if (start < 0) return String();
  int i = start + 9;  // on the '{'
  int depth = 0;
  for (; i < int(body.length()); i++) {
    const char c = body[i];
    if (c == '{') depth++;
    else if (c == '}') { depth--; if (depth == 0) return body.substring(start + 9, i + 1); }
  }
  return String();
}

static bool extractNumber(const String& body, const char* key, double& out) {
  // Finds "<key>":<number>. Not a general-purpose parser; relies on the
  // backend emitting canonical JSON with no odd whitespace, which it does.
  String needle = String("\"") + key + "\":";
  int i = body.indexOf(needle);
  if (i < 0) return false;
  i += needle.length();
  while (i < int(body.length()) && (body[i] == ' ' || body[i] == '\t')) i++;
  int j = i;
  if (j < int(body.length()) && (body[j] == '+' || body[j] == '-')) j++;
  while (j < int(body.length())) {
    const char c = body[j];
    if ((c >= '0' && c <= '9') || c == '.' || c == 'e' || c == 'E' || c == '+' || c == '-') j++;
    else break;
  }
  if (j == i) return false;
  out = body.substring(i, j).toDouble();
  return true;
}

static void applyConfigNumber(const String& body, const char* key, int& dst, int lo, int hi) {
  double v;
  if (!extractNumber(body, key, v)) return;
  const int n = int(v + (v >= 0 ? 0.5 : -0.5));
  if (n < lo || n > hi) {
    Serial.printf("[thor] config %s=%d out of range [%d..%d], ignored\n", key, n, lo, hi);
    return;
  }
  dst = n;
}

static void applyConfigNumber(const String& body, const char* key, uint32_t& dst, uint32_t lo, uint32_t hi) {
  double v;
  if (!extractNumber(body, key, v)) return;
  if (v < lo || v > hi) {
    Serial.printf("[thor] config %s=%.0f out of range [%u..%u], ignored\n", key, v, unsigned(lo), unsigned(hi));
    return;
  }
  dst = uint32_t(v);
}

static void applyConfigNumber(const String& body, const char* key, float& dst, float lo, float hi) {
  double v;
  if (!extractNumber(body, key, v)) return;
  if (v < lo || v > hi) {
    Serial.printf("[thor] config %s=%.2f out of range [%.2f..%.2f], ignored\n", key, v, lo, hi);
    return;
  }
  dst = float(v);
}

static bool fetchConfig() {
  WiFiClientSecure tls;
  tls.setInsecure();
  HTTPClient http;
  const String url = String(API_BASE) + "/api/v1/device/config";
  http.setTimeout(UPLOAD_TIMEOUT_MS);
  http.setConnectTimeout(UPLOAD_TIMEOUT_MS);
  if (!http.begin(tls, url)) {
    Serial.println("[thor] config http.begin failed");
    return false;
  }
  http.addHeader("X-Api-Key", DEVICE_API_KEY);
  const uint32_t started = millis();
  const int code = http.GET();
  const String body = (code > 0) ? http.getString() : String();
  const uint32_t took = millis() - started;
  http.end();
  if (code < 200 || code >= 300) {
    Serial.printf("[thor] config fetch failed: HTTP %d  %u ms  %s\n",
                  code, took, body.c_str());
    return false;
  }
  Serial.printf("[thor] config fetch HTTP %d  %u ms  %u B\n",
                code, took, unsigned(body.length()));

  // Only read from inside the "config":{...} block so top-level fields
  // (e.g. "slots" = the whole stand's capacity) don't shadow device knobs.
  const String cfg = extractConfigBlock(body);
  if (cfg.length() == 0) {
    Serial.println("[thor] response has no config block; keeping defaults");
    return true;
  }
  applyConfigNumber(cfg, "slots",            slots,            1, MAX_SLOTS);
  applyConfigNumber(cfg, "occupiedMm",       occupiedMm,       50.f, 10000.f);
  applyConfigNumber(cfg, "freeMm",           freeMm,           50.f, 10000.f);
  applyConfigNumber(cfg, "bikeRangeMinMm",   bikeRangeMinMm,   10.f, 10000.f);
  applyConfigNumber(cfg, "bikeRangeMaxMm",   bikeRangeMaxMm,   10.f, 20000.f);
  applyConfigNumber(cfg, "emaAlpha",         emaAlpha,         0.01f, 1.f);
  applyConfigNumber(cfg, "stableLatch",      stableLatch,      1, 100);
  applyConfigNumber(cfg, "calibrationMs",    calibrationMs,    1000U, 60000U);
  applyConfigNumber(cfg, "reportIntervalMs", reportIntervalMs, 1000U, 600000U);

  if (occupiedMm >= freeMm) {
    Serial.printf("[thor] config refused: occupiedMm (%.0f) must be below freeMm (%.0f) — reverting both\n",
                  occupiedMm, freeMm);
    occupiedMm = DEFAULT_OCCUPIED_MM;
    freeMm     = DEFAULT_FREE_MM;
  }
  Serial.printf("[thor] config: slots=%d occupied<=%.0f free>=%.0f ema=%.2f latch=%d "
                "range=%.0f..%.0f calib=%ums report=%ums\n",
                slots, occupiedMm, freeMm, emaAlpha, stableLatch,
                bikeRangeMinMm, bikeRangeMaxMm,
                unsigned(calibrationMs), unsigned(reportIntervalMs));
  return true;
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
  const float slotPx = float(stripW) / slots;
  for (int s = 0; s < slots; s++) {
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
  svg += slots;
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
  Serial.printf("[thor] learning direction for %u ms …\n", unsigned(calibrationMs));
  M5.Display.fillScreen(TFT_BLACK);
  M5.Display.setCursor(2, 2);
  M5.Display.setTextColor(TFT_WHITE);
  M5.Display.print("learning\narc...");
  resetCalibration();
  const uint32_t until = millis() + calibrationMs;
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
  slotWidthDeg = (arcEndDeg - arcStartDeg) / float(slots);
  resetSlots();
  calibrated = true;
  Serial.printf("[thor] stand arc %.0f°..%.0f°  (%.1f° per slot, %d slots)\n",
                arcStartDeg, arcEndDeg, slotWidthDeg, slots);
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

  if (!fetchConfig()) {
    Serial.println("[thor] using compile-time defaults for this boot");
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
    if (calibrated && (millis() - lastReport) >= reportIntervalMs) {
      // Pick up any config changes made in the backend between reports. Thresholds
      // and reportIntervalMs apply immediately. `slots` only takes effect at the
      // next calibration — the current arc split would stop making sense mid-run.
      const int previousSlots = slots;
      fetchConfig();
      if (slots != previousSlots) {
        Serial.printf("[thor] slots changed %d -> %d; press BtnA to re-calibrate\n",
                      previousSlots, slots);
        slots = previousSlots;  // keep the current arc layout until re-calibration
      }
      reportReading(occupied);
      uploadDebugSvg(occupied);
      lastReport = millis();
    }
  }

  // BtnA re-triggers config refresh + calibration if the sensor was moved
  // or an operator tweaked the thresholds in the backend.
  if (M5.BtnA.wasPressed()) {
    Serial.println("[thor] BtnA — refreshing config and re-calibrating");
    fetchConfig();
    pointCount = 0;
    calibrated = false;
    calibrateDirection();
    lastReport = millis();
  }
}
