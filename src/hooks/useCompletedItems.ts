import { useQuery } from '@tanstack/react-query'
import { deleteCompletedItem, fetchCompletedItems, type CompletedItem } from '../lib/completedItems'
import { useOptimisticList } from './optimistic'

export const COMPLETED_KEY = ['completed_items'] as const

// Журнал выполненных пунктов постоянных заметок, новые сверху
export function useCompletedItems() {
  return useQuery({ queryKey: COMPLETED_KEY, queryFn: fetchCompletedItems })
}

export function useDeleteCompletedItem() {
  return useOptimisticList<CompletedItem, CompletedItem>(
    COMPLETED_KEY,
    deleteCompletedItem,
    (items, item) => items.filter((i) => i.id !== item.id),
  )
}
