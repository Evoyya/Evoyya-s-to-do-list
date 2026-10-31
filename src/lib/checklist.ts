import type { Tables, TablesUpdate } from './database.types'
import { supabase } from './supabase'

export type ChecklistItem = Tables<'checklist_items'>
export type ChecklistItemPatch = TablesUpdate<'checklist_items'>

// Пункты всех доступных заметок одним запросом: RLS оставляет только свои и общие
export async function fetchChecklistItems(): Promise<ChecklistItem[]> {
  const { data, error } = await supabase
    .from('checklist_items')
    .select('*')
    .order('position')
    .order('created_at')
  if (error) throw error
  return data
}

export async function insertChecklistItems(items: ChecklistItem[]) {
  if (items.length === 0) return
  const { error } = await supabase.from('checklist_items').insert(
    items.map(({ id, note_id, text, is_done, position }) => ({
      id,
      note_id,
      text,
      is_done,
      position,
    })),
  )
  if (error) throw error
}

export async function updateChecklistItem(id: string, patch: ChecklistItemPatch) {
  const { error } = await supabase.from('checklist_items').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteChecklistItem(id: string) {
  const { error } = await supabase.from('checklist_items').delete().eq('id', id)
  if (error) throw error
}

export const byItemPosition = (a: ChecklistItem, b: ChecklistItem) =>
  a.position - b.position || a.created_at.localeCompare(b.created_at)

// Позиция между соседями: при перестановке меняется только один пункт
export function positionBetween(before?: number, after?: number) {
  if (before === undefined && after === undefined) return 0
  if (before === undefined) return after! - 1
  if (after === undefined) return before + 1
  return (before + after) / 2
}

export function makeItem(noteId: string, text: string, position: number): ChecklistItem {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    note_id: noteId,
    text,
    is_done: false,
    position,
    created_at: now,
    updated_at: now,
  }
}
