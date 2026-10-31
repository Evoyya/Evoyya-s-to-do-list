import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { useAuth } from '../auth/AuthProvider'
import {
  byName,
  orderLabels,
  sameName,
  deleteLabel,
  deleteNoteLabel,
  fetchLabels,
  fetchNoteLabels,
  insertLabel,
  insertNoteLabels,
  updateLabel,
  type Label,
  type LabelPatch,
  type NoteLabel,
} from '../lib/labels'
import { updateSharedNote, type Note } from '../lib/notes'
import { useOptimisticList } from './optimistic'

export const LABELS_KEY = ['labels'] as const
export const NOTE_LABELS_KEY = ['note_labels'] as const

// Изменения ярлыков выполняются строго по очереди: связь с заметкой нельзя
// сохранить раньше самого ярлыка, а основной ярлык — раньше связи
export const LABELS_SCOPE = { id: 'labels' }

export function useLabels() {
  return useQuery({ queryKey: LABELS_KEY, queryFn: fetchLabels })
}

// ТР-6: только свои ярлыки — их можно вешать, править и удалять
export function useMyLabels() {
  const { session } = useAuth()
  const { data = [] } = useLabels()
  const me = session?.user.id
  return useMemo(() => data.filter((l) => l.owner_id === me), [data, me])
}

export function useNoteLabelRows() {
  return useQuery({ queryKey: NOTE_LABELS_KEY, queryFn: fetchNoteLabels })
}

// Ярлыки каждой заметки по алфавиту (основной ставит наверх orderLabels)
export function useLabelsByNote() {
  const { data: labels = [] } = useLabels()
  const { data: rows = [] } = useNoteLabelRows()
  return useMemo(() => {
    const byId = new Map(labels.map((l) => [l.id, l]))
    const map = new Map<string, Label[]>()
    for (const row of rows) {
      const label = byId.get(row.label_id)
      if (!label) continue
      const list = map.get(row.note_id) ?? []
      list.push(label)
      map.set(row.note_id, list)
    }
    for (const list of map.values()) list.sort(byName)
    return map
  }, [labels, rows])
}

// Как заметка выглядит у пользователя: какие ярлыки видны, каким цветом карточка
// и каких ярлыков создателя у него не хватает
export type LabelView = {
  labels: Label[]
  color?: string
  missing: Label[]
}

const NO_LABELS: LabelView = { labels: [], missing: [] }

// ТР-5, ТР-9: на своей заметке — свои ярлыки, основной первым.
// На чужой общей — ярлыки создателя, подменённые своими с тем же названием;
// ярлыка без пары не видно, а карточка красится только своим ярлыком,
// совпавшим с основным ярлыком создателя.
export function useLabelsFor() {
  const { session } = useAuth()
  const me = session?.user.id
  const byNote = useLabelsByNote()
  const mine = useMyLabels()
  return useCallback(
    (note: Note): LabelView => {
      const ordered = orderLabels(note, byNote.get(note.id) ?? [])
      if (ordered.length === 0) return NO_LABELS
      if (note.owner_id === me) return { labels: ordered, color: ordered[0].color, missing: [] }

      const labels: Label[] = []
      const missing: Label[] = []
      for (const label of ordered) {
        const own = mine.find((l) => sameName(l.name, label.name))
        if (own) labels.push(own)
        else missing.push(label)
      }
      const primaryOwn = mine.find((l) => sameName(l.name, ordered[0].name))
      return { labels, color: primaryOwn?.color, missing }
    },
    [byNote, mine, me],
  )
}

export function useCreateLabel() {
  return useOptimisticList<Label, Label>(
    LABELS_KEY,
    insertLabel,
    (labels, label) => [...labels, label].sort(byName),
    LABELS_SCOPE,
  )
}

export function useUpdateLabel() {
  return useOptimisticList<Label, { id: string; patch: LabelPatch }>(
    LABELS_KEY,
    ({ id, patch }) => updateLabel(id, patch),
    (labels, { id, patch }) =>
      labels.map((l) => (l.id === id ? { ...l, ...patch } : l)).sort(byName),
    LABELS_SCOPE,
  )
}

// Ярлык снимается со всех заметок сразу на экране
export function useDeleteLabel() {
  const queryClient = useQueryClient()
  return useMutation({
    scope: LABELS_SCOPE,
    mutationFn: deleteLabel,
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: LABELS_KEY })
      await queryClient.cancelQueries({ queryKey: NOTE_LABELS_KEY })
      const previousLabels = queryClient.getQueryData<Label[]>(LABELS_KEY)
      const previousRows = queryClient.getQueryData<NoteLabel[]>(NOTE_LABELS_KEY)
      queryClient.setQueryData<Label[]>(LABELS_KEY, (old = []) => old.filter((l) => l.id !== id))
      queryClient.setQueryData<NoteLabel[]>(NOTE_LABELS_KEY, (old = []) =>
        old.filter((r) => r.label_id !== id),
      )
      return { previousLabels, previousRows }
    },
    onError: (_error, _id, context) => {
      if (context?.previousLabels) queryClient.setQueryData(LABELS_KEY, context.previousLabels)
      if (context?.previousRows) queryClient.setQueryData(NOTE_LABELS_KEY, context.previousRows)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: LABELS_KEY })
      void queryClient.invalidateQueries({ queryKey: NOTE_LABELS_KEY })
      // База сбросила основной ярлык у заметок
      void queryClient.invalidateQueries({ queryKey: ['notes'] })
    },
  })
}

export function useAddNoteLabel() {
  return useOptimisticList<NoteLabel, NoteLabel>(
    NOTE_LABELS_KEY,
    (row) => insertNoteLabels([row]),
    (rows, row) => [...rows, row],
    LABELS_SCOPE,
  )
}

export function useRemoveNoteLabel() {
  return useOptimisticList<NoteLabel, NoteLabel>(
    NOTE_LABELS_KEY,
    deleteNoteLabel,
    (rows, row) => rows.filter((r) => r.note_id !== row.note_id || r.label_id !== row.label_id),
    LABELS_SCOPE,
  )
}

export function useSetPrimaryLabel() {
  return useOptimisticList<Note, { noteId: string; labelId: string }>(
    ['notes'],
    ({ noteId, labelId }) => updateSharedNote(noteId, { primary_label_id: labelId }),
    (notes, { noteId, labelId }) =>
      notes.map((n) => (n.id === noteId ? { ...n, primary_label_id: labelId } : n)),
    LABELS_SCOPE,
  )
}
