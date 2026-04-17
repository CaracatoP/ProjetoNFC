import { createContext, useContext, useState } from 'react';

const TenantContext = createContext(null);

export function TenantProvider({ children }) {
  const [site, setSite] = useState(null);

  return <TenantContext.Provider value={{ site, setSite }}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const context = useContext(TenantContext);

  if (!context) {
    throw new Error('useTenant deve ser usado dentro de TenantProvider');
  }

  return context;
}
