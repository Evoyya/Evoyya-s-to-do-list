-- Этап 1: схема базы и правила доступа (ТР-1…ТР-6, ТР-8, ТР-9)

-- ============================================================
-- Типы
-- ============================================================

create type public.note_kind as enum ('permanent', 'temporary');
create type public.urgency as enum ('critical', 'urgent', 'not_urgent', 'no_deadline');
create type public.member_role as enum ('owner', 'editor');

-- Служебные функции живут в схеме private: она не открыта через API,
-- поэтому их нельзя вызвать напрямую через RPC.
create schema if not exists private;
grant usage on schema private to authenticated;

-- ============================================================
-- Таблицы
-- ============================================================

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text unique,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

create table public.labels (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 50),
  color      text not null check (color ~ '^#[0-9a-f]{6}$'),
  created_at timestamptz not null default now(),
  -- ТР-6: у одного пользователя не может быть двух ярлыков с одним цветом
  unique (owner_id, color)
);

-- ТР-6: название уникально без учёта регистра («ДЗ» и «дз» — один ярлык)
create unique index labels_owner_name_key on public.labels (owner_id, lower(btrim(name)));

create table public.notes (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title            text not null check (char_length(btrim(title)) > 0),
  description      text,
  kind             public.note_kind not null default 'temporary',
  -- ТР-2: учитывается только для временных заметок
  urgency          public.urgency not null default 'no_deadline',
  position         double precision not null default 0,
  primary_label_id uuid,
  archived_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.checklist_items (
  id         uuid primary key default gen_random_uuid(),
  note_id    uuid not null references public.notes (id) on delete cascade,
  text       text not null default '',
  is_done    boolean not null default false,
  position   double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.note_labels (
  note_id  uuid not null references public.notes (id) on delete cascade,
  label_id uuid not null references public.labels (id) on delete cascade,
  primary key (note_id, label_id)
);

-- ТР-5: основной ярлык обязан быть одним из ярлыков заметки.
-- Если ярлык сняли с заметки, основной ярлык сбрасывается.
alter table public.notes
  add constraint notes_primary_label_fkey
  foreign key (id, primary_label_id)
  references public.note_labels (note_id, label_id)
  on delete set null (primary_label_id);

create table public.note_members (
  note_id    uuid not null references public.notes (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       public.member_role not null default 'editor',
  created_at timestamptz not null default now(),
  primary key (note_id, user_id)
);

create index notes_owner_id_idx on public.notes (owner_id);
create index checklist_items_note_id_idx on public.checklist_items (note_id, position);
create index note_labels_label_id_idx on public.note_labels (label_id);
create index note_members_user_id_idx on public.note_members (user_id);

-- ============================================================
-- Служебные функции для политик
-- security definer обходит RLS внутри проверки и не даёт политикам
-- рекурсивно вызывать друг друга.
-- ============================================================

create function private.is_note_member(p_note_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.note_members
    where note_id = p_note_id and user_id = (select auth.uid())
  );
$$;

create function private.is_note_owner(p_note_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.notes
    where id = p_note_id and owner_id = (select auth.uid())
  );
$$;

-- Ярлык виден, если он мой или висит на заметке, где я участник
-- (нужно второму участнику, чтобы сопоставить ярлык создателя со своим)
create function private.can_see_label(p_label_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.note_labels nl
    join public.note_members nm on nm.note_id = nl.note_id
    where nl.label_id = p_label_id and nm.user_id = (select auth.uid())
  );
$$;

-- Профиль виден, если у нас есть общая заметка (аватары на карточке)
create function private.shares_note_with(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.note_members me
    join public.note_members other on other.note_id = me.note_id
    where me.user_id = (select auth.uid()) and other.user_id = p_user_id
  );
$$;

revoke all on all functions in schema private from public;
grant execute on all functions in schema private to authenticated;

-- ============================================================
-- Триггеры
-- ============================================================

create function private.set_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger notes_set_updated_at
  before update on public.notes
  for each row execute function private.set_updated_at();

create trigger checklist_items_set_updated_at
  before update on public.checklist_items
  for each row execute function private.set_updated_at();

-- Профиль создаётся при первой регистрации через Google
create function private.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Создатель заметки автоматически становится её участником-владельцем
create function private.add_note_owner()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.note_members (note_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

create trigger notes_add_owner
  after insert on public.notes
  for each row execute function private.add_note_owner();

-- Участник общей заметки может её редактировать, но не может присвоить её себе
create function private.prevent_owner_change()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception 'Нельзя сменить владельца заметки';
  end if;
  return new;
end;
$$;

create trigger notes_prevent_owner_change
  before update on public.notes
  for each row execute function private.prevent_owner_change();

-- ============================================================
-- RLS
-- ============================================================

alter table public.profiles        enable row level security;
alter table public.labels          enable row level security;
alter table public.notes           enable row level security;
alter table public.checklist_items enable row level security;
alter table public.note_labels     enable row level security;
alter table public.note_members    enable row level security;

-- Анонимным пользователям доступ к данным не нужен вообще
revoke all on all tables in schema public from anon;

-- profiles ---------------------------------------------------

create policy "profiles: свой и соучастников"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.shares_note_with(id));

create policy "profiles: правка своего"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- labels (ТР-5, ТР-6) ----------------------------------------

create policy "labels: свои и на общих заметках"
  on public.labels for select to authenticated
  using (owner_id = (select auth.uid()) or private.can_see_label(id));

create policy "labels: создание своих"
  on public.labels for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "labels: правка своих"
  on public.labels for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "labels: удаление своих"
  on public.labels for delete to authenticated
  using (owner_id = (select auth.uid()));

-- notes (ТР-1, ТР-2, ТР-3, ТР-8, ТР-9) -----------------------

-- owner_id в условии нужен для insert … returning: строка в note_members
-- появляется триггером позже, чем проверяется returning
create policy "notes: участник видит"
  on public.notes for select to authenticated
  using (owner_id = (select auth.uid()) or private.is_note_member(id));

create policy "notes: создание своих"
  on public.notes for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "notes: участник редактирует"
  on public.notes for update to authenticated
  using (private.is_note_member(id))
  with check (private.is_note_member(id));

create policy "notes: удаляет только владелец"
  on public.notes for delete to authenticated
  using (owner_id = (select auth.uid()));

-- checklist_items (ТР-4) -------------------------------------

create policy "checklist_items: участник видит"
  on public.checklist_items for select to authenticated
  using (private.is_note_member(note_id));

create policy "checklist_items: участник добавляет"
  on public.checklist_items for insert to authenticated
  with check (private.is_note_member(note_id));

create policy "checklist_items: участник редактирует"
  on public.checklist_items for update to authenticated
  using (private.is_note_member(note_id))
  with check (private.is_note_member(note_id));

create policy "checklist_items: участник удаляет"
  on public.checklist_items for delete to authenticated
  using (private.is_note_member(note_id));

-- note_labels (ТР-5, ТР-9: на заметке только ярлыки создателя) --

create policy "note_labels: участник видит"
  on public.note_labels for select to authenticated
  using (private.is_note_member(note_id));

create policy "note_labels: владелец вешает свои ярлыки"
  on public.note_labels for insert to authenticated
  with check (
    private.is_note_owner(note_id)
    and exists (
      select 1 from public.labels l
      where l.id = label_id and l.owner_id = (select auth.uid())
    )
  );

create policy "note_labels: владелец снимает"
  on public.note_labels for delete to authenticated
  using (private.is_note_owner(note_id));

-- note_members (ТР-9) ----------------------------------------
-- Добавление участников — только через share_note() ниже.

create policy "note_members: участник видит состав"
  on public.note_members for select to authenticated
  using (private.is_note_member(note_id));

create policy "note_members: владелец убирает участника или участник выходит сам"
  on public.note_members for delete to authenticated
  using (
    role <> 'owner'
    and (private.is_note_owner(note_id) or user_id = (select auth.uid()))
  );

-- ============================================================
-- RPC: поделиться заметкой по email (ТР-9)
-- ============================================================

create function public.share_note(p_note_id uuid, p_email text)
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
    raise exception 'Пользователь % ещё не входил в приложение', p_email;
  end if;

  if v_user_id = (select auth.uid()) then
    raise exception 'Нельзя поделиться заметкой с самим собой';
  end if;

  insert into public.note_members (note_id, user_id, role)
  values (p_note_id, v_user_id, 'editor')
  on conflict do nothing;

  return v_user_id;
end;
$$;

revoke all on function public.share_note(uuid, text) from public, anon;
grant execute on function public.share_note(uuid, text) to authenticated;
