"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DeviceImage } from "@/components/device-image";
import { DeviceLogs } from "@/components/device-logs";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/utils";
import type { DebugDeviceSummary, LogEntry } from "@/lib/schemas";

const ALL = "__all__";
const POLL_MS = 5000;

type SnapshotState =
  | { status: "loading" }
  | { status: "ready"; at: string; devices: DebugDeviceSummary[] }
  | { status: "error"; message: string };

type LogsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; entries: LogEntry[] }
  | { status: "error"; message: string };

export function DebugView() {
  const [selected, setSelected] = useState<string>(ALL);
  const [snapshot, setSnapshot] = useState<SnapshotState>({ status: "loading" });
  const [logs, setLogs] = useState<LogsState>({ status: "idle" });

  useEffect(() => {
    let active = true;
    const fetchSnapshot = async () => {
      try {
        const data = await api.debugSnapshot();
        if (!active) return;
        setSnapshot({ status: "ready", at: data.at, devices: data.devices });
      } catch (err) {
        if (!active) return;
        setSnapshot({
          status: "error",
          message: err instanceof Error ? err.message : "failed to fetch snapshot",
        });
      }
    };
    fetchSnapshot();
    const id = setInterval(fetchSnapshot, POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (selected === ALL) {
      setLogs({ status: "idle" });
      return;
    }
    let active = true;
    const fetchLogs = async () => {
      setLogs({ status: "loading" });
      try {
        const data = await api.deviceLogs(selected);
        if (!active) return;
        setLogs({ status: "ready", entries: data.entries });
      } catch (err) {
        if (!active) return;
        setLogs({
          status: "error",
          message: err instanceof Error ? err.message : "failed to fetch logs",
        });
      }
    };
    fetchLogs();
    const id = setInterval(fetchLogs, POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [selected]);

  const devices = snapshot.status === "ready" ? snapshot.devices : [];
  const selectedSummary = useMemo(
    () => devices.find((d) => d.device.id === selected) ?? null,
    [devices, selected],
  );

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-3 border-b pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Velo Stands · ESP32 debug</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Last frame and logs for the sensors in the field.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select a device" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All devices ({devices.length})</SelectItem>
              {devices.map((d) => (
                <SelectItem key={d.device.id} value={d.device.id}>
                  {d.device.id} · {d.device.hardware}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <StatusPill snapshot={snapshot} />
        </div>
      </header>

      {snapshot.status === "error" ? (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          <p className="font-medium">Cannot reach the API</p>
          <p className="mt-1 text-xs opacity-80">{snapshot.message}</p>
          <p className="mt-2 text-xs opacity-70">
            Set <code className="font-mono">NEXT_PUBLIC_API_URL</code> and make sure the Function
            App exposes <code className="font-mono">/api/v1/debug/devices</code> and{" "}
            <code className="font-mono">/api/v1/debug/devices/[id]/logs</code>.
          </p>
        </div>
      ) : null}

      {selected === ALL ? (
        <AllDevices devices={devices} loading={snapshot.status === "loading"} />
      ) : (
        <SingleDevice summary={selectedSummary} logs={logs} />
      )}
    </div>
  );
}

function StatusPill({ snapshot }: { snapshot: SnapshotState }) {
  if (snapshot.status === "loading") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-[var(--color-muted-foreground)]">
        <RefreshCw className="h-3 w-3 animate-spin" /> connecting…
      </span>
    );
  }
  if (snapshot.status === "error") {
    return <Badge variant="danger">offline</Badge>;
  }
  return (
    <span className="inline-flex items-center gap-2 text-xs text-[var(--color-muted-foreground)]">
      <span className="h-2 w-2 rounded-full bg-emerald-400" />
      updated {relativeTime(snapshot.at)}
    </span>
  );
}

function AllDevices({ devices, loading }: { devices: DebugDeviceSummary[]; loading: boolean }) {
  if (loading && devices.length === 0) {
    return <p className="text-sm text-[var(--color-muted-foreground)]">Loading devices…</p>;
  }
  if (devices.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-[var(--color-muted-foreground)]">
        No devices known to the backend yet. Add one in{" "}
        <code className="font-mono">code/backend/velo-stands-cosmos/stands.yaml</code> and redeploy.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {devices.map((summary) => (
        <DeviceImage key={summary.device.id} summary={summary} />
      ))}
    </div>
  );
}

function SingleDevice({ summary, logs }: { summary: DebugDeviceSummary | null; logs: LogsState }) {
  if (!summary) {
    return <p className="text-sm text-[var(--color-muted-foreground)]">Unknown device.</p>;
  }
  const entries = logs.status === "ready" ? logs.entries : [];
  const error = logs.status === "error" ? logs.message : null;
  const loading = logs.status === "loading";
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
      <DeviceImage summary={summary} />
      <DeviceLogs
        entries={entries}
        loading={loading}
        error={error}
        title={`Logs · ${summary.device.id}`}
      />
    </div>
  );
}
