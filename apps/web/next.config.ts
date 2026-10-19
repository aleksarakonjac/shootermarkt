import type { NextConfig } from "next";
import { withPayload } from "@payloadcms/next/withPayload";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Dev pristup sa telefona u lokalnoj mreži (Next 16 inače blokira dev resurse sa drugih adresa).
  allowedDevOrigins: ["192.168.0.35"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ywbwbbsplasilaiaduxk.supabase.co",
        pathname: "/storage/v1/**",
      },
    ],
  },
};

export default withPayload(withNextIntl(nextConfig), { devBundleServerPackages: false });
