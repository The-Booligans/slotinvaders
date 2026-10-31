"use client";

import dynamic from "next/dynamic";

/**
 * next/dynamic with ssr: false keeps three.js off the server — @react-three/fiber
 * reaches for `window` on import, which would break the static export otherwise.
 */
const SlotInvadersCampusMap = dynamic(
  () => import("@slotinvaders/campus-map").then((m) => m.SlotInvadersCampusMap),
  { ssr: false, loading: () => <div className="campus-map__loading">Loading map…</div> },
);

export function CampusMapPanel() {
  return (
    <div className="campus-map">
      <SlotInvadersCampusMap />
    </div>
  );
}
