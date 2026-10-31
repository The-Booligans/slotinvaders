import { parseStandsMessage, type StandsMessage } from "./stands-api";

export type LiveStatus = "connecting" | "live" | "offline";

interface LiveStandsOptions {
  apiUrl: string;
  onStands: (message: StandsMessage) => void;
  onStatus: (status: LiveStatus) => void;
  fetchImpl?: typeof fetch;
  WebSocketImpl?: typeof WebSocket;
}

const MAX_RETRY_MS = 30_000;

export function retryDelayMs(attempt: number): number {
  return Math.min(MAX_RETRY_MS, 1000 * 2 ** attempt);
}

/**
 * Asks the API for a Web PubSub URL, opens the WebSocket and reconnects with
 * backoff whenever it drops. The client URL expires, so every reconnect
 * negotiates again. Returns a function that stops everything.
 */
export function connectLiveStands({
  apiUrl,
  onStands,
  onStatus,
  fetchImpl = (...args) => fetch(...args),
  WebSocketImpl = WebSocket,
}: LiveStandsOptions): () => void {
  let stopped = false;
  let attempt = 0;
  let socket: WebSocket | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  const retry = () => {
    if (stopped) return;
    onStatus("offline");
    retryTimer = setTimeout(start, retryDelayMs(attempt++));
  };

  async function negotiate(): Promise<string> {
    const res = await fetchImpl(`${apiUrl}/api/v1/negotiate`, { method: "POST" });
    if (!res.ok) throw new Error(`negotiate → ${res.status}`);
    const { url } = (await res.json()) as { url?: unknown };
    if (typeof url !== "string") throw new Error("negotiate: no url");
    return url;
  }

  async function start() {
    if (attempt > 0) onStatus("connecting");
    let url: string;
    try {
      url = await negotiate();
    } catch {
      retry();
      return;
    }
    if (stopped) return;

    const ws = new WebSocketImpl(url);
    socket = ws;
    ws.onopen = () => {
      attempt = 0;
      onStatus("live");
    };
    ws.onmessage = (event) => {
      if (typeof event.data !== "string") return;
      const message = parseStandsMessage(event.data);
      if (message) onStands(message);
    };
    ws.onclose = () => {
      if (socket === ws) socket = null;
      retry();
    };
  }

  void start();

  return () => {
    stopped = true;
    clearTimeout(retryTimer);
    socket?.close();
    socket = null;
  };
}
