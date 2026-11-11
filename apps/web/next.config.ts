import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Dev pristup sa telefona u lokalnoj mreži (Next 16 inače blokira dev resurse sa drugih adresa).
  allowedDevOrigins: ["192.168.0.35"],
  // Slike su već optimizovane pri uploadu (avatari 300×400 WebP, Payload varijante vesti),
  // a Vercel Image Optimization free tier troše crawleri preko desetina hiljada avatara.
  images: { unoptimized: true },
};

export default withNextIntl(nextConfig);
