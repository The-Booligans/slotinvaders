type Status = "ok" | "low" | "full";

type Stand = {
  name: string;
  free: number;
  total: number;
  status: Status;
};

const stands: Stand[] = [
  { name: "Haupteingang", free: 12, total: 20, status: "ok" },
  { name: "Reinach-Süd", free: 7, total: 15, status: "ok" },
  { name: "Reinach-Nord", free: 3, total: 18, status: "low" },
  { name: "Werkseingang", free: 0, total: 12, status: "full" },
  { name: "Besucher", free: 9, total: 10, status: "ok" },
  { name: "Kantine", free: 4, total: 8, status: "ok" },
];

function AreaRow({ stand }: { stand: Stand }) {
  const occupied = stand.total - stand.free;
  const pct = Math.round((occupied / stand.total) * 100);
  const barClass =
    stand.status === "full"
      ? "area-row__bar area-row__bar--red"
      : stand.status === "low"
        ? "area-row__bar area-row__bar--amber"
        : "area-row__bar";
  const chipClass =
    stand.status === "full"
      ? "chip chip--full"
      : stand.status === "low"
        ? "chip chip--low"
        : "chip chip--ok";
  const chipLabel = stand.status === "full" ? "Full" : stand.status === "low" ? "• Low" : "• OK";
  const countLabel =
    stand.status === "full"
      ? `${stand.free} / ${stand.total}`
      : `${stand.free} / ${stand.total} free`;

  return (
    <div className="area-row">
      <div className="area-row__icon">
        <svg aria-hidden="true">
          <use href="#bike" />
        </svg>
      </div>
      <div className="area-row__main">
        <div className="area-row__name">
          {stand.name}
          <span className="area-row__count">{countLabel}</span>
        </div>
        <div className={barClass}>
          <span style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="area-row__status">
        <span className={chipClass}>{chipLabel}</span>
      </div>
    </div>
  );
}

export function StandList() {
  return (
    <div className="panel" aria-label="Live stand list">
      <div className="panel-body">
        {stands.map((stand) => (
          <AreaRow key={stand.name} stand={stand} />
        ))}
      </div>
    </div>
  );
}
