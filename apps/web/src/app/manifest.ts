import type { MetadataRoute } from "next";

// Web app manifest: "Dodaj na početni ekran" (Android/desktop). iOS koristi app/apple-icon.png.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Shootermarkt",
    short_name: "Shootermarkt",
    description: "Platforma za praćenje rezultata i profila srpskih strelaca",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
