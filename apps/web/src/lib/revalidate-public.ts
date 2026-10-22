import { revalidatePath } from "next/cache";
import { routing } from "@/i18n/routing";
import { VALID_SCOPES } from "@/lib/scope";

// Javne stranice su ISR (revalidate u page.tsx). Posle upisa u bazu briše se keš odmah,
// inače bi izmena čekala da revalidate istekne.

/** Ceo javni sajt. Za retke admin, import i CMS upise. */
export function revalidatePublicSite() {
  revalidatePath("/", "layout");
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
