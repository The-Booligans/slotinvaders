"use strict";

// Small helpers that are shared by every HTTP function: a reply builder with
// no-store cache headers and permissive CORS, plus a dedicated OPTIONS reply.
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

module.exports = { reply, preflight, CORS_HEADERS };
