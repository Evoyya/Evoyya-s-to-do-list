import type { Tables } from './database.types'
import { supabase } from './supabase'

// Выполненный пункт постоянной заметки (запись журнала) + текущее название заметки
export type CompletedItem = Tables<'completed_items'> & { noteTitle: string }

// Записи пишет база (триггер при зачёркивании пункта), приложение их только читает
export async function fetchCompletedItems(): Promise<CompletedItem[]> {
  const { data, error } = await supabase
    .from('completed_items')
    .select('*, note:notes(title)')
    .order('completed_at', { ascending: false })
  if (error) throw error
  return data.map(({ note, ...item }) => ({ ...item, noteTitle: note?.title ?? 'Заметка' }))
}

export async function deleteCompletedItem(item: CompletedItem) {
  const { error } = await supabase.from('completed_items').delete().eq('id', item.id)
  if (error) throw error
}
