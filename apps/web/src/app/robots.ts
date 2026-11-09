import type { MetadataRoute } from "next";

// AI crawleri renderuju hiljade nekeširanih profila strelaca (Amazonbot: ~4.6k zahteva za 12h)
// i troše Vercel Active CPU. Pretraživači i AI asistenti (ChatGPT-User, Perplexity-User —
// otvaraju stranicu tek kad korisnik pita) ostaju dozvoljeni, admin/API nikome.
const AI_BOTS = [
  "Amazonbot",
  "GPTBot",
  "OAI-SearchBot",
  "ClaudeBot",
  "anthropic-ai",
  "CCBot",
  "Bytespider",
  "meta-externalagent",
  "PerplexityBot",
  "Google-Extended",
  "Applebot-Extended",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: AI_BOTS, disallow: "/" },
      { userAgent: "*", allow: "/", disallow: ["/admin", "/api/"], crawlDelay: 5 },
    ],
  };
}
