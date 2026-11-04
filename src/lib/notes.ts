import type { Json, Tables, TablesUpdate } from './database.types'
import { supabase } from './supabase'

// link_group — блок связанных задач (ТР-11). Хранится только в личном месте участника.
export type Note = Tables<'notes'> & { link_group: string | null }
export type NoteKind = Note['kind']
export type NotePatch = TablesUpdate<'notes'> & { link_group?: string | null }

// Личное место задачи: столбец, порядок и блок. Поля без значения не меняются.
export type Place = {
  note_id: string
  urgency?: Note['urgency']
  position?: number
  link_group?: string | null
}

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
    .select('*, note_members!inner(urgency, position, archived_at, link_group)')
    .eq('note_members.user_id', userId)
  if (error) throw error
  return data.map(({ note_members, ...note }) => {
    const mine = note_members[0]
    if (note.kind === 'temporary' && mine) return { ...note, ...mine }
    return { ...note, link_group: null }
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
  const { id, title, description, kind, urgency, position, due_date } = note
  const { error } = await supabase
    .from('notes')
    .insert({ id, title, description, kind, urgency, position, due_date })
  if (error) throw error
}

// Поля, общие для всех участников (название, описание, основной ярлык…)
export async function updateSharedNote(id: string, patch: TablesUpdate<'notes'>) {
  const { error } = await supabase.from('notes').update(patch).eq('id', id)
  if (error) throw error
}

// Изменение заметки: личные поля временной задачи уходят в место пользователя,
// остальное — в саму заметку
export async function updateNote(note: Note, patch: NotePatch) {
  const kind = patch.kind ?? note.kind
  let shared: NotePatch = { ...patch }
  let personal: NotePatch = {}

  // Блок есть только в личном месте; постоянная заметка из блока выходит (ТР-11)
  if ('link_group' in shared) {
    personal.link_group = shared.link_group
    delete shared.link_group
  }
  if (kind === 'permanent' && note.link_group) personal.link_group = null

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

  const { link_group: _personal, ...sharedOnly } = shared
  if (Object.keys(sharedOnly).length > 0) await updateSharedNote(note.id, sharedOnly)
  if (Object.keys(personal).length > 0) {
    const userId = await currentUserId()
    const { urgency, position, archived_at, link_group } = personal
    const { error } = await supabase
      .from('note_members')
      .update({ urgency, position, archived_at, link_group })
      .eq('note_id', note.id)
      .eq('user_id', userId)
    if (error) throw error
  }
}

// ТР-11: своё место у нескольких задач сразу — перенос блока, связывание
export async function updateMyPlaces(places: Place[]) {
  if (places.length === 0) return
  const { error } = await supabase.rpc('update_my_places', { p_places: places as Json })
  if (error) throw error
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
