import { revalidatePath } from "next/cache";
import { routing } from "@/i18n/routing";
import { VALID_SCOPES } from "@/lib/scope";

// Javne stranice su ISR (revalidate u page.tsx). Posle upisa u bazu briše se keš odmah,
// inače bi izmena čekala da revalidate istekne.

const PUBLIC_ROOT = "/(site)/[locale]/(public)/[scope]";
// Sve javne stranice osim profila strelaca. Profila ima ~39k × 2 jezika × 2 scope-a × 2 stranice (profil + rezultati):
// brisanje celog keša posle svake admin izmene teralo je crawlere da ponovo renderuju ~300k stranica
// (Active CPU + ISR writes, oba su probila Hobby limit). Profili se brišu ciljano — revalidateShooterPages.
const PUBLIC_PAGES = ["", "/rangiranje", "/head-to-head", "/kalendar", "/vesti", "/vesti/[slug]", "/strelci", "/takmicenja", "/takmicenja/[id]"];

/** Javni sajt bez profila strelaca. Za admin, import i CMS upise. */
export function revalidatePublicSite() {
  for (const page of PUBLIC_PAGES) revalidatePath(`${PUBLIC_ROOT}${page}`, "page");
}

/**
 * Profili (i /rezultati) datih strelaca. Poziva se iz recomputeFormaCache, kroz koji prolazi svaka izmena rezultata,
 * i iz admin ruta za izmenu strelca. Ostali profili osvežavaju se dnevnim revalidate-om.
 */
export function revalidateShooterPages(shooterIds: Iterable<number>) {
  try {
    for (const id of shooterIds) {
      for (const locale of routing.locales) {
        for (const scope of VALID_SCOPES) {
          revalidatePath(`/${locale}/${scope}/strelci/${id}`);
          revalidatePath(`/${locale}/${scope}/strelci/${id}/rezultati`);
        }
      }
    }
  } catch (error) {
    // CLI skripte (db:recompute-forma) nemaju Next request kontekst — tamo nema keša za brisanje.
    if (!String(error).includes("static generation store")) throw error;
  }
}

/** Admin ruta /shooters/[id]/…: posle uspešnog odgovora briše javni sajt i profil tog strelca. */
export function revalidatesShooterRoute<A extends [unknown, { params: Promise<{ id: string }> }]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    const response = await handler(...args);
    if (response.ok) {
      revalidatePublicSite();
      const id = Number((await args[1].params).id);
      if (Number.isInteger(id)) revalidateShooterPages([id]);
    }
    return response;
  };
}

/** Admin route handler: posle uspešnog odgovora (2xx) briše keš javnog sajta. */
export function revalidatesPublicSite<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    const response = await handler(...args);
    if (response.ok) revalidatePublicSite();
    return response;
  };
}

/** Samo stranice datih takmičenja. Za live-fetch cron koji radi svakog minuta, da ostatak sajta ostane u kešu. */
export function revalidateCompetitionPages(competitionIds: number[]) {
  for (const locale of routing.locales) {
    for (const scope of VALID_SCOPES) {
      for (const id of competitionIds) revalidatePath(`/${locale}/${scope}/takmicenja/${id}`);
    }
  }
}
