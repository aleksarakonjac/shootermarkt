import Link from "next/link";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="text-5xl font-bold tracking-tight text-zinc-900">
          Srpsko streljaštvo
          <br />
          <span className="text-zinc-500">na jednom mestu</span>
        </h1>
        <p className="mt-6 text-lg text-zinc-600 max-w-2xl mx-auto">
          Profili strelaca, rangiranje po disciplini, istorija nastupa i forma
          score algoritam — sve što trebaš da pratiš srpske strelce.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/rangiranje"
            className="rounded-md bg-zinc-900 px-6 py-3 text-white font-medium hover:bg-zinc-700 transition-colors"
          >
            Vidi rangiranje
          </Link>
          <Link
            href="/strelci"
            className="rounded-md border border-zinc-300 px-6 py-3 text-zinc-900 font-medium hover:bg-zinc-50 transition-colors"
          >
            Pretraži strelce
          </Link>
        </div>
      </div>

      <div className="mt-24 grid grid-cols-1 gap-8 sm:grid-cols-3">
        {[
          {
            title: "Discipline",
            desc: "ARM, ARW, APM, APW — vazdušna puška i pištolj, seniori i seniorke",
          },
          {
            title: "Forma score",
            desc: "Weighted average poslednjih nastupa sa trend koeficijentom",
          },
          {
            title: "Head-to-head",
            desc: "Poređenje dva strelca kroz celu karijeru",
          },
        ].map((f) => (
          <div key={f.title} className="rounded-xl border border-zinc-200 p-6">
            <h3 className="font-semibold text-zinc-900">{f.title}</h3>
            <p className="mt-2 text-sm text-zinc-600">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
