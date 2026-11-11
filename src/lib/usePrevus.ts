import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { CLE_PREVUS, type EtapePrevu } from './prevu'

/** Les nombres de séances prévues notés au fil du temps : chaque semaine passée est jugée sur ce qui était prévu à son époque. */
export function usePrevus(): EtapePrevu[] {
  const r = useLiveQuery(() => db.reglages.get(CLE_PREVUS), [])
  return (r?.valeur as EtapePrevu[] | undefined) ?? []
}
