-- Журнал выполненных пунктов постоянных заметок (например, покупки из «Магазина»).
-- Пункт остаётся в заметке, а в архив попадает запись: что, из какой заметки,
-- когда и кем зачёркнуто. Для статистики и выгрузки архива.

create table public.completed_items (
  id           uuid primary key default gen_random_uuid(),
  note_id      uuid not null references public.notes (id) on delete cascade,
  -- Пункт могут удалить из заметки — запись в журнале остаётся
  item_id      uuid references public.checklist_items (id) on delete set null,
  text         text not null,
  completed_at timestamptz not null default now(),
  completed_by uuid references public.profiles (id) on delete set null
);

create index completed_items_note_id_idx on public.completed_items (note_id);
create index completed_items_item_id_idx on public.completed_items (item_id);
create index completed_items_completed_by_idx on public.completed_items (completed_by);

alter table public.completed_items enable row level security;

-- Видят участники заметки; удалить запись может любой участник.
-- Добавляет записи только триггер ниже — из приложения напрямую нельзя.
create policy "completed_items: участник видит"
  on public.completed_items for select to authenticated
  using (private.is_note_member(note_id));

create policy "completed_items: участник удаляет"
  on public.completed_items for delete to authenticated
  using (private.is_note_member(note_id));

-- Зачеркнули пункт постоянной заметки — запись в журнал.
-- Сняли отметку в течение 5 минут — это была ошибка, запись убирается.
-- Позже (пункт вернули в список, чтобы купить снова) — запись остаётся.
create function private.log_completed_item()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.is_done and not old.is_done then
    if exists (select 1 from public.notes where id = new.note_id and kind = 'permanent') then
      insert into public.completed_items (note_id, item_id, text, completed_by)
      values (new.note_id, new.id, new.text, (select auth.uid()));
    end if;
  elsif old.is_done and not new.is_done then
    delete from public.completed_items
    where item_id = new.id and completed_at > now() - interval '5 minutes';
  end if;
  return new;
end;
$$;

create trigger checklist_items_log_completed
  after update of is_done on public.checklist_items
  for each row execute function private.log_completed_item();

-- Уже зачёркнутые пункты постоянных заметок — в журнал с датой последнего изменения
insert into public.completed_items (note_id, item_id, text, completed_at)
select c.note_id, c.id, c.text, c.updated_at
from public.checklist_items c
join public.notes n on n.id = c.note_id
where c.is_done and n.kind = 'permanent';

alter publication supabase_realtime add table public.completed_items;
