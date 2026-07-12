import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Barlow_Condensed, JetBrains_Mono } from "next/font/google";
import { routing } from "@/i18n/routing";
import "../globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Shootermarkt", template: "%s | Shootermarkt" },
  description: "Platforma za praćenje rezultata i profila srpskih strelaca",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // No locale API calls here on purpose: this layout wraps both /admin (no locale
  // concept) and /[locale]/* (public). Reading locale this high in the tree forces
  // every page dynamic, since [locale]/layout.tsx hasn't resolved requestLocale yet
  // by the time this renders. The actual <html lang> is patched client-side inside
  // [locale]/layout.tsx once the real locale is known.
  return (
    <html
      lang={routing.defaultLocale}
      className={`${plusJakarta.variable} ${barlowCondensed.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-dvh flex flex-col bg-[var(--bg)] text-[var(--ink)]">
        {children}
      </body>
    </html>
  );
}
