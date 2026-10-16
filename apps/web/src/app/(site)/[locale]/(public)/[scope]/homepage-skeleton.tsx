// Statični skeleton istog oblika kao sadržaj homepage-a (bez skoka kad stignu podaci).

export function TickerSkeleton() {
  return <div aria-busy="true" className="sk h-10 rounded-none" />;
}

function SkeletonBars({ lines }: { lines: string[] }) {
  return <div className="flex flex-col gap-2">{lines.map((width, index) => <div key={index} className="sk h-3" style={{ width }} />)}</div>;
}

export function MainSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="sk h-7 w-56" />
        <div className="sk h-4 w-20" />
      </div>
      <div className="flex min-h-64 flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2 py-4">
        <div className="sk h-4 w-2/3" />
        <div className="sk h-6 w-3/4" />
        <SkeletonBars lines={["55%", "70%", "48%", "62%"]} />
      </div>
      <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        {[0, 1, 2].map((row) => <div key={row} className="flex h-12 items-center px-4"><div className="sk h-3 w-1/2" /></div>)}
      </div>
    </div>
  );
}

export function ClubsSkeleton() {
  return (
    <div aria-busy="true" className="min-h-48 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)]">
      <div className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2"><div className="sk h-5 w-40" /></div>
      <div className="flex flex-col gap-3 p-4">{[0, 1, 2, 3].map((row) => <div key={row} className="sk h-4" style={{ width: `${90 - row * 12}%` }} />)}</div>
    </div>
  );
}
