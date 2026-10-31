import Image from "next/image";
import type { LiveStatus } from "@/lib/live-stands";

const STATUS: Record<LiveStatus, { label: string; text: string; dot: string }> = {
  live: { label: "Live", text: "text-emerald-600", dot: "bg-emerald-500" },
  connecting: { label: "Connecting…", text: "text-amber-600", dot: "bg-amber-500" },
  offline: { label: "Offline", text: "text-red-600", dot: "bg-red-500" },
};

export function AppHeader({ freeTotal, status }: { freeTotal: number | null; status: LiveStatus }) {
  const { label, text, dot } = STATUS[status];
  return (
    <header className="z-30 flex items-center gap-3 border-b border-black/5 bg-white/90 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-md">
      <Image
        src="/icon.png"
        alt=""
        width={36}
        height={36}
        priority
        className="size-9 rounded-xl shadow-sm"
      />
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-semibold leading-tight tracking-tight text-slate-900">
          Slot Invaders
        </h1>
        <p className="truncate text-xs text-slate-500">E+H Campus Reinach</p>
      </div>
      <div className="flex flex-col items-end">
        <span className="text-sm font-semibold tabular-nums text-slate-900">
          {freeTotal === null ? "–" : freeTotal} free
        </span>
        <span role="status" className={`flex items-center gap-1 text-[11px] font-medium ${text}`}>
          <span className={`size-1.5 rounded-full ${dot}`} />
          {label}
        </span>
      </div>
    </header>
  );
}
