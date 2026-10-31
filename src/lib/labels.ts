import type { Tables, TablesUpdate } from './database.types'
import type { Note } from './notes'
import { supabase } from './supabase'

export type Label = Tables<'labels'>
export type LabelPatch = TablesUpdate<'labels'>
export type NoteLabel = Tables<'note_labels'>

// ТР-6: готовые цвета — тёмная палитра Keep, на ней светлый текст читается
export const PALETTE = [
  '#77172e',
  '#692b17',
  '#7c4a03',
  '#264d3b',
  '#0c625d',
  '#256377',
  '#284255',
  '#472e5b',
  '#6c394f',
  '#4b443a',
  '#5c5f66',
]

// Свои ярлыки и ярлыки создателей общих заметок (RLS), по алфавиту
export async function fetchLabels(): Promise<Label[]> {
  const { data, error } = await supabase.from('labels').select('*')
  if (error) throw error
  return data.sort(byName)
}

export async function insertLabel(label: Label) {
  const { id, name, color } = label
  const { error } = await supabase.from('labels').insert({ id, name, color })
  if (error) throw friendlyError(error)
}

export async function updateLabel(id: string, patch: LabelPatch) {
  const { error } = await supabase.from('labels').update(patch).eq('id', id)
  if (error) throw friendlyError(error)
}

// Связи с заметками удаляет база (on delete cascade), сами заметки остаются
export async function deleteLabel(id: string) {
  const { error } = await supabase.from('labels').delete().eq('id', id)
  if (error) throw error
}

export async function fetchNoteLabels(): Promise<NoteLabel[]> {
  const { data, error } = await supabase.from('note_labels').select('*')
  if (error) throw error
  return data
}

export async function insertNoteLabels(rows: NoteLabel[]) {
  if (rows.length === 0) return
  const { error } = await supabase.from('note_labels').insert(rows)
  if (error) throw error
}

export async function deleteNoteLabel({ note_id, label_id }: NoteLabel) {
  const { error } = await supabase
    .from('note_labels')
    .delete()
    .eq('note_id', note_id)
    .eq('label_id', label_id)
  if (error) throw error
}

export const byName = (a: Label, b: Label) => a.name.localeCompare(b.name, 'ru')

export const sameName = (a: string, b: string) =>
  a.trim().toLocaleLowerCase('ru') === b.trim().toLocaleLowerCase('ru')

// Ограничения уникальности в базе — понятными словами
function friendlyError(error: { code?: string; message: string }) {
  if (error.code !== '23505') return error
  if (error.message.includes('color')) return new Error('этот цвет уже занят другим ярлыком')
  return new Error('ярлык с таким названием уже есть')
}

// Почему название или цвет нельзя сохранить; null — можно
export function labelProblem(
  labels: Label[],
  name: string,
  color: string,
  exceptId?: string,
): string | null {
  const others = labels.filter((l) => l.id !== exceptId)
  if (!name.trim()) return 'Введите название'
  if (name.trim().length > 50) return 'Название длиннее 50 символов'
  if (others.some((l) => sameName(l.name, name))) return 'Ярлык с таким названием уже есть'
  const taken = others.find((l) => l.color === color)
  if (taken) return `Цвет уже у ярлыка «${taken.name}»`
  return null
}

// Первый свободный цвет палитры, а если заняты все — случайный
export function freeColor(labels: Label[]) {
  const used = new Set(labels.map((l) => l.color))
  const free = PALETTE.find((c) => !used.has(c))
  if (free) return free
  let color
  do {
    color = `#${Math.floor(Math.random() * 0xffffff)
      .toString(16)
      .padStart(6, '0')}`
  } while (used.has(color))
  return color
}

export function makeLabel(ownerId: string, name: string, color: string): Label {
  return {
    id: crypto.randomUUID(),
    owner_id: ownerId,
    name: name.trim(),
    color,
    created_at: new Date().toISOString(),
  }
}

// ТР-5: основной ярлык первым; если не выбран — первый по алфавиту
export function orderLabels(note: Note, labels: Label[]): Label[] {
  const primary = labels.find((l) => l.id === note.primary_label_id)
  return primary ? [primary, ...labels.filter((l) => l !== primary)] : labels
}
