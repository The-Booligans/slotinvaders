"use strict";

const { createLogger, reply } = require("./http");
const { standsSnapshot } = require("./stands");

// Live stand status over Azure Web PubSub. The Function App can't hold
// WebSockets itself, so Web PubSub keeps the connections and we only send:
//
//   POST /api/v1/negotiate    -> { url }, a receive-only wss:// URL for the client
//   timer every 10 s          -> { type: "stands", at, stands } to every client
//   POST /api/v1/pubsub/events  Web PubSub calls this when a client connects;
//                               the client gets the snapshot right away instead
//                               of waiting up to 10 s for the next broadcast.
//
// The message body is the same as GET /api/v1/stands, plus `type`.

const CLIENT_TOKEN_MINUTES = 60;
const CONNECTED_EVENT = "azure.webpubsub.sys.connected";
const PUBSUB_HOST = /^[a-z0-9-]+\.webpubsub\.azure\.com$/i;

async function standsMessage({ catalogCache, stateCache, now }) {
  const [{ catalog }, { snapshot }] = await Promise.all([catalogCache.get(), stateCache.get()]);
  return { type: "stands", ...standsSnapshot({ catalog, byArea: snapshot.byArea, now: now() }) };
}

/**
 * @param {object} deps
 * @param {() => import("@azure/web-pubsub").WebPubSubServiceClient | null} deps.pubsub  null when not configured
 */
function createNegotiateHandler({ pubsub, verbose = true }) {
  return async function negotiate(_request, context) {
    const log = createLogger(context, "negotiate", verbose);
    const client = pubsub();
    if (!client) {
      log.warn("<- 503 | Web PubSub is not configured (WEBPUBSUB_CONNECTION_STRING)");
      return reply(503, { error: "live updates unavailable" });
    }
    try {
      // No roles: the client can only receive what we send.
      const { url } = await client.getClientAccessToken({ expirationTimeInMinutes: CLIENT_TOKEN_MINUTES });
      log.info("<- 200 | client URL issued");
      return reply(200, { url });
    } catch (err) {
      log.error("<- 503 | couldn't get a Web PubSub client URL", err);
      return reply(503, { error: "live updates unavailable, try again" }, { "Retry-After": "10" });
    }
  };
}

/** Timer: sends the current status of every stand to every connected client. */
function createBroadcastHandler({ pubsub, catalogCache, stateCache, now = () => new Date(), verbose = true }) {
  return async function broadcast(_timer, context) {
    const log = createLogger(context, "broadcast", verbose);
    const client = pubsub();
    if (!client) {
      log.step("Web PubSub is not configured, nothing sent");
      return;
    }
    try {
      const message = await standsMessage({ catalogCache, stateCache, now });
      await client.sendToAll(message);
      log.step(`sent ${message.stands.length} stands to all clients`);
    } catch (err) {
      log.error("broadcast failed", err);
    }
  };
}

/**
 * Web PubSub event handler (CloudEvents over HTTP). Only the `connected`
 * system event is subscribed. Anyone could post a fake event here, but the
 * worst they get is the public snapshot sent to some connection.
 */
function createEventsHandler({ pubsub, catalogCache, stateCache, now = () => new Date(), verbose = true }) {
  return async function events(request, context) {
    const log = createLogger(context, "pubsub-events", verbose);

    // Abuse protection handshake: Web PubSub asks once before sending events.
    if (request.method === "OPTIONS") {
      const origin = request.headers.get("webhook-request-origin") ?? "";
      if (!PUBSUB_HOST.test(origin)) return { status: 400 };
      return { status: 200, headers: { "WebHook-Allowed-Origin": origin } };
    }

    const type = request.headers.get("ce-type");
    const connectionId = request.headers.get("ce-connectionid");
    const client = pubsub();
    if (type !== CONNECTED_EVENT || !connectionId || !client) return { status: 204 };

    try {
      const message = await standsMessage({ catalogCache, stateCache, now });
      await client.sendToConnection(connectionId, message);
      log.step(`sent ${message.stands.length} stands to new connection ${connectionId.slice(0, 8)}`);
    } catch (err) {
      log.error(`couldn't send the snapshot to ${connectionId.slice(0, 8)}`, err);
    }
    return { status: 204 };
  };
}

module.exports = { createNegotiateHandler, createBroadcastHandler, createEventsHandler, standsMessage };
