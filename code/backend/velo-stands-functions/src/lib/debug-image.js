"use strict";

const { hashKey } = require("./catalog");
const { reply, CORS_HEADERS } = require("./http");
const { imageStore: defaultImageStore } = require("./image-store");
const { deviceLog: defaultDeviceLog } = require("./device-log");

// POST /api/v1/debug/images
//   headers: X-Api-Key (required), X-Seq (optional)
//            Content-Type: image/jpeg  (camera frame)
//                       or image/svg+xml  (non-image sensors like LiDAR send a
//                                          vector sketch of what they see)
//   body:    raw bytes of the chosen type
//
// Keeps the latest frame per device in memory and exposes it to the debug app.
// This is separate from the counting pipeline on purpose: it doesn't care
// about the device's `mode` and never writes to Cosmos. It is the "I want to
// see what the sensor sees" path, not the fallback cloud-recognition path.
//
// GET /api/v1/debug/devices/{deviceId}/image
//   Returns the raw bytes with the stored Content-Type, or 404 if there isn't
//   one yet.

const JPEG_MIME = "image/jpeg";
const SVG_MIME = "image/svg+xml";
const ACCEPTED_MIME_TYPES = new Map([
  ["image/jpeg", JPEG_MIME],
  ["image/jpg", JPEG_MIME],
  ["image/svg+xml", SVG_MIME],
  ["image/svg", SVG_MIME],
]);

function parseSeq(raw) {
  if (raw == null) return undefined;
  const n = Number.parseInt(String(raw), 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

async function readBodyBuffer(request) {
  if (typeof request.arrayBuffer === "function") {
    return Buffer.from(await request.arrayBuffer());
  }
  if (typeof request.bytes === "function") {
    return Buffer.from(await request.bytes());
  }
  // Fallback for the fake request used in tests.
  if (request.body instanceof Buffer) return request.body;
  if (typeof request.body === "string") return Buffer.from(request.body, "binary");
  throw new Error("no readable body on request");
}

/**
 * POST /api/v1/debug/images
 * @param {object} deps
 * @param {{ get: (opts?: {force?: boolean}) => Promise<{catalog: any}> }} deps.catalogCache
 * @param {{ put: Function, maxBytes: number }} [deps.imageStore]
 * @param {{ push: Function }} [deps.deviceLog]
 */
function createDebugImageUploadHandler({
  catalogCache,
  imageStore = defaultImageStore,
  deviceLog = defaultDeviceLog,
}) {
  return async function handleUpload(request, context) {
    const apiKey = request.headers.get("x-api-key");
    if (!apiKey) return reply(401, { error: "missing X-Api-Key header" });

    const contentType = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const mimeType = ACCEPTED_MIME_TYPES.get(contentType);
    if (!mimeType) {
      return reply(415, { error: "Content-Type must be image/jpeg or image/svg+xml" });
    }

    let lookup;
    try {
      lookup = await catalogCache.get();
      let device = lookup.catalog.findDeviceByKeyHash(hashKey(apiKey.trim()));
      if (!device) {
        const fresh = await catalogCache.get({ force: true });
        if (fresh.reloaded) {
          lookup = fresh;
          device = lookup.catalog.findDeviceByKeyHash(hashKey(apiKey.trim()));
        }
      }
      lookup.device = device;
    } catch (err) {
      context.error(`[debug/images] catalog load failed: ${err?.message ?? err}`);
      return reply(503, { error: "catalog unavailable, try again" }, { "Retry-After": "30" });
    }
    const device = lookup.device;
    if (!device || device.status === "retired") {
      return reply(401, { error: "unknown or revoked API key" });
    }

    let buffer;
    try {
      buffer = await readBodyBuffer(request);
    } catch (err) {
      context.error(`[debug/images] body read failed: ${err?.message ?? err}`);
      return reply(400, { error: "could not read request body" });
    }
    if (buffer.length === 0) return reply(400, { error: "empty body" });
    if (buffer.length > imageStore.maxBytes) {
      return reply(413, { error: `image exceeds ${imageStore.maxBytes} bytes` });
    }

    const seq = parseSeq(request.headers.get("x-seq"));
    const entry = imageStore.put(device.deviceId, { buffer, mimeType, seq });
    deviceLog.push(device.deviceId, {
      level: "info",
      source: "api",
      message: `debug image seq=${entry.seq} type=${mimeType} bytes=${buffer.length}`,
    });

    return reply(202, {
      device: device.deviceId,
      seq: entry.seq,
      receivedAt: entry.receivedAt,
      bytes: buffer.length,
    });
  };
}

/**
 * GET /api/v1/debug/devices/{deviceId}/image
 * Returns the latest JPEG stored for the device, or 404.
 */
function createDebugImageFetchHandler({ imageStore = defaultImageStore } = {}) {
  return async function handleFetch(request, _context) {
    const deviceId = request.params?.deviceId;
    if (!deviceId) return reply(400, { error: "deviceId is required" });
    const entry = imageStore.get(deviceId);
    if (!entry) return reply(404, { error: "no image yet" });
    return {
      status: 200,
      body: entry.buffer,
      headers: {
        "Content-Type": entry.mimeType,
        "Content-Length": String(entry.buffer.length),
        "Cache-Control": "no-store",
        "X-Image-Seq": String(entry.seq),
        "X-Image-Received-At": entry.receivedAt,
        ...CORS_HEADERS,
      },
    };
  };
}

module.exports = {
  createDebugImageUploadHandler,
  createDebugImageFetchHandler,
  readBodyBuffer,
};
