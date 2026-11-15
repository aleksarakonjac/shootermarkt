// Skeleton detalja takmičenja: isti raspored kao page.tsx (zaglavlje, tabovi disciplina, tabela rezultata).
export default function CompetitionLoading() {
  const bar = "animate-pulse rounded-md bg-[var(--surface-2)] motion-reduce:animate-none";
  return (
    <div aria-busy="true" className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
      <div className={`${bar} h-3 w-56 mb-8`} />

      <div className="mb-6 pb-5 border-b border-[var(--border)]">
        <div className={`${bar} h-6 w-24 mb-3`} />
        <div className={`${bar} h-10 w-4/5 max-w-xl mb-4`} />
        <div className="flex flex-wrap gap-6">
          <div className={`${bar} h-5 w-40`} />
          <div className={`${bar} h-5 w-32`} />
        </div>
      </div>

      <div className={`${bar} h-7 w-32 mb-5`} />
      <div className="flex gap-2 mb-4 overflow-hidden">
        {[0, 1, 2, 3, 4].map((i) => <div key={i} className={`${bar} h-9 w-20 shrink-0`} />)}
      </div>
      <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        {["65%", "60%", "70%", "55%", "62%", "50%", "58%", "45%"].map((width, i) => (
          <div key={i} className="flex h-12 items-center px-4"><div className={`${bar} h-3`} style={{ width }} /></div>
        ))}
      </div>
    </div>
  );
}
