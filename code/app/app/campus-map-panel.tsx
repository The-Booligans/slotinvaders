"use client";

import dynamic from "next/dynamic";

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

export function CampusMapPanel() {
  return (
    <div className="h-full w-full">
      <SlotInvadersCampusMap />
    </div>
  );
}
