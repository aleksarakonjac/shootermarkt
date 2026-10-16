"use client";

import type { ComponentProps, MouseEvent } from "react";
import { Link, useRouter } from "@/i18n/navigation";

type Props = ComponentProps<typeof Link> & { transitionName: string };

type TransitionDocument = Document & { startViewTransition?: (update: () => Promise<void>) => { finished: Promise<void> } };

const NAVIGATION_TIMEOUT = 1_500;

/**
 * Link koji ime sa liste "preseli" na odredišnu stranicu (View Transitions API).
 * Odredište mora imati element sa `data-vt="<transitionName>"` i istim `view-transition-name`.
 * Bez podrške u browseru, uz reduced motion ili uz modifikator tastera ponaša se kao običan link.
 */
export function TransitionLink({ transitionName, onClick, href, children, ...rest }: Props) {
  const router = useRouter();

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const doc = document as TransitionDocument;
    if (!doc.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    event.preventDefault();
    const source = event.currentTarget;
    source.style.setProperty("view-transition-name", transitionName);
    const transition = doc.startViewTransition(() => new Promise<void>((resolve) => {
      router.push(href as Parameters<typeof router.push>[0]);
      const startedAt = performance.now();
      const waitForTarget = () => {
        if (document.querySelector(`[data-vt="${transitionName}"]`) || performance.now() - startedAt > NAVIGATION_TIMEOUT) resolve();
        else requestAnimationFrame(waitForTarget);
      };
      requestAnimationFrame(waitForTarget);
    }));
    transition.finished.finally(() => source.style.removeProperty("view-transition-name"));
  }

  return <Link {...rest} href={href} onClick={handleClick}>{children}</Link>;
}
