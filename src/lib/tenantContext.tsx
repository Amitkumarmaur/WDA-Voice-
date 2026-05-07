import React, { createContext, useContext } from 'react';

export type TenantRef =
  | { mode: 'org'; organizationId: string; publicSlug: string }
  | { mode: 'public'; slug: string; organizationId: string };

const TenantContext = createContext<TenantRef | null>(null);

export function TenantProvider({
  value,
  children,
}: {
  value: TenantRef | null;
  children: React.ReactNode;
}) {
  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant(): TenantRef | null {
  return useContext(TenantContext);
}
