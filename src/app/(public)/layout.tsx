import Link from "next/link";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="text-xl font-bold tracking-tight">
              Shootermarkt
            </Link>
            <nav className="flex items-center gap-6 text-sm font-medium text-zinc-600">
              <Link href="/strelci" className="hover:text-zinc-900 transition-colors">
                Strelci
              </Link>
              <Link href="/rangiranje" className="hover:text-zinc-900 transition-colors">
                Rangiranje
              </Link>
              <Link href="/takmicenja" className="hover:text-zinc-900 transition-colors">
                Takmičenja
              </Link>
              <Link
                href="/portal"
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-white hover:bg-zinc-700 transition-colors"
              >
                Moj profil
              </Link>
            </nav>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-zinc-200 py-8 text-center text-sm text-zinc-500">
        © {new Date().getFullYear()} Shootermarkt · Srpsko streljaštvo
      </footer>
    </>
  );
}
