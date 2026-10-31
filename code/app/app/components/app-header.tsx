import Image from "next/image";

export function AppHeader({ freeTotal }: { freeTotal: number }) {
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
        <span className="text-sm font-semibold tabular-nums text-slate-900">{freeTotal} free</span>
        <span className="flex items-center gap-1 text-[11px] font-medium text-amber-600">
          <span className="size-1.5 rounded-full bg-amber-500" />
          Demo data
        </span>
      </div>
    </header>
  );
}
