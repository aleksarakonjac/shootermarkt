// Zajednički skeleton za sve javne strane: prikazuje se odmah pri navigaciji dok server dovlači podatke.
export default function ScopeLoading() {
  const bar = "animate-pulse rounded-md bg-[var(--surface-2)] motion-reduce:animate-none";
  return (
    <div aria-busy="true" className="mx-auto flex max-w-7xl flex-col gap-6 px-4 pt-5 pb-8 sm:px-6 lg:px-8">
      <div className={`${bar} h-8 w-64`} />
      <div className="flex gap-3">{[0, 1, 2].map((i) => <div key={i} className={`${bar} h-9 w-28`} />)}</div>
      <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        {["60%", "45%", "70%", "50%", "65%", "40%", "55%", "62%"].map((width, i) => (
          <div key={i} className="flex h-12 items-center px-4"><div className={`${bar} h-3`} style={{ width }} /></div>
        ))}
      </div>
    </div>
  );
}
