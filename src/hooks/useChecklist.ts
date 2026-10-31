import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import {
  byItemPosition,
  deleteChecklistItem,
  fetchChecklistItems,
  insertChecklistItems,
  updateChecklistItem,
  type ChecklistItem,
  type ChecklistItemPatch,
} from '../lib/checklist'
import { useOptimisticList } from './optimistic'

export const ITEMS_KEY = ['checklist_items'] as const

export function useChecklistItems() {
  return useQuery({ queryKey: ITEMS_KEY, queryFn: fetchChecklistItems })
}

// Пункты, сгруппированные по заметкам (для карточек на доске)
export function useItemsByNote() {
  const { data = [] } = useChecklistItems()
  return useMemo(() => {
    const map = new Map<string, ChecklistItem[]>()
    for (const item of data) {
      const list = map.get(item.note_id) ?? []
      list.push(item)
      map.set(item.note_id, list)
    }
    return map
  }, [data])
}

export function useNoteItems(noteId: string) {
  const { data = [] } = useChecklistItems()
  return useMemo(() => data.filter((i) => i.note_id === noteId), [data, noteId])
}

export function useAddItem() {
  return useOptimisticList<ChecklistItem, ChecklistItem>(
    ITEMS_KEY,
    (item) => insertChecklistItems([item]),
    (items, item) => [...items, item].sort(byItemPosition),
  )
}

export function useUpdateItem() {
  return useOptimisticList<ChecklistItem, { id: string; patch: ChecklistItemPatch }>(
    ITEMS_KEY,
    ({ id, patch }) => updateChecklistItem(id, patch),
    (items, { id, patch }) =>
      items.map((i) => (i.id === id ? { ...i, ...patch } : i)).sort(byItemPosition),
  )
}

export function useDeleteItem() {
  return useOptimisticList<ChecklistItem, string>(ITEMS_KEY, deleteChecklistItem, (items, id) =>
    items.filter((i) => i.id !== id),
  )
}
