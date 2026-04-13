'use client'

import { createContext, useContext } from 'react'
import type { ModuleName } from '@/lib/modules'

const ModulesContext = createContext<Set<ModuleName>>(new Set(['events', 'range', 'members', 'payments']))

export function ModulesProvider({ enabled, children }: { enabled: ModuleName[]; children: React.ReactNode }) {
  return (
    <ModulesContext.Provider value={new Set(enabled)}>
      {children}
    </ModulesContext.Provider>
  )
}

export function useModules() {
  return useContext(ModulesContext)
}
