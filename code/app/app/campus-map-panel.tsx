"use client";

import dynamic from "next/dynamic";
import type { SlotInvadersCampusMapProps } from "@slotinvaders/campus-map";

// three.js needs `window`, so keep it out of the static prerender
const SlotInvadersCampusMap = dynamic(
  () => import("@slotinvaders/campus-map").then((m) => m.SlotInvadersCampusMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-zinc-500">Loading map…</div>
    ),
  },
);

export function CampusMapPanel(props: SlotInvadersCampusMapProps) {
  return (
    <div className="h-full w-full overflow-hidden">
      <SlotInvadersCampusMap {...props} />
    </div>
  );
}
