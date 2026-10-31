import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'

// Изменение сразу видно на экране; при ошибке сервера список откатывается
export function useOptimisticList<TItem, TVars>(
  queryKey: QueryKey,
  mutationFn: (vars: TVars) => Promise<void>,
  apply: (items: TItem[], vars: TVars) => TItem[],
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<TItem[]>(queryKey)
      queryClient.setQueryData<TItem[]>(queryKey, (old = []) => apply(old, vars))
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  })
}
