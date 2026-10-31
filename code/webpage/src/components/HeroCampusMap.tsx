"use client";

import { useMemo } from "react";
import type { CampusMarker } from "@slotinvaders/campus-map";
import { CampusMapPanel } from "./CampusMapPanel";
import { useLiveStands } from "@/hooks/use-live-stands";
import { hasData, spotColor, toParkingSpots } from "@/lib/parking";

/**
 * Hero map wrapper that subscribes to the backend's live stand feed (same
 * `useLiveStands` the app uses) and drops a coloured, numbered pin on every
 * area with a known campus position. Decorative on the landing page — the
 * `.hero-map` wrapper has `pointer-events: none`, so the pins are read-only.
 */
export function HeroCampusMap() {
  const { message } = useLiveStands();
  const spots = useMemo(() => toParkingSpots(message?.stands ?? [], null), [message]);

  const markers = useMemo<CampusMarker[]>(
    () =>
      spots.flatMap((s) =>
        s.position
          ? [
              {
                id: s.id,
                x: s.position[0],
                y: s.position[1],
                badge: hasData(s) ? String(s.free) : "?",
                label: s.name,
                color: spotColor(s),
              },
            ]
          : [],
      ),
    [spots],
  );

  return <CampusMapPanel heroDesktop markers={markers} />;
}
