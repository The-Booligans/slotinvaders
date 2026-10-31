// thor — RPLIDAR C1 test, v0
//
// Hardware: M5Stack AtomS3 + RPLIDAR C1 on the Grove port.
//   Grove G1 / G2 → lidar TX / RX (either way round — detected at boot)
//   Grove 5V + GND → lidar 5V + GND
//
// Prints lidar info + health once, then one summary line per full rotation.

#include <M5Unified.h>

static constexpr uint32_t LIDAR_BAUD = 460800;
static constexpr float MAX_RANGE_MM  = 4000;
// The bike-stand arc, in lidar angle degrees: everything outside is ignored.
static constexpr float ARC_START_DEG = 60.0f;   // right edge
static constexpr float ARC_END_DEG   = 120.0f;  // left edge
static constexpr int   SLOTS         = 8;
static constexpr int   ROUND_MM      = 50;      // snap displayed distances to this grid
static constexpr float ALPHA         = 0.25f;   // EMA across rotations
// Occupancy thresholds with hysteresis — the gap kills flicker on the edge.
static constexpr float OCCUPIED_MM   = 600.0f;  // ≤ this → bike
static constexpr float FREE_MM       = 700.0f;  // ≥ this → free

enum : uint8_t {
  CMD_STOP       = 0x25,
  CMD_SCAN       = 0x20,
  CMD_GET_INFO   = 0x50,
  CMD_GET_HEALTH = 0x52,
};

struct Point {
  float angle;  // degrees, clockwise
  float dist;   // mm, 0 = no return
};

static Point points[1024];
static size_t pointCount = 0;
static int rxPin = 1, txPin = 2;

static void send(uint8_t cmd) {
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

// Waits for the 7-byte response descriptor: A5 5A, 4 bytes length/mode, type.
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
  send(CMD_GET_INFO);
  uint8_t info[20];
  if (!readDescriptor(0x04, 300) || !readExact(info, sizeof info, 200)) return false;
  Serial.printf("lidar: model 0x%02X, firmware %u.%02u, hardware %u, serial ",
                info[0], info[2], info[1], info[3]);
  for (int i = 4; i < 20; i++) Serial.printf("%02X", info[i]);
  Serial.println();
  return true;
}

static void getHealth() {
  drain();
  send(CMD_GET_HEALTH);
  uint8_t h[3];
  if (readDescriptor(0x06, 300) && readExact(h, sizeof h, 200)) {
    static const char* names[] = {"good", "warning", "error"};
    Serial.printf("lidar: health %s (code %u)\n",
                  h[0] < 3 ? names[h[0]] : "?", h[1] | h[2] << 8);
  }
}

// The Grove cable's TX/RX order isn't fixed, so try both.
static bool connect() {
  for (int attempt = 0; attempt < 4; attempt++) {
    Serial.printf("lidar: trying RX=G%d TX=G%d\n", rxPin, txPin);
    openUart();
    send(CMD_STOP);
    if (getInfo()) return true;
    std::swap(rxPin, txPin);
  }
  return false;
}

static void startScan() {
  send(CMD_STOP);
  drain();
  send(CMD_SCAN);
  if (!readDescriptor(0x81, 1000)) Serial.println("lidar: no scan descriptor, reading anyway");
}

