-- Этап 15 (ТР-12): спринты. Спринт личный: объединяет свои временные задачи
-- из разных столбцов срочности. Задача попадает в спринт через своё личное
-- место (note_members), как столбец, порядок и блок (ТР-9, ТР-11): второй
-- участник общей задачи не видит чужих спринтов.

create type public.sprint_shape as enum (
  'circle', 'square', 'triangle', 'diamond', 'hexagon', 'star', 'heart', 'shield'
);

create table public.sprints (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title        text not null check (char_length(btrim(title)) between 1 and 100),
  description  text,
  due_date     date,
  shape        public.sprint_shape not null,
  -- Заполнено — спринт завершён и лежит в архиве спринтов
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);

-- Фигура принадлежит не больше чем одному действующему спринту; после
-- завершения спринта она снова свободна
create unique index sprints_active_shape_key
  on public.sprints (owner_id, shape)
  where completed_at is null;

create index sprints_owner_id_idx on public.sprints (owner_id);

alter table public.sprints enable row level security;
revoke all on public.sprints from anon;

create policy "sprints: только свои"
  on public.sprints for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- Спринт и место задачи в нём. Архивная задача сохраняет спринт и номер
-- (на вкладке «Спринты» она видна выполненной). Удалённый спринт отпускает задачи.
alter table public.note_members
  add column sprint_id       uuid references public.sprints (id) on delete set null,
  add column sprint_position double precision;

create index note_members_sprint_id_idx
  on public.note_members (sprint_id)
  where sprint_id is not null;

grant update (sprint_id, sprint_position) on public.note_members to authenticated;

-- В своё место можно поставить только свой спринт
create function private.check_member_sprint()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.sprint_id is not null and not exists (
    select 1 from public.sprints s
    where s.id = new.sprint_id and s.owner_id = new.user_id
  ) then
    raise exception 'Спринт не найден';
  end if;
  return new;
end;
$$;

revoke all on function private.check_member_sprint() from public;

create trigger note_members_check_sprint
  before insert or update of sprint_id on public.note_members
  for each row execute function private.check_member_sprint();

-- Места нескольких своих задач одним запросом: теперь и спринт с номером
-- (перестановка задач спринта, вставка на место). Ключа нет — поле не трогается.
create or replace function public.update_my_places(p_places jsonb)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.note_members m
  set
    urgency = case when e ? 'urgency' then (e ->> 'urgency')::public.urgency else m.urgency end,
    position = case when e ? 'position' then (e ->> 'position')::double precision else m.position end,
    link_group = case when e ? 'link_group' then (e ->> 'link_group')::uuid else m.link_group end,
    sprint_id = case when e ? 'sprint_id' then (e ->> 'sprint_id')::uuid else m.sprint_id end,
    sprint_position = case
      when e ? 'sprint_position' then (e ->> 'sprint_position')::double precision
      else m.sprint_position
    end
  from jsonb_array_elements(p_places) as e
  where m.note_id = (e ->> 'note_id')::uuid
    and m.user_id = (select auth.uid());
$$;

-- Изменения спринтов приходят на другие устройства (ТР-7)
alter publication supabase_realtime add table public.sprints;
