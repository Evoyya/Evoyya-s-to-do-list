-- ТР-7, этап 8: изменения приходят на другие устройства без перезагрузки.
-- Realtime проверяет RLS для каждого получателя, поэтому чужие заметки не приходят.
alter publication supabase_realtime add table
  public.notes,
  public.checklist_items,
  public.labels,
  public.note_labels,
  public.note_members;
