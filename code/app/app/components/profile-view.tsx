import { ShieldIcon, UserIcon } from "./icons";

export function ProfileView() {
  return (
    <div className="h-full overflow-y-auto bg-slate-50 px-4 py-6">
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <section className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <div className="grid size-14 place-items-center rounded-full bg-slate-100 text-slate-500">
            <UserIcon className="size-7" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">Guest</h2>
            <p className="text-sm text-slate-500">No account needed to find a slot.</p>
          </div>
        </section>
        <section className="flex gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <ShieldIcon className="size-5 shrink-0 text-emerald-600" />
          <p className="text-sm text-slate-600">
            Stands only report how many bikes they see. No images, no tracking, no login.
          </p>
        </section>
      </div>
    </div>
  );
}
