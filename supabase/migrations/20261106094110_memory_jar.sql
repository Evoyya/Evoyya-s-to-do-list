-- Этап 16.1 (ТР-13): банка воспоминаний. Отдельный раздел, с задачами не связан.
-- Банка общая на пару: у пользователя не больше одной банки, в банке не больше
-- двух участников. Воспоминания видят оба, правит и удаляет только автор.

-- ============================================================
-- Таблицы
-- ============================================================

create table public.memory_jars (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.memory_jar_members (
  jar_id     uuid not null references public.memory_jars (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       public.member_role not null default 'editor',
  created_at timestamptz not null default now(),
  primary key (jar_id, user_id)
);

-- Пользователь состоит не больше чем в одной банке
create unique index memory_jar_members_user_id_key on public.memory_jar_members (user_id);

create table public.memories (
  id          uuid primary key default gen_random_uuid(),
  jar_id      uuid not null references public.memory_jars (id) on delete cascade,
  -- Удалённый аккаунт не уносит воспоминания из банки
  author_id   uuid default auth.uid() references public.profiles (id) on delete set null,
  title       text check (title is null or char_length(btrim(title)) between 1 and 40),
  body        text not null check (btrim(body) <> '' and char_length(body) <= 280),
  -- Будущую дату запрещает интерфейс по местному времени; здесь запас в сутки,
  -- потому что current_date в базе — по UTC
  memory_date date not null default current_date check (memory_date <= current_date + 1),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index memories_jar_date_idx on public.memories (jar_id, memory_date desc);
create index memories_author_id_idx on public.memories (author_id);

create trigger memories_set_updated_at
  before update on public.memories
  for each row execute function private.set_updated_at();

-- ============================================================
-- Служебные функции для политик
-- ============================================================

create function private.is_jar_member(p_jar_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memory_jar_members
    where jar_id = p_jar_id and user_id = (select auth.uid())
  );
$$;

create function private.is_jar_owner(p_jar_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memory_jar_members
    where jar_id = p_jar_id and user_id = (select auth.uid()) and role = 'owner'
  );
$$;

-- Профиль участника банки виден (автор в окне воспоминания)
create function private.shares_jar_with(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memory_jar_members me
    join public.memory_jar_members other on other.jar_id = me.jar_id
    where me.user_id = (select auth.uid()) and other.user_id = p_user_id
  );
$$;

revoke all on function private.is_jar_member(uuid) from public;
revoke all on function private.is_jar_owner(uuid) from public;
revoke all on function private.shares_jar_with(uuid) from public;
grant execute on function private.is_jar_member(uuid) to authenticated;
grant execute on function private.is_jar_owner(uuid) to authenticated;
grant execute on function private.shares_jar_with(uuid) to authenticated;

-- ============================================================
-- RLS
-- ============================================================

alter table public.memory_jars        enable row level security;
alter table public.memory_jar_members enable row level security;
alter table public.memories           enable row level security;

revoke all on public.memory_jars, public.memory_jar_members, public.memories from anon;

-- Автор и банка воспоминания не меняются: править можно только содержимое
revoke update on public.memories from authenticated;
grant update (title, body, memory_date) on public.memories to authenticated;

create policy "profiles: участник общей банки"
  on public.profiles for select to authenticated
  using (private.shares_jar_with(id));

-- Банки и участники создаются только функциями ensure_my_jar() и share_jar()
create policy "memory_jars: участник видит"
  on public.memory_jars for select to authenticated
  using (private.is_jar_member(id));

create policy "memory_jar_members: участник видит состав"
  on public.memory_jar_members for select to authenticated
  using (private.is_jar_member(jar_id));

create policy "memory_jar_members: владелец убирает участника или участник выходит сам"
  on public.memory_jar_members for delete to authenticated
  using (
    role <> 'owner'
    and (private.is_jar_owner(jar_id) or user_id = (select auth.uid()))
  );

create policy "memories: участник видит"
  on public.memories for select to authenticated
  using (private.is_jar_member(jar_id));

create policy "memories: участник добавляет от своего имени"
  on public.memories for insert to authenticated
  with check (author_id = (select auth.uid()) and private.is_jar_member(jar_id));

create policy "memories: правит только автор"
  on public.memories for update to authenticated
  using (author_id = (select auth.uid()) and private.is_jar_member(jar_id))
  with check (author_id = (select auth.uid()) and private.is_jar_member(jar_id));

create policy "memories: удаляет только автор"
  on public.memories for delete to authenticated
  using (author_id = (select auth.uid()) and private.is_jar_member(jar_id));

-- ============================================================
-- RPC
-- ============================================================

-- Банка пользователя; при первом заходе создаётся, пользователь — её владелец
create function public.ensure_my_jar()
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_jar_id uuid;
begin
  if v_uid is null then
    raise exception 'Нужно войти в приложение';
  end if;

  select jar_id into v_jar_id from public.memory_jar_members where user_id = v_uid;
  if v_jar_id is not null then
    return v_jar_id;
  end if;

  insert into public.memory_jars (owner_id) values (v_uid) returning id into v_jar_id;

  insert into public.memory_jar_members (jar_id, user_id, role)
  values (v_jar_id, v_uid, 'owner')
  on conflict (user_id) do nothing;

  -- Банку параллельно создала другая вкладка — возвращаем её, свою убираем
  if not found then
    delete from public.memory_jars where id = v_jar_id;
    select jar_id into v_jar_id from public.memory_jar_members where user_id = v_uid;
  end if;

  return v_jar_id;
end;
$$;

-- Владелец приглашает второго участника по email (как share_note, ТР-9).
-- Пустая банка приглашённого удаляется; банки с воспоминаниями не сливаются.
create function public.share_jar(p_email text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid       uuid := (select auth.uid());
  v_jar_id    uuid;
  v_user_id   uuid;
  v_other_jar uuid;
begin
  select jar_id into v_jar_id
  from public.memory_jar_members
  where user_id = v_uid and role = 'owner';

  if v_jar_id is null then
    raise exception 'Пригласить в банку может только её владелец';
  end if;

  -- Два одновременных приглашения не превратят пару в тройку
  perform 1 from public.memory_jars where id = v_jar_id for update;

  select id into v_user_id
  from public.profiles
  where email = lower(btrim(p_email));

  if v_user_id is null then
    raise exception 'Пользователь % ещё не входил в приложение', p_email;
  end if;

  if v_user_id = v_uid then
    raise exception 'Нельзя пригласить в банку самого себя';
  end if;

  if exists (
    select 1 from public.memory_jar_members
    where jar_id = v_jar_id and user_id = v_user_id
  ) then
    return v_user_id;
  end if;

  if (select count(*) from public.memory_jar_members where jar_id = v_jar_id) >= 2 then
    raise exception 'В банке уже двое участников';
  end if;

  select jar_id into v_other_jar
  from public.memory_jar_members
  where user_id = v_user_id;

  if v_other_jar is not null then
    if exists (select 1 from public.memories where jar_id = v_other_jar) then
      raise exception 'У % уже есть своя банка с воспоминаниями', p_email;
    end if;
    if (select count(*) from public.memory_jar_members where jar_id = v_other_jar) > 1 then
      raise exception '% уже состоит в другой банке', p_email;
    end if;
    delete from public.memory_jars where id = v_other_jar;
  end if;

  insert into public.memory_jar_members (jar_id, user_id, role)
  values (v_jar_id, v_user_id, 'editor');

  return v_user_id;
end;
$$;

revoke all on function public.ensure_my_jar() from public, anon;
revoke all on function public.share_jar(text) from public, anon;
grant execute on function public.ensure_my_jar() to authenticated;
grant execute on function public.share_jar(text) to authenticated;

-- ============================================================
-- Realtime (ТР-7): новое сердечко появляется у второго участника
-- ============================================================

alter publication supabase_realtime add table
  public.memory_jars,
  public.memory_jar_members,
  public.memories;
