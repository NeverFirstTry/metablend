'use client'

// The app's one store of planned hikes (lib/plans.js) with the real permission check and API call, and the hook
// the screens read it with. It loads on first use; the server's render sees no plans (nothing is asked there).
import { useEffect, useSyncExternalStore } from 'react'
import { makePlansStore } from './plans.js'
import { pushApi, permission } from './push-client'
import { readLocalPlans, writeLocalPlans } from './local-plans'
import { localToday } from './app-widget-sync'

// the phone's calendar day: a plan kept on the phone goes after its day
export const plansStore = makePlansStore({ permission, api: pushApi, local: { read: readLocalPlans, write: writeLocalPlans }, today: localToday })

export function usePlans() {
  const list = useSyncExternalStore(plansStore.subscribe, plansStore.get, plansStore.get)
  useEffect(() => { plansStore.load() }, [])
  return list
}
