import type { Tables, TablesUpdate } from './database.types'
import { supabase } from './supabase'

export type Note = Tables<'notes'>
export type NoteKind = Note['kind']
export type NotePatch = TablesUpdate<'notes'>

// ТР-9: у временной задачи столбец, порядок и архив у каждого участника свои
// (хранятся в note_members); у постоянной — общие (в самой заметке)
const PERSONAL_FIELDS = ['urgency', 'position', 'archived_at'] as const

async function currentUserId() {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user.id
  if (!id) throw new Error('Нужно войти заново')
  return id
}

// Все доступные заметки (свои и общие, RLS) — сразу с личным местом пользователя
async function fetchAccessibleNotes(): Promise<Note[]> {
  const userId = await currentUserId()
  const { data, error } = await supabase
    .from('notes')
    .select('*, note_members!inner(urgency, position, archived_at)')
    .eq('note_members.user_id', userId)
  if (error) throw error
  return data.map(({ note_members, ...note }) => {
    const mine = note_members[0]
    return note.kind === 'temporary' && mine ? { ...note, ...mine } : note
  })
}

// Заметки на доске: всё, кроме архива
export async function fetchNotes(): Promise<Note[]> {
  const notes = await fetchAccessibleNotes()
  return notes.filter((n) => !n.archived_at).sort(byPosition)
}

// ТР-8: архив, недавно заархивированные сверху
export async function fetchArchivedNotes(): Promise<Note[]> {
  const notes = await fetchAccessibleNotes()
  return notes
    .filter((n) => n.archived_at)
    .sort((a, b) => b.archived_at!.localeCompare(a.archived_at!))
}

export async function insertNote(note: Note) {
  const { id, title, description, kind, urgency, position } = note
  const { error } = await supabase
    .from('notes')
    .insert({ id, title, description, kind, urgency, position })
  if (error) throw error
}

// Поля, общие для всех участников (название, описание, основной ярлык…)
export async function updateSharedNote(id: string, patch: NotePatch) {
  const { error } = await supabase.from('notes').update(patch).eq('id', id)
  if (error) throw error
}

// Изменение заметки: личные поля временной задачи уходят в место пользователя,
// остальное — в саму заметку
export async function updateNote(note: Note, patch: NotePatch) {
  const kind = patch.kind ?? note.kind
  let shared: NotePatch = { ...patch }
  let personal: NotePatch = {}

  if (kind === 'temporary') {
    for (const field of PERSONAL_FIELDS) {
      if (field in shared) {
        personal = { ...personal, [field]: shared[field] }
        delete shared[field]
      }
    }
  }

  // Смена типа: текущее место переезжает туда, где его теперь хранят
  if (patch.kind && patch.kind !== note.kind) {
    const current = {
      urgency: note.urgency,
      position: note.position,
      archived_at: note.archived_at,
    }
    if (kind === 'temporary') personal = { ...current, ...personal }
    else shared = { ...current, ...shared }
  }

  if (Object.keys(shared).length > 0) await updateSharedNote(note.id, shared)
  if (Object.keys(personal).length > 0) {
    const userId = await currentUserId()
    const { urgency, position, archived_at } = personal
    const { error } = await supabase
      .from('note_members')
      .update({ urgency, position, archived_at })
      .eq('note_id', note.id)
      .eq('user_id', userId)
    if (error) throw error
  }
}

// Владелец удаляет заметку у всех; участник только убирает её у себя
export async function deleteNote(note: Note) {
  const userId = await currentUserId()
  const { error } =
    note.owner_id === userId
      ? await supabase.from('notes').delete().eq('id', note.id)
      : await supabase.from('note_members').delete().eq('note_id', note.id).eq('user_id', userId)
  if (error) throw error
}

export const byPosition = (a: Note, b: Note) =>
  a.position - b.position || b.created_at.localeCompare(a.created_at)
