import { useQueryClient, type QueryKey } from '@tanstack/react-query'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ITEMS_KEY } from './useChecklist'
import { LABELS_KEY, NOTE_LABELS_KEY } from './useLabels'
import { MEMBERS_KEY } from './useMembers'

// Какие данные перезагрузить, когда в таблице что-то изменилось.
// ['notes'] — и доска, и архив (у архива ключ начинается так же).
const KEYS_BY_TABLE: Record<string, QueryKey[]> = {
  notes: [['notes']],
  checklist_items: [ITEMS_KEY],
  labels: [LABELS_KEY],
  note_labels: [NOTE_LABELS_KEY],
  // Поделились заметкой или закрыли доступ — меняется всё, что видно
  note_members: [['notes'], MEMBERS_KEY, ITEMS_KEY, LABELS_KEY, NOTE_LABELS_KEY],
}

// Сколько ждать, прежде чем показать «Нет связи»: короткие обрывы не в счёт
const OFFLINE_GRACE_MS = 5000

// ТР-7: изменения с других устройств (и, на этапе 9, от второго участника)
// появляются сами. Возвращает false, если связи нет дольше нескольких секунд.
export function useRealtimeSync(userId: string) {
  const queryClient = useQueryClient()
  const [online, setOnline] = useState(true)

  useEffect(() => {
    // Пока сохраняются свои изменения, перезагрузка затёрла бы их на экране.
    // Поэтому ключи копятся и перезагружаются, когда все сохранения закончились.
    const pending = new Map<string, QueryKey>()
    let flushTimer: ReturnType<typeof setTimeout> | undefined

    const flush = () => {
      clearTimeout(flushTimer)
      flushTimer = setTimeout(() => {
        if (queryClient.isMutating() > 0) return
        for (const queryKey of pending.values()) void queryClient.invalidateQueries({ queryKey })
        pending.clear()
      }, 300)
    }

    const unsubscribeMutations = queryClient.getMutationCache().subscribe((event) => {
      if (event.type === 'updated' && pending.size > 0) flush()
    })

    // Сеть и канал отслеживаются отдельно: офлайн виден сразу, обрыв канала — с задержкой
    let channelOk = true
    let offlineTimer: ReturnType<typeof setTimeout> | undefined
    const updateOnline = () => {
      clearTimeout(offlineTimer)
      if (!navigator.onLine) return setOnline(false)
      if (channelOk) return setOnline(true)
      offlineTimer = setTimeout(() => setOnline(false), OFFLINE_GRACE_MS)
    }

    let channel: RealtimeChannel
    let firstConnect = true
    const subscribe = () => {
      channel = supabase
        .channel(`sync:${userId}`)
        // Без фильтра: RLS сама присылает только доступные пользователю строки
        .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
          for (const key of KEYS_BY_TABLE[payload.table] ?? [])
            pending.set(JSON.stringify(key), key)
          flush()
        })
        .subscribe((status) => {
          channelOk = status === 'SUBSCRIBED'
          updateOnline()
          if (status !== 'SUBSCRIBED') return
          // После переподключения могли пропустить события — перечитываем всё.
          // При первом подключении данные только что загружены, это лишнее.
          if (!firstConnect) void queryClient.invalidateQueries()
          firstConnect = false
        })
    }
    subscribe()

    // iPhone усыпляет фоновые вкладки, и канал может молча закрыться.
    // При возвращении в приложение переподключаемся, если канал не в порядке.
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (channel.state !== 'joined') {
        void supabase.removeChannel(channel)
        subscribe()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', updateOnline)
    window.addEventListener('offline', updateOnline)

    return () => {
      clearTimeout(flushTimer)
      clearTimeout(offlineTimer)
      unsubscribeMutations()
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', updateOnline)
      window.removeEventListener('offline', updateOnline)
      void supabase.removeChannel(channel)
    }
  }, [queryClient, userId])

  return online
}
