import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import {
  deleteSprint,
  fetchSprints,
  insertSprint,
  sprintNumber,
  splitSprints,
  SPRINTS_KEY,
  updateSprint,
  type Sprint,
  type SprintPatch,
} from '../lib/sprints'
import type { Note } from '../lib/notes'
import { useOptimisticList } from './optimistic'
import { useSprintNotes } from './useNotes'

export { SPRINTS_KEY }

// ТР-12: свои спринты — действующие и завершённые (RLS отдаёт только свои)
export function useSprints() {
  return useQuery({ queryKey: SPRINTS_KEY, queryFn: fetchSprints })
}

export function useSprintLists() {
  const { data = [], isPending, error } = useSprints()
  const lists = useMemo(() => splitSprints(data), [data])
  return { all: data, ...lists, isPending, error }
}

const bySprintCreated = (a: Sprint, b: Sprint) => a.created_at.localeCompare(b.created_at)

export function useCreateSprint() {
  return useOptimisticList<Sprint, Sprint>(SPRINTS_KEY, insertSprint, (sprints, sprint) =>
    [...sprints, sprint].sort(bySprintCreated),
  )
}

// Правка, завершение (completed_at) и возврат из архива спринтов
export function useUpdateSprint() {
  return useOptimisticList<Sprint, { id: string; patch: SprintPatch }>(
    SPRINTS_KEY,
    ({ id, patch }) => updateSprint(id, patch),
    (sprints, { id, patch }) => sprints.map((s) => (s.id === id ? { ...s, ...patch } : s)),
  )
}

// Удалённый спринт отпускает свои задачи (в базе sprint_id сбрасывается сам)
export function useDeleteSprint() {
  const queryClient = useQueryClient()
  const mutation = useOptimisticList<Sprint, string>(SPRINTS_KEY, deleteSprint, (sprints, id) =>
    sprints.filter((s) => s.id !== id),
  )
  return {
    ...mutation,
    mutate: (id: string) =>
      mutation.mutate(id, {
        onSettled: () => queryClient.invalidateQueries({ queryKey: ['notes'] }),
      }),
  }
}

export type SprintBadge = { sprint: Sprint; number: number }

// Значок на карточке: фигура действующего спринта и номер задачи в нём
export function useSprintBadges(): (note: Note) => SprintBadge | null {
  const { data: sprints = [] } = useSprints()
  const notes = useSprintNotes()
  return useMemo(() => {
    const active = new Map(sprints.filter((s) => !s.completed_at).map((s) => [s.id, s]))
    return (note: Note) => {
      const sprint = note.sprint_id ? active.get(note.sprint_id) : undefined
      if (!sprint || note.kind !== 'temporary') return null
      // Свежая версия задачи (из доски) — с актуальным номером
      const current = notes.find((n) => n.id === note.id) ?? note
      const number = sprintNumber(notes, current)
      return number ? { sprint, number } : null
    }
  }, [sprints, notes])
}
