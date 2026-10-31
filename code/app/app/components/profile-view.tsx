import {
  averageDaysPerWeek,
  co2SavedKg,
  DEMO_PROFILE,
  leaderboardRank,
  topPercent,
} from "@/lib/profile-demo";
import { BikeIcon, ShieldIcon, UserIcon } from "./icons";

const CARD = "rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5";
const BRAND = "#2B7EB5";

export function ProfileView() {
  return (
    <div className="h-full overflow-y-auto bg-slate-50 px-4 py-6">
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <GuestCard />
        <PrivacyCard />
        <PreviewDivider />
        <DemoProfile />
        <OptInCard />
      </div>
    </div>
  );
}

function GuestCard() {
  return (
    <section className={`flex items-center gap-4 ${CARD}`}>
      <div className="grid size-14 place-items-center rounded-full bg-slate-100 text-slate-500">
        <UserIcon className="size-7" />
      </div>
      <div>
        <h2 className="font-semibold text-slate-900">Guest</h2>
        <p className="text-sm text-slate-500">No account needed to find a slot.</p>
      </div>
    </section>
  );
}

function PrivacyCard() {
  return (
    <section className={`flex gap-3 ${CARD}`}>
      <ShieldIcon className="size-5 shrink-0 text-emerald-600" />
      <p className="text-sm text-slate-600">
        Stands only report how many bikes they see. No images, no tracking, no login.
      </p>
    </section>
  );
}

function PreviewDivider() {
  return (
    <div className="mt-2 flex flex-col items-center gap-1 text-center">
      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
        Preview · coming soon
      </span>
      <p className="text-sm text-slate-500">
        A peek at what an optional rider profile could look like. Sample data only.
      </p>
    </div>
  );
}

function DemoProfile() {
  const p = DEMO_PROFILE;
  const rank = leaderboardRank(p.leaderboard) ?? p.leaderboard.length;

  return (
    <div aria-label="Sample rider profile" className="flex flex-col gap-4">
      <section className={`flex items-center gap-4 ${CARD}`}>
        <DemoAvatar />
        <div className="min-w-0">
          <h2 className="font-semibold text-slate-900">{p.name}</h2>
          <p className="text-sm text-slate-500">Riding since {p.memberSince}</p>
          <p className="mt-1 text-sm font-medium text-orange-600">🔥 {p.streakDays}-day streak</p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <Stat value={String(p.totalRides)} label="Rides since joining" />
        <Stat value={`${averageDaysPerWeek(p.weeklyBikeDays)}`} label="Bike days / week (avg)" />
        <Stat value={`#${rank}`} label={`Top ${topPercent(rank, p.registeredRiders)} % of ${p.registeredRiders} riders`} />
        <Stat value={`${co2SavedKg(p.totalRides, p.kmPerRide)} kg`} label="CO₂ saved vs. car" />
      </section>

      <WeeklyChart weeks={p.weeklyBikeDays} />
      <Leaderboard />
      <Badges />
    </div>
  );
}

function DemoAvatar() {
  return (
    <div className="relative shrink-0">
      <svg viewBox="0 0 56 56" className="size-14 rounded-full" role="img" aria-label="Sample avatar">
        <defs>
          <linearGradient id="avatar-bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#7DD3FC" />
            <stop offset="1" stopColor={BRAND} />
          </linearGradient>
        </defs>
        <rect width="56" height="56" fill="url(#avatar-bg)" />
        <path d="M10 56c2-11 9-16 18-16s16 5 18 16Z" fill="#F97316" />
        <circle cx="28" cy="25" r="10" fill="#FCD9B6" />
        <path d="M17 23a11 11 0 0 1 22 0v1H17Z" fill="#334155" />
        <rect x="16" y="22" width="24" height="3" rx="1.5" fill="#1E293B" />
        <circle cx="24.5" cy="27" r="1.2" fill="#1E293B" />
        <circle cx="31.5" cy="27" r="1.2" fill="#1E293B" />
        <path d="M24.5 31q3.5 2.5 7 0" stroke="#1E293B" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      </svg>
      <span className="absolute -right-1 -bottom-1 grid size-6 place-items-center rounded-full bg-white text-[#2B7EB5] shadow ring-1 ring-black/5">
        <BikeIcon className="size-4" />
      </span>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className={CARD}>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function WeeklyChart({ weeks }: { weeks: number[] }) {
  return (
    <section className={CARD}>
      <h3 className="text-sm font-semibold text-slate-900">Bike days per week</h3>
      <p className="text-xs text-slate-500">Last {weeks.length} weeks</p>
      <div className="mt-3 flex h-24 items-end gap-2">
        {weeks.map((days, i) => (
          <div key={i} className="flex h-full flex-1 flex-col items-center gap-1">
            <div className="flex w-full flex-1 items-end">
              <div
                className="w-full rounded-t-md"
                style={{ height: `${(days / 5) * 100}%`, backgroundColor: BRAND, opacity: 0.4 + (i / weeks.length) * 0.6 }}
                title={`${days} of 5 days`}
              />
            </div>
            <span className="text-[10px] text-slate-400">{days}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Leaderboard() {
  const sorted = [...DEMO_PROFILE.leaderboard].sort((a, b) => b.rides - a.rides);
  return (
    <section className={CARD}>
      <h3 className="text-sm font-semibold text-slate-900">Campus leaderboard</h3>
      <ol className="mt-2 flex flex-col gap-1">
        {sorted.map((entry, i) => (
          <li
            key={entry.name}
            className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-sm ${
              entry.isYou ? "bg-[#2B7EB5]/10 font-semibold text-[#2B7EB5]" : "text-slate-700"
            }`}
          >
            <span>
              {["🥇", "🥈", "🥉"][i] ?? `${i + 1}.`} {entry.isYou ? "You" : entry.name}
            </span>
            <span className="tabular-nums">{entry.rides} rides</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Badges() {
  return (
    <section className={CARD}>
      <h3 className="text-sm font-semibold text-slate-900">Badges</h3>
      <ul className="mt-2 flex flex-wrap gap-2">
        {DEMO_PROFILE.badges.map((badge) => (
          <li
            key={badge.label}
            className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
              badge.earned ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400 grayscale"
            }`}
          >
            <span aria-hidden="true">{badge.emoji}</span>
            {badge.label}
          </li>
        ))}
      </ul>
    </section>
  );
}

const OPT_IN_POINTS = [
  "The app and the map work fully without an account.",
  "Tracking is strictly opt-in: nothing is recorded until you sign up.",
  "Only your own ride count is stored. No GPS trails, no photos.",
  "Pause tracking or delete your profile and all its data anytime.",
];

function OptInCard() {
  return (
    <section className={`${CARD} mb-2`}>
      <div className="flex items-center gap-2">
        <ShieldIcon className="size-5 text-emerald-600" />
        <h3 className="text-sm font-semibold text-slate-900">100 % optional</h3>
      </div>
      <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-slate-600">
        {OPT_IN_POINTS.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <button
        type="button"
        disabled
        className="mt-4 w-full cursor-not-allowed rounded-xl bg-[#2B7EB5] py-2.5 text-sm font-semibold text-white opacity-60"
      >
        Start tracking · coming soon
      </button>
    </section>
  );
}
