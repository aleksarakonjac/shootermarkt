// Next.js augments the standard fetch RequestInit with a `next` cache-control option.
// These adapters run inside Next.js apps (apps/web, apps/ingest) where this option is
// honored at runtime; this declaration keeps typechecking happy for a plain library.
export {};

declare global {
  interface RequestInit {
    next?: { revalidate?: number | false; tags?: string[] };
  }
}
