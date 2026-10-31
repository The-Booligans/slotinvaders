import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connectLiveStands, retryDelayMs, type LiveStatus } from "./live-stands";
import type { StandsMessage } from "./stands-api";

class FakeSocket {
  static all: FakeSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  closed = false;
  constructor(public url: string) {
    FakeSocket.all.push(this);
  }
  close() {
    this.closed = true;
  }
}

const message: StandsMessage = { type: "stands", at: "2026-10-31T14:48:35.910Z", stands: [] };

function setup(responses: Array<{ ok: boolean; url?: string }>) {
  const statuses: LiveStatus[] = [];
  const received: StandsMessage[] = [];
  const fetchImpl = vi.fn(async () => {
    const r = responses.shift() ?? { ok: true, url: "wss://next" };
    return { ok: r.ok, status: r.ok ? 200 : 503, json: async () => ({ url: r.url }) } as Response;
  });
  const stop = connectLiveStands({
    apiUrl: "https://api.test",
    onStands: (m) => received.push(m),
    onStatus: (s) => statuses.push(s),
    fetchImpl,
    WebSocketImpl: FakeSocket as unknown as typeof WebSocket,
  });
  return { statuses, received, fetchImpl, stop };
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeSocket.all = [];
});
afterEach(() => vi.useRealTimers());

describe("connectLiveStands", () => {
  it("negotiates, opens the socket and passes stands messages on", async () => {
    const t = setup([{ ok: true, url: "wss://first" }]);
    await vi.waitFor(() => expect(FakeSocket.all).toHaveLength(1));
    expect(t.fetchImpl).toHaveBeenCalledWith("https://api.test/api/v1/negotiate", { method: "POST" });
    const ws = FakeSocket.all[0];
    expect(ws.url).toBe("wss://first");

    ws.onopen?.();
    ws.onmessage?.({ data: JSON.stringify(message) });
    ws.onmessage?.({ data: "garbage" });
    expect(t.statuses).toEqual(["live"]);
    expect(t.received).toEqual([message]);
  });

  it("reconnects with a fresh negotiate after the socket drops", async () => {
    const t = setup([{ ok: true, url: "wss://first" }, { ok: true, url: "wss://second" }]);
    await vi.waitFor(() => expect(FakeSocket.all).toHaveLength(1));
    FakeSocket.all[0].onclose?.();
    expect(t.statuses).toEqual(["offline"]);

    await vi.advanceTimersByTimeAsync(retryDelayMs(0));
    expect(FakeSocket.all.map((s) => s.url)).toEqual(["wss://first", "wss://second"]);
    expect(t.statuses).toEqual(["offline", "connecting"]);
  });

  it("retries a failed negotiate with growing delays", async () => {
    const t = setup([{ ok: false }, { ok: false }, { ok: true, url: "wss://third" }]);
    await vi.advanceTimersByTimeAsync(0);
    expect(t.statuses).toEqual(["offline"]);
    await vi.advanceTimersByTimeAsync(999);
    expect(t.fetchImpl).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(t.fetchImpl).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1999);
    expect(t.fetchImpl).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(FakeSocket.all.map((s) => s.url)).toEqual(["wss://third"]);
  });

  it("stops: closes the socket and doesn't reconnect", async () => {
    const t = setup([{ ok: true, url: "wss://first" }]);
    await vi.waitFor(() => expect(FakeSocket.all).toHaveLength(1));
    t.stop();
    expect(FakeSocket.all[0].closed).toBe(true);
    FakeSocket.all[0].onclose?.();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(t.fetchImpl).toHaveBeenCalledTimes(1);
    expect(t.statuses).toEqual([]);
  });

  it("caps the retry delay at 30 s", () => {
    expect([0, 1, 4, 10].map(retryDelayMs)).toEqual([1000, 2000, 16000, 30000]);
  });
});
