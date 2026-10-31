import { CampusMapPanel } from "./campus-map-panel";

export default function Home() {
  return (
    <main className="relative h-dvh w-full bg-zinc-50 font-sans dark:bg-black">
      <CampusMapPanel />
      <h1 className="pointer-events-none absolute left-4 top-[max(1rem,env(safe-area-inset-top))] text-2xl font-semibold tracking-tight text-black">
        Slot Invaders
      </h1>
    </main>
  );
}
