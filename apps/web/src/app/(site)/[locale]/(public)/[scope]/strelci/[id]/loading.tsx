// Skeleton profila strelca: isti raspored kao page.tsx (hero, forma grafik, istorija rezultata).
export default function ShooterProfileLoading() {
  const bar = "animate-pulse rounded-md bg-[var(--surface-2)] motion-reduce:animate-none";
  return (
    <div aria-busy="true" className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10">
      <div className={`${bar} h-3 w-40 mb-8`} />

      <div className="flex items-start gap-4 sm:gap-6 mb-5 pb-5 border-b border-[var(--border)]">
        <div className={`${bar} w-24 h-24 sm:w-28 sm:h-28 rounded-2xl shrink-0`} />
        <div className="flex-1 min-w-0 pt-1 flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className={`${bar} h-9 w-3/4 max-w-sm mb-4`} />
            <div className="flex flex-wrap gap-3">
              {[16, 24, 20].map((w, i) => <div key={i} className={`${bar} h-4`} style={{ width: `${w * 4}px` }} />)}
            </div>
          </div>
          <div className={`${bar} hidden sm:block w-56 h-28 rounded-lg shrink-0`} />
        </div>
      </div>

      <div className="mb-10">
        <div className={`${bar} h-6 w-36 mb-4`} />
        <div className={`${bar} h-64 w-full rounded-xl`} />
      </div>

      <div className="mb-10">
        <div className={`${bar} h-6 w-44 mb-4`} />
        <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          {["70%", "55%", "65%", "50%", "60%", "45%"].map((width, i) => (
            <div key={i} className="flex h-12 items-center px-4"><div className={`${bar} h-3`} style={{ width }} /></div>
          ))}
        </div>
      </div>
    </div>
  );
}
