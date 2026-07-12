'use client';

import { useParams } from 'next/navigation';
import { DEFAULT_SCOPE, VALID_SCOPES, type Scope } from '@/lib/scope';

export function withScope(scope: Scope, path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const pathWithoutScope = normalized.replace(/^\/(?:srb|issf)(?=\/|$)/, '');
  return pathWithoutScope === '/' || pathWithoutScope === ''
    ? `/${scope}`
    : `/${scope}${pathWithoutScope}`;
}

export function useScopedHref(): (path: string) => string {
  const params = useParams();
  const rawScope = params?.scope as string | undefined;
  const scope: Scope = VALID_SCOPES.includes(rawScope as Scope)
    ? (rawScope as Scope)
    : DEFAULT_SCOPE;
  return (path) => withScope(scope, path);
}
