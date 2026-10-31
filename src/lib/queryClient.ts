import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { QueryClient } from '@tanstack/react-query'

const WEEK = 7 * 24 * 60 * 60 * 1000

// Данные живут в памяти неделю: столько же хранится их копия на устройстве
export const queryClient = new QueryClient({
  defaultOptions: { queries: { gcTime: WEEK } },
})

// ТР-7: последние загруженные данные сохраняются на устройстве. Приложение
// открывается сразу с ними (и без сети), а свежие данные подгружаются следом.
export const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'task-manager-cache',
})

export const persistOptions = {
  persister,
  maxAge: WEEK,
  // Меняется при изменении формы данных: старая копия тогда просто не читается
  buster: 'schema-2026-11-01',
}

// При выходе копия на устройстве стирается: на этом устройстве может войти другой человек
export function clearCachedData() {
  queryClient.clear()
  void persister.removeClient()
}
