import { notFound } from 'next/navigation';
import { VALID_SCOPES, type Scope } from '@/lib/scope';

export const revalidate = 300;
export const dynamicParams = true;

export function generateStaticParams() {
  return VALID_SCOPES.map((scope) => ({ scope }));
}

export default async function ScopeLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ scope: string }>;
}) {
  const { scope } = await params;
  if (!VALID_SCOPES.includes(scope as Scope)) notFound();
  return <>{children}</>;
}
