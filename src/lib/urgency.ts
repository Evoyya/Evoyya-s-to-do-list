import type { Note } from './notes'

export type Urgency = Note['urgency']

// ТР-2: столбцы слева направо в порядке убывания срочности
export const URGENCIES: { value: Urgency; label: string; color: string }[] = [
  { value: 'critical', label: 'Критично', color: '#f28b82' },
  { value: 'urgent', label: 'Срочно', color: '#fbbc04' },
  { value: 'not_urgent', label: 'Не срочно', color: '#8ab4f8' },
  { value: 'no_deadline', label: 'Без дедлайна', color: '#9aa0a6' },
]

export const DEFAULT_URGENCY: Urgency = 'no_deadline'
