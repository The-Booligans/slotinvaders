"use client";

import { useMemo, useState } from "react";
import type { CampusMarker } from "@slotinvaders/campus-map";
import { hasData, spotColor, toParkingSpots, totalFree } from "@/lib/parking";
import { CampusMapPanel } from "./campus-map-panel";
import { AppHeader } from "./components/app-header";
import { BottomNav, type Tab } from "./components/bottom-nav";
import { RecenterIcon } from "./components/icons";
import { NearbyRacks } from "./components/nearby-racks";
import { ProfileView } from "./components/profile-view";
import { RacksList } from "./components/racks-list";
import { useLiveStands } from "./use-live-stands";
import { useUserLocation } from "./use-user-location";
import { isOnMap, type LocationState } from "@/lib/user-location";

const LOCATION_HINT: Partial<Record<LocationState["status"], string>> = {
  denied: "Location blocked · no walking distances",
  unavailable: "Location unavailable · no walking distances",
};

export function AppShell() {
  const { status, message } = useLiveStands();
  const location = useUserLocation();
  const userPosition = location.status === "ok" ? location.position : null;
  const spots = useMemo(() => toParkingSpots(message?.stands ?? [], userPosition), [message, userPosition]);
  const [tab, setTab] = useState<Tab>("map");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recenterKey, setRecenterKey] = useState(0);

  const markers = useMemo<CampusMarker[]>(
    () => [
      ...(userPosition && isOnMap(userPosition)
        ? [{ id: "you", x: userPosition[0], y: userPosition[1], variant: "user" as const }]
        : []),
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
    [spots, userPosition],
  );
  const locationHint = LOCATION_HINT[location.status];

  const recenter = () => {
    setSelectedId(null);
    setRecenterKey((k) => k + 1);
  };

  const showOnMap = (id: string) => {
    setSelectedId(id);
    setTab("map");
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
            offset={[0, -40]}
          />
          <button
            type="button"
            onClick={recenter}
            aria-label="Show whole campus"
            className="absolute right-4 top-4 z-30 grid size-12 place-items-center rounded-full bg-white text-slate-700 shadow-lg ring-1 ring-black/5 transition hover:text-[#2B7EB5] active:scale-95"
          >
            <RecenterIcon className="size-6" />
          </button>
          {locationHint && (
            <p
              role="status"
              className="absolute left-4 top-4 z-30 max-w-[calc(100%-6rem)] rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm backdrop-blur"
            >
              {locationHint}
            </p>
          )}
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
        {tab === "list" && (
          <RacksList spots={spots} at={message?.at ?? null} status={status} onSelect={showOnMap} />
        )}
        {tab === "profile" && <ProfileView />}
      </main>

      <BottomNav active={tab} onChange={setTab} />
    </div>
  );
}
