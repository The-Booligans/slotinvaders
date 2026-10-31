"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

/**
 * next/dynamic with ssr: false keeps three.js off the server — @react-three/fiber
 * reaches for `window` on import, which would break the static export otherwise.
 */
const SlotInvadersCampusMap = dynamic(
  () => import("@slotinvaders/campus-map").then((m) => m.SlotInvadersCampusMap),
  { ssr: false, loading: () => <div className="campus-map__loading">Loading map…</div> },
);

interface Props {
  /** On desktop, shift the orbit target west so the island reads to the right
      of the hero (away from the white card on the left). */
  heroDesktop?: boolean;
  /** Show the live camera-dir HUD so you can orbit the map and read the numbers off */
  debug?: boolean;
}

export function CampusMapPanel({ heroDesktop = false, debug = false }: Props) {
  const [wide, setWide] = useState(false);

  useEffect(() => {
    if (!heroDesktop || typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(min-width: 820px)");
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [heroDesktop]);

  // in debug mode, pivot around the island centre so rotation is natural;
  // offline, shift it so the island sits to the right of the hero card
  const offset = !debug && wide ? ([-170, 0] as [number, number]) : undefined;

  return (
    <div className="campus-map">
      <SlotInvadersCampusMap offset={offset} debug={debug} />
    </div>
  );
}
