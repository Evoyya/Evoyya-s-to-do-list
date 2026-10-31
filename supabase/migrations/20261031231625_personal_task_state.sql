-- Этап 9 (ТР-9): у временной задачи у каждого участника своё место —
-- столбец срочности, порядок и архив. Постоянные заметки общие целиком
-- и берут эти поля из самой заметки.

alter table public.note_members
  add column urgency     public.urgency not null default 'no_deadline',
  add column position    double precision not null default 0,
  add column archived_at timestamptz;

-- Текущие значения заметок становятся личными значениями участников
update public.note_members m
set urgency = n.urgency, position = n.position, archived_at = n.archived_at
from public.notes n
where n.id = m.note_id;

-- Создатель получает своё место сразу таким, как он задал при создании
create or replace function private.add_note_owner()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.note_members (note_id, user_id, role, urgency, position, archived_at)
  values (new.id, new.owner_id, 'owner', new.urgency, new.position, new.archived_at);
  return new;
end;
$$;

-- Новый участник начинает с того же столбца и места, что и владелец
create or replace function public.share_note(p_note_id uuid, p_email text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  if not private.is_note_owner(p_note_id) then
    raise exception 'Поделиться заметкой может только её владелец';
  end if;

  select id into v_user_id
  from public.profiles
  where email = lower(btrim(p_email));

  if v_user_id is null then
    raise exception 'Пользователь % ещё не входил в приложение', btrim(p_email);
  end if;

  if v_user_id = (select auth.uid()) then
    raise exception 'Нельзя поделиться заметкой с самим собой';
  end if;

  insert into public.note_members (note_id, user_id, role, urgency, position)
  select p_note_id, v_user_id, 'editor', m.urgency, m.position
  from public.note_members m
  where m.note_id = p_note_id and m.role = 'owner'
  on conflict do nothing;

  return v_user_id;
end;
$$;

-- Участник меняет только своё место; роль и принадлежность не трогаются
revoke update on public.note_members from authenticated;
grant update (urgency, position, archived_at) on public.note_members to authenticated;

create policy "note_members: участник меняет своё место"
  on public.note_members for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
