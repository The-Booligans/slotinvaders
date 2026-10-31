"use client";

import { useState } from "react";
import { rackPhotoUrl } from "@/lib/rack-photos";
import { ImageIcon, MapIcon } from "./icons";

export function RackDetails({
  id,
  name,
  onShowOnMap,
}: {
  id: string;
  name: string;
  onShowOnMap: (() => void) | null;
}) {
  const photo = rackPhotoUrl(id);
  const [failed, setFailed] = useState(false);

  return (
    <div className="mt-2 flex flex-col gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
      {photo && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- static export, images are unoptimized
        <img
          src={photo}
          alt={`Bike rack ${name}`}
          loading="lazy"
          onError={() => setFailed(true)}
          className="aspect-[4/3] w-full rounded-xl bg-slate-100 object-cover"
        />
      ) : (
        <p className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
          <ImageIcon className="size-5 shrink-0" />
          No photo available yet
        </p>
      )}
      {onShowOnMap && (
        <button
          type="button"
          onClick={onShowOnMap}
          className="flex items-center justify-center gap-2 rounded-xl bg-[#2B7EB5] px-4 py-2.5 text-sm font-semibold text-white transition active:scale-95"
        >
          <MapIcon className="size-5" />
          Show on map
        </button>
      )}
    </div>
  );
}
