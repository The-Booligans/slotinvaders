import type { ComponentType, SVGProps } from "react";
import { ListIcon, MapIcon, UserIcon } from "./icons";

export type Tab = "map" | "list" | "profile";

const TABS: { id: Tab; label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { id: "map", label: "Map", Icon: MapIcon },
  { id: "list", label: "List", Icon: ListIcon },
  { id: "profile", label: "Profile", Icon: UserIcon },
];

export function BottomNav({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  return (
    <nav className="z-30 grid grid-cols-3 border-t border-black/5 bg-white pb-[env(safe-area-inset-bottom)]">
      {TABS.map(({ id, label, Icon }) => {
        const selected = id === active;
        return (
          <button
            key={id}
            type="button"
            aria-current={selected ? "page" : undefined}
            onClick={() => onChange(id)}
            className={`flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors ${
              selected ? "text-[#2B7EB5]" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <span
              className={`grid h-8 w-14 place-items-center rounded-full transition-colors ${
                selected ? "bg-[#2B7EB5]/12" : ""
              }`}
            >
              <Icon className="size-5" />
            </span>
            {label}
          </button>
        );
      })}
    </nav>
  );
}
