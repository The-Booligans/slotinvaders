"use client";

import { useMemo, useState } from "react";
import type { CampusMarker } from "@slotinvaders/campus-map";
import { MOCK_USER_POSITION, hasData, spotColor, toParkingSpots, totalFree } from "@/lib/parking";
import { CampusMapPanel } from "./campus-map-panel";
import { AppHeader } from "./components/app-header";
import { BottomNav, type Tab } from "./components/bottom-nav";
import { RecenterIcon } from "./components/icons";
import { NearbyRacks } from "./components/nearby-racks";
import { ProfileView } from "./components/profile-view";
import { useLiveStands } from "./use-live-stands";

export function AppShell() {
  const { status, message } = useLiveStands();
  const spots = useMemo(() => toParkingSpots(message?.stands ?? []), [message]);
  const [tab, setTab] = useState<Tab>("map");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recenterKey, setRecenterKey] = useState(0);

  const markers = useMemo<CampusMarker[]>(
    () => [
      { id: "you", x: MOCK_USER_POSITION[0], y: MOCK_USER_POSITION[1], variant: "user" },
      ...spots.flatMap((s) =>
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
    ],
    [spots],
  );

  const recenter = () => {
    setSelectedId(null);
    setRecenterKey((k) => k + 1);
  };

  return (
    <div className="flex h-dvh w-full flex-col bg-slate-50 font-sans">
      <AppHeader freeTotal={totalFree(spots)} status={status} />

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
            <NearbyRacks
              spots={spots}
              at={message?.at ?? null}
              status={status}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>
        </div>
        {tab === "profile" && <ProfileView />}
      </main>

      <BottomNav active={tab} onChange={setTab} />
    </div>
  );
}
