import Image from "next/image";

/** Round shooter photo, or initials when there is none. `lg` is the 80px variant used in the mobile sheet. */
export function ShooterAvatar({ firstName, lastName, avatarUrl, size = "sm" }: { firstName: string; lastName: string; avatarUrl: string | null | undefined; size?: "sm" | "lg" }) {
  const lg = size === "lg";
  const box = `relative shrink-0 rounded-full ring-1 ring-[var(--border)] overflow-hidden ${lg ? "h-20 w-20" : "h-7 w-7"}`;
  if (avatarUrl) {
    return (
      <div className={box}>
        <Image src={avatarUrl} alt="" fill sizes={lg ? "80px" : "28px"} className="object-cover" />
      </div>
    );
  }
  const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
  return (
    <div className={`${box} flex items-center justify-center bg-[var(--surface-2)]`} aria-hidden="true">
      <span className={`font-bold text-[var(--muted)] ${lg ? "text-2xl" : "text-[0.6rem]"}`}>{initials}</span>
    </div>
  );
}
