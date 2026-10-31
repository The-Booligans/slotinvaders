"use client";

import { useEffect, useState } from "react";
import { busyLevel, fetchRack, occupancy, type BusyLevel, type Rack } from "@/lib/rack";

const LEVEL_STYLE: Record<BusyLevel, { label: string; bar: string; text: string }> = {
  quiet: { label: "Plenty of space", bar: "bg-emerald-400 shadow-[0_0_12px_#34d399]", text: "text-emerald-400" },
  moderate: { label: "Filling up", bar: "bg-lime-400 shadow-[0_0_12px_#a3e635]", text: "text-lime-400" },
  busy: { label: "Almost full", bar: "bg-amber-400 shadow-[0_0_12px_#fbbf24]", text: "text-amber-400" },
  full: { label: "Full", bar: "bg-rose-500 shadow-[0_0_12px_#f43f5e]", text: "text-rose-500" },
};

export function RackCard() {
  const [rack, setRack] = useState<Rack | null>(null);

  useEffect(() => {
    fetchRack().then(setRack);
  }, []);

  if (!rack) {
    return <div className="h-56 w-full max-w-sm animate-pulse rounded-3xl bg-zinc-900" />;
  }

  const percent = occupancy(rack);
  const style = LEVEL_STYLE[busyLevel(percent)];
  const free = Math.max(rack.totalSlots - rack.occupiedSlots, 0);
  const time = new Date(rack.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <section className="w-full max-w-sm rounded-3xl bg-zinc-950 p-6 shadow-[0_0_40px_-10px_rgba(52,211,153,0.35)] ring-1 ring-emerald-500/30">
      <h2 className="text-lg font-semibold text-zinc-50">{rack.name}</h2>
      <p className="mt-1 text-sm text-zinc-400">{rack.address}</p>

      <div className="mt-6 flex items-baseline justify-between">
        <span className={`font-mono text-sm font-medium ${style.text}`}>{style.label}</span>
        <span className="font-mono text-3xl font-semibold tabular-nums text-zinc-50">{percent}%</span>
      </div>

      <div
        role="progressbar"
        aria-label="Rack occupancy"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="mt-2 h-3 w-full overflow-hidden rounded-full bg-zinc-800"
      >
        <div className={`h-full rounded-full ${style.bar} transition-all duration-700`} style={{ width: `${percent}%` }} />
      </div>

      <div className="mt-4 flex justify-between font-mono text-xs text-zinc-500">
        <span>
          <strong className="text-emerald-400">{free}</strong> of {rack.totalSlots} slots free
        </span>
        <span>Updated {time}</span>
      </div>
    </section>
  );
}
