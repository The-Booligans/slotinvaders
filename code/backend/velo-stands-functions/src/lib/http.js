"use strict";

// Small helpers shared by every HTTP function: JSON replies with no-store
// cache headers and permissive CORS, a dedicated OPTIONS reply, a per-request
// log-line prefix, and a couple of request helpers.
//
// CORS is wide open on purpose. The read endpoints hold public counts and the
// debug endpoints are gated by not being advertised; nothing here is secret.
// POST /v1/readings is still protected by X-Api-Key, which the browser can't
// mint, so letting the browser try is harmless.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Api-Key, X-Seq, X-Device-Count",
  "Access-Control-Max-Age": "86400",
};

function reply(status, body, extraHeaders = {}) {
  return {
    status,
    jsonBody: body,
    headers: { "Cache-Control": "no-store", ...CORS_HEADERS, ...extraHeaders },
  };
}

function preflight() {
  return { status: 204, headers: { ...CORS_HEADERS } };
}

/**
 * Log lines look like "[readings 7f3c9a12] ..."; the 8 characters are the start
 * of the invocation ID, so the lines of one request belong together.
 * step() is only written when verbose (DEBUG_LOGGING) is on.
 */
function createLogger(context, name, verbose) {
  const tag = `[${name} ${String(context.invocationId ?? "local").slice(0, 8)}]`;
  return {
    step: (message) => {
      if (verbose) context.log(`${tag} ${message}`);
    },
    info: (message) => context.log(`${tag} ${message}`),
    warn: (message) => context.warn(`${tag} ${message}`),
    error: (message, err) => context.error(`${tag} ${message}${err ? `: ${err.message ?? err}` : ""}`),
  };
}

/** The caller's IP address without the port, for the log. */
function clientIp(request) {
  return (request.headers.get("x-forwarded-for") ?? "unknown")
    .split(",")[0]
    .trim()
    .replace(/^(\d+\.\d+\.\d+\.\d+):\d+$/, "$1");
}

const round = (n) => Math.round(n * 100) / 100;

module.exports = { reply, preflight, CORS_HEADERS, createLogger, clientIp, round };
