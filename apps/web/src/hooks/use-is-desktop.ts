import { useSyncExternalStore } from "react";

const QUERY = "(min-width: 640px)";

/** true od sm breakpointa; false na serveru i pri hidrataciji (mobilni raspored je podrazumevan). */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    (cb) => {
      if (typeof window.matchMedia !== "function") return () => {};
      const mq = window.matchMedia(QUERY);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => typeof window.matchMedia === "function" && window.matchMedia(QUERY).matches,
    () => false,
  );
}
