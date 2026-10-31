import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { fetchMembers, removeMember, shareNote, type Member } from '../lib/members'
import { useOptimisticList } from './optimistic'

export const MEMBERS_KEY = ['members'] as const

export function useMembers() {
  return useQuery({ queryKey: MEMBERS_KEY, queryFn: fetchMembers })
}

// Участники каждой заметки (владелец первым)
export function useMembersByNote() {
  const { data = [] } = useMembers()
  return useMemo(() => {
    const map = new Map<string, Member[]>()
    for (const m of data) {
      const list = map.get(m.note_id) ?? []
      if (m.role === 'owner') list.unshift(m)
      else list.push(m)
      map.set(m.note_id, list)
    }
    return map
  }, [data])
}

// Новый участник появится после ответа сервера: его профиль заранее неизвестен.
// Заметки тоже перечитываются — у нового участника появится его место.
export function useShareNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ noteId, email }: { noteId: string; email: string }) => shareNote(noteId, email),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MEMBERS_KEY })
      void queryClient.invalidateQueries({ queryKey: ['notes'] })
    },
    // Ошибку («ещё не входил в приложение») показывает само окно, не общий баннер
    meta: { silent: true },
  })
}

export function useRemoveMember() {
  const queryClient = useQueryClient()
  const mutation = useOptimisticList<Member, { noteId: string; userId: string }>(
    MEMBERS_KEY,
    ({ noteId, userId }) => removeMember(noteId, userId),
    (members, { noteId, userId }) =>
      members.filter((m) => m.note_id !== noteId || m.user_id !== userId),
  )
  return {
    ...mutation,
    // Если вышел сам пользователь — заметка пропадает у него с доски
    mutate: (vars: { noteId: string; userId: string }) =>
      mutation.mutate(vars, {
        onSettled: () => queryClient.invalidateQueries({ queryKey: ['notes'] }),
      }),
  }
}
