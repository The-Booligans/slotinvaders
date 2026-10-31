import {
  formatAge,
  formatDistance,
  hasData,
  occupancyLabel,
  occupancyPercent,
  spotColor,
  walkingMinutes,
  type ParkingSpot,
} from "@/lib/parking";
import { rackPhotoUrl } from "@/lib/rack-photos";
import { BikeIcon, ImageIcon, WalkIcon } from "./icons";

export function RackCard({
  spot,
  at,
  selected,
  expanded,
  onClick,
  onShowPhoto,
}: {
  spot: ParkingSpot;
  at: string | null;
  /** omit when the card isn't part of a selectable carousel */
  selected?: boolean;
  /** set when the card toggles a details panel (list view) */
  expanded?: boolean;
  onClick: () => void;
  /** shows a photo button on the card when the rack has a photo */
  onShowPhoto?: () => void;
}) {
  const reported = hasData(spot);
  const percent = reported ? occupancyPercent(spot) : 0;
  const color = spotColor(spot);
  const ring =
    selected === undefined
      ? "shadow-sm ring-black/5"
      : selected
        ? "scale-100 shadow-lg ring-2 ring-[#2B7EB5]"
        : "scale-95 shadow-lg ring-black/5";

  const showPhotoButton = onShowPhoto !== undefined && rackPhotoUrl(spot.id) !== null;

  return (
    <div className="relative">
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-expanded={expanded}
      className={`w-full rounded-2xl bg-white p-4 text-left ring-1 transition-all ${ring}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-slate-900">{spot.name}</h3>
          <p className="truncate text-xs text-slate-500">{spot.capacity} slots</p>
        </div>
        <span
          className="grid size-9 shrink-0 place-items-center rounded-full text-white"
          style={{ backgroundColor: color }}
        >
          <BikeIcon className="size-5" />
        </span>
      </div>

      <p className="mt-3 flex items-baseline gap-1.5">
        <span className="text-3xl font-bold tabular-nums" style={{ color }}>
          {reported ? `${percent}%` : "–"}
        </span>
        <span className="text-sm font-medium text-slate-600">
          {reported ? occupancyLabel(percent) : "no data yet"}
        </span>
      </p>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: color }} />
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
        <span className="font-medium tabular-nums text-slate-900">
          {!reported ? `${spot.capacity} slots` : spot.free === 0 ? "No free slots" : `${spot.free} free`}
        </span>
        {spot.position === null ? (
          <span>Not on the map yet</span>
        ) : spot.distanceM === null ? null : (
          <span className="flex items-center gap-1">
            <WalkIcon className="size-3.5" />
            {formatDistance(spot.distanceM)} · {walkingMinutes(spot.distanceM)} min
          </span>
        )}
      </div>

      <Freshness spot={spot} at={at} padRight={showPhotoButton} />
    </button>
    {showPhotoButton && (
      <button
        type="button"
        onClick={onShowPhoto}
        aria-label={`Show photo of ${spot.name}`}
        className="absolute bottom-2.5 right-3 grid size-8 place-items-center rounded-full bg-slate-100 text-slate-700 transition hover:text-[#2B7EB5] active:scale-95"
      >
        <ImageIcon className="size-4" />
      </button>
    )}
    </div>
  );
}

function Freshness({
  spot,
  at,
  padRight,
}: {
  spot: ParkingSpot;
  at: string | null;
  padRight: boolean;
}) {
  const age = spot.updatedAt && at ? formatAge(spot.updatedAt, at) : null;
  const [text, tone] = !spot.updatedAt
    ? ["No sensor data yet", "text-slate-400"]
    : spot.stale
      ? [`Some sensors offline · updated ${age}`, "text-amber-600"]
      : [`Updated ${age}`, "text-emerald-600"];
  return <p className={`mt-2 truncate text-[11px] font-medium ${tone} ${padRight ? "pr-10" : ""}`}>{text}</p>;
}
