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
      {
        userAgent: "*",
        allow: "/",
        // Profil strelca je isti u oba scope-a (canonical → /srb/); issf kopija samo duplira ISR writes.
        // /rezultati je puna tabela istog strelca — za pretragu dovoljan je profil, a crawl bi dupliran trošio CPU i ISR writes.
        disallow: ["/admin", "/api/", "/ioc/", "/*/issf/strelci/", "/*/strelci/*/rezultati"],
        crawlDelay: 5,
      },
    ],
  };
}
