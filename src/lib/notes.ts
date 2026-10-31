import type { Tables, TablesUpdate } from './database.types'
import { supabase } from './supabase'

export type Note = Tables<'notes'>
export type NoteKind = Note['kind']
export type NotePatch = TablesUpdate<'notes'>

// Заметки на доске: всё, кроме архива. RLS сама оставляет только свои и общие.
export async function fetchNotes(): Promise<Note[]> {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .is('archived_at', null)
    .order('position')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

// ТР-8: архив, недавно заархивированные сверху
export async function fetchArchivedNotes(): Promise<Note[]> {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .not('archived_at', 'is', null)
    .order('archived_at', { ascending: false })
  if (error) throw error
  return data
}

export async function insertNote(note: Note) {
  const { id, title, description, kind, urgency, position } = note
  const { error } = await supabase
    .from('notes')
    .insert({ id, title, description, kind, urgency, position })
  if (error) throw error
}

export async function updateNote(id: string, patch: NotePatch) {
  const { error } = await supabase.from('notes').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteNote(id: string) {
  const { error } = await supabase.from('notes').delete().eq('id', id)
  if (error) throw error
}

export const byPosition = (a: Note, b: Note) =>
  a.position - b.position || b.created_at.localeCompare(a.created_at)
