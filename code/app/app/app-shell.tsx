"use client";

import { useMemo, useState } from "react";
import type { CampusMarker } from "@slotinvaders/campus-map";
import {
  LEVEL_COLOR,
  MOCK_USER_POSITION,
  nearbySpots,
  occupancyLevel,
  occupancyPercent,
} from "@/lib/parking";
import { CampusMapPanel } from "./campus-map-panel";
import { AppHeader } from "./components/app-header";
import { BottomNav, type Tab } from "./components/bottom-nav";
import { RecenterIcon } from "./components/icons";
import { NearbyRacks } from "./components/nearby-racks";
import { ProfileView } from "./components/profile-view";

export function AppShell() {
  const spots = useMemo(() => nearbySpots(), []);
  const [tab, setTab] = useState<Tab>("map");
  const [selectedId, setSelectedId] = useState<string | null>(spots[0]?.id ?? null);
  const [recenterKey, setRecenterKey] = useState(0);

  const markers = useMemo<CampusMarker[]>(
    () => [
      { id: "you", x: MOCK_USER_POSITION[0], y: MOCK_USER_POSITION[1], variant: "user" },
      ...spots.map((s) => ({
        id: s.id,
        x: s.x,
        y: s.y,
        badge: String(s.free),
        label: s.name,
        color: LEVEL_COLOR[occupancyLevel(occupancyPercent(s))],
      })),
    ],
    [spots],
  );

  const recenter = () => {
    setSelectedId(null);
    setRecenterKey((k) => k + 1);
  };

  return (
    <div className="flex h-dvh w-full flex-col bg-slate-50 font-sans">
      <AppHeader freeTotal={spots.reduce((sum, s) => sum + s.free, 0)} />

      <main className="relative min-h-0 flex-1">
        {/* keep the map mounted so the WebGL scene isn't rebuilt on tab switches */}
        <div className={`absolute inset-0 ${tab === "map" ? "" : "invisible"}`}>
          <CampusMapPanel
            markers={markers}
            selectedMarkerId={selectedId}
            onMarkerSelect={setSelectedId}
            recenterKey={recenterKey}
          />
          <button
            type="button"
            onClick={recenter}
            aria-label="Show whole campus"
            className="absolute right-4 top-4 z-30 grid size-12 place-items-center rounded-full bg-white text-slate-700 shadow-lg ring-1 ring-black/5 transition hover:text-[#2B7EB5] active:scale-95"
          >
            <RecenterIcon className="size-6" />
          </button>
          <div className="absolute inset-x-0 bottom-0 z-30">
            <NearbyRacks spots={spots} selectedId={selectedId} onSelect={setSelectedId} />
          </div>
        </div>
        {tab === "profile" && <ProfileView />}
      </main>

      <BottomNav active={tab} onChange={setTab} />
    </div>
  );
}
