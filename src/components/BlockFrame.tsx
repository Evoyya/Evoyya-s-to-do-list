import type { ReactNode } from 'react'

// ТР-11: связанные задачи друг под другом в общей белой рамке, как на макете
export function BlockFrame({ children }: { children: ReactNode }) {
  return (
    <ul
      aria-label="Связанные задачи"
      className="flex flex-col gap-2 rounded-2xl border-[3px] border-text p-1.5"
    >
      {children}
    </ul>
  )
}