static void report() {
  static uint32_t scanId = 0;
  static float smoothed[SLOTS] = {};  // EMA across rotations, mm
  scanId++;
  const float slotDeg = (ARC_END_DEG - ARC_START_DEG) / SLOTS;

  float sum[SLOTS] = {};
  int   cnt[SLOTS] = {};
  size_t valid = 0;
  float nearest = 0, nearestAngle = 0;

  for (size_t i = 0; i < pointCount; i++) {
    const Point& p = points[i];
    if (p.dist <= 0) continue;
    valid++;
    if (nearest == 0 || p.dist < nearest) {
      nearest = p.dist;
      nearestAngle = p.angle;
    }
    if (p.angle < ARC_START_DEG || p.angle >= ARC_END_DEG) continue;  // outside the stand
    const int s = int((p.angle - ARC_START_DEG) / slotDeg);
    if (s < 0 || s >= SLOTS) continue;
    sum[s] += p.dist;
    cnt[s]++;
  }
  static bool occupied[SLOTS] = {};
  int occupiedCount = 0;
  for (int s = 0; s < SLOTS; s++) {
    if (cnt[s] > 0) {
      const float mean = sum[s] / cnt[s];
      smoothed[s] = smoothed[s] == 0 ? mean : smoothed[s] + ALPHA * (mean - smoothed[s]);
    }
    if (smoothed[s] > 0) {
      if (smoothed[s] <= OCCUPIED_MM) occupied[s] = true;
      else if (smoothed[s] >= FREE_MM) occupied[s] = false;
      // else: in the hysteresis gap, keep previous state
    }
    if (occupied[s]) occupiedCount++;
  }

  Serial.print("\x1B[2J\x1B[H");
  const int nearestR = (int(nearest) + ROUND_MM / 2) / ROUND_MM * ROUND_MM;
  Serial.printf("scan #%u  pts=%u  valid=%u  nearest=%dmm @ %.0f°\n",
                scanId, pointCount, valid, nearestR, nearestAngle);
  Serial.printf("arc %.0f°..%.0f°  %d slots × %.1f°  occupied %d/%d\n\n",
                ARC_START_DEG, ARC_END_DEG, SLOTS, slotDeg, occupiedCount, SLOTS);

  // Header: centre-angle of each slot. Slot 0 is at the right edge, slot 7 at the left.
  Serial.print("  slot   ");
  for (int s = 0; s < SLOTS; s++) Serial.printf("   %d   ", s + 1);
  Serial.println();
  Serial.print("  ang°   ");
  for (int s = 0; s < SLOTS; s++) {
    Serial.printf("  %3d  ", int(ARC_START_DEG + (s + 0.5f) * slotDeg));
  }
  Serial.println();
  Serial.print("  dist   ");
  for (int s = 0; s < SLOTS; s++) {
    const float d = smoothed[s];
    if (d == 0) Serial.print("  ---  ");
    else Serial.printf("  %4d ", (int(d) + ROUND_MM / 2) / ROUND_MM * ROUND_MM);
  }
  Serial.println(" mm");
  Serial.print("  state  ");
  for (int s = 0; s < SLOTS; s++) Serial.print(occupied[s] ? " BIKE  " : " free  ");
  Serial.println();
}

void setup() {
  M5.begin();
  Serial.begin(115200);
  // Without this, prints block when no serial monitor is attached and the lidar UART overflows.
  Serial.setTxTimeoutMs(0);
  M5.Display.println("RPLIDAR C1");
  delay(1500);

  if (!connect()) {
    Serial.println("lidar: no answer on G1/G2. Check wiring and 5V power.");
    M5.Display.setTextColor(TFT_RED);
    M5.Display.println("no lidar\ncheck wiring");
    while (true) delay(1000);
  }
  getHealth();
  startScan();
  M5.Display.printf("rx=G%d tx=G%d\nscanning...\n", rxPin, txPin);
}

void loop() {
  M5.update();
  uint8_t n[5];
  while (Serial1.available() >= 5) {
    n[0] = Serial1.read();
    // byte0: S in bit 0, !S in bit 1. byte1: check bit in bit 0.
    const bool start = n[0] & 1;
    if (start == bool(n[0] & 2)) continue;  // out of sync, slide one byte
    if (!readExact(n + 1, 4, 10)) return;
    if (!(n[1] & 1)) continue;

    if (start && pointCount > 0) {
      report();
      pointCount = 0;
    }
    if (pointCount < sizeof points / sizeof points[0]) {
      points[pointCount++] = {float((n[1] >> 1) | (n[2] << 7)) / 64.0f,
                              float(n[3] | (n[4] << 8)) / 4.0f};
    }
  }

  if (M5.BtnA.wasPressed()) {
    pointCount = 0;
    startScan();
  }
}
