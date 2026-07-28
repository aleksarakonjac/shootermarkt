"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function VerifyButton({ shooterId }: { shooterId: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleVerify() {
    setLoading(true);
    await fetch(`/api/admin/shooters/${shooterId}/verify`, { method: "POST" });
    router.refresh();
    setLoading(false);
  }

  return (
    <button
      onClick={handleVerify}
      disabled={loading}
      className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
    >
      {loading ? "..." : "Verifikuj"}
    </button>
  );
}
