import { useRef, useState, type FormEvent, type RefObject } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useClickOutside } from '../hooks/useClickOutside'
import { useMembersByNote, useRemoveMember, useShareNote } from '../hooks/useMembers'
import { memberName } from '../lib/members'
import type { Note } from '../lib/notes'
import { Avatar } from './Avatar'
import { useToast } from './Toast'

// ТР-9: кто видит заметку. Владелец добавляет участника по email и закрывает доступ;
// участник может выйти сам.
export function SharePanel({
  note,
  onLeft,
  onClose,
  toggleRef,
}: {
  note: Note
  // Пользователь вышел из чужой заметки — окно заметки надо закрыть
  onLeft: () => void
  onClose: () => void
  toggleRef: RefObject<HTMLElement | null>
}) {
  const { session } = useAuth()
  const me = session?.user.id
  const isOwner = note.owner_id === me
  const members = useMembersByNote().get(note.id) ?? []
  const shareNote = useShareNote()
  const removeMember = useRemoveMember()
  const showToast = useToast()

  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)

  const rootRef = useRef<HTMLDivElement>(null)
  useClickOutside([rootRef, toggleRef], onClose)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return
    if (members.some((m) => m.profile?.email === trimmed.toLowerCase())) {
      setError('Этот пользователь уже участник')
      return
    }
    setError(null)
    shareNote.mutate(
      { noteId: note.id, email: trimmed },
      {
        onSuccess: () => {
          setEmail('')
          showToast(`Заметка теперь общая с ${trimmed}`)
        },
        onError: (err) => setError(err.message),
      },
    )
  }

  const leave = () => {
    removeMember.mutate({ noteId: note.id, userId: me! })
    showToast('Вы вышли из общей заметки')
    onLeft()
  }

  return (
    <div
      ref={rootRef}
      className="flex flex-col gap-2 rounded-lg border border-border/60 bg-surface p-3"
    >
      <h3 className="text-sm font-medium">Совместный доступ</h3>
      <ul className="flex flex-col gap-2">
        {members.map((m) => (
          <li key={m.user_id} className="flex items-center gap-2">
            <Avatar name={memberName(m)} url={m.profile?.avatar_url} className="size-8 text-sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">
                {memberName(m)}
                {m.user_id === me && <span className="text-text-muted"> (вы)</span>}
              </p>
              <p className="truncate text-xs text-text-muted">
                {m.role === 'owner' ? 'Владелец' : m.profile?.email}
              </p>
            </div>
            {isOwner && m.role !== 'owner' && (
              <button
                type="button"
                onClick={() => removeMember.mutate({ noteId: note.id, userId: m.user_id })}
                className="shrink-0 rounded-full px-3 py-1 text-sm text-text-muted hover:bg-surface-raised hover:text-text"
              >
                Закрыть доступ
              </button>
            )}
            {!isOwner && m.user_id === me && (
              <button
                type="button"
                onClick={leave}
                className="shrink-0 rounded-full px-3 py-1 text-sm text-text-muted hover:bg-surface-raised hover:text-text"
              >
                Выйти
              </button>
            )}
          </li>
        ))}
      </ul>

      {isOwner && (
        <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2 pt-1">
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setError(null)
            }}
            placeholder="Email участника"
            aria-label="Email участника"
            autoComplete="email"
            className="min-w-0 flex-1 rounded border border-border/60 bg-surface-raised px-2 py-1.5 text-base outline-none placeholder:text-text-muted focus:border-border"
          />
          <button
            type="submit"
            disabled={!email.trim() || shareNote.isPending}
            className="rounded-full bg-accent/20 px-4 py-1.5 text-sm font-medium text-accent hover:bg-accent/30 disabled:opacity-40"
          >
            Поделиться
          </button>
          {error && <p className="w-full text-sm text-red-400">{error}</p>}
          {members.length <= 1 && !error && (
            <p className="w-full text-xs text-text-muted">
              Второй пользователь должен хотя бы раз войти в приложение.
              {note.kind === 'temporary' &&
                ' У временной задачи у каждого будет свой столбец и свой архив.'}
            </p>
          )}
        </form>
      )}
    </div>
  )
}
