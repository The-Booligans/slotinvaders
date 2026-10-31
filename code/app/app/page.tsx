import { RackCard } from "./rack-card";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-black px-6 font-sans">
      <header className="text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-emerald-400">&gt; slot_invaders</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-50">Available racks near you</h1>
      </header>
      <RackCard />
    </main>
  );
}
