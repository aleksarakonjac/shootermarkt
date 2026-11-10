import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Dev pristup sa telefona u lokalnoj mreži (Next 16 inače blokira dev resurse sa drugih adresa).
  allowedDevOrigins: ["192.168.0.35"],
  // Slike su već optimizovane pri uploadu (avatari 300×400 WebP, Payload varijante vesti),
  // a Vercel Image Optimization free tier troše crawleri preko desetina hiljada avatara.
  images: { unoptimized: true },
  // FREEZE (privremeno, do resetovanja Supabase perioda ~25. nov 2026): baza može biti nedostupna,
  // pa Vercel CDN drži dinamične stranice i javne API odgovore dan, a staru verziju servira još 30 dana
  // dok pokušava osvežavanje u pozadini. Vratiti `git revert`-om ovog commita kad se baza vrati.
  async headers() {
    const freeze = [{ key: "CDN-Cache-Control", value: "public, max-age=86400, stale-while-revalidate=2592000" }];
    return [
      { source: "/:locale/:scope/(rangiranje|takmicenja|strelci|vesti|head-to-head)", headers: freeze },
      { source: "/api/(homepage|news|calendar|search|h2h|shooters|cms)/:path*", headers: freeze },
    ];
  },
};

export default withNextIntl(nextConfig);
