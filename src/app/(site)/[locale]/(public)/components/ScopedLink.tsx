"use client";

import type { ComponentProps } from "react";
import { Link } from "@/i18n/navigation";
import { useScopedHref } from "@/hooks/use-scoped-href";

type Props = Omit<ComponentProps<typeof Link>, "href"> & { href: string };

export function ScopedLink({ href, ...props }: Props) {
  const scopedHref = useScopedHref();
  return <Link {...props} href={scopedHref(href)} />;
}
