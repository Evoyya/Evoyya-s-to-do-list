import type { Tables } from './database.types'
import { supabase } from './supabase'

export type Profile = Pick<Tables<'profiles'>, 'id' | 'email' | 'display_name' | 'avatar_url'>
export type Member = Pick<Tables<'note_members'>, 'note_id' | 'user_id' | 'role'> & {
  profile: Profile | null
}

// ТР-9: участники всех доступных заметок с профилями (имя, аватар) — RLS отдаёт
// только участников заметок, где есть сам пользователь
export async function fetchMembers(): Promise<Member[]> {
  const { data, error } = await supabase
    .from('note_members')
    .select('note_id, user_id, role, profile:profiles(id, email, display_name, avatar_url)')
    .order('created_at')
  if (error) throw error
  return data
}

// Ошибки из share_note написаны для человека — показываем как есть
export async function shareNote(noteId: string, email: string) {
  const { error } = await supabase.rpc('share_note', { p_note_id: noteId, p_email: email })
  if (error) throw new Error(error.message)
}

// Владелец закрывает доступ участнику, или участник сам выходит из заметки
export async function removeMember(noteId: string, userId: string) {
  const { error } = await supabase
    .from('note_members')
    .delete()
    .eq('note_id', noteId)
    .eq('user_id', userId)
  if (error) throw error
}

export const memberName = (m: Member) => m.profile?.display_name || m.profile?.email || 'Участник'
