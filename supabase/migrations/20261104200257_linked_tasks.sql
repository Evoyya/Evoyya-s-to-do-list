-- Этап 14 (ТР-11): связанные задачи. Блок — задачи с одинаковым link_group
-- в личном месте участника. Связи у каждого свои, как столбец и порядок (ТР-9):
-- второй участник общей задачи их не видит на своей доске.
-- Архивная задача сохраняет link_group: в архиве она показывается в своём блоке,
-- а при восстановлении возвращается в него.

alter table public.note_members add column link_group uuid;

create index note_members_link_group_idx
  on public.note_members (user_id, link_group)
  where link_group is not null;

grant update (link_group) on public.note_members to authenticated;

-- Несколько своих задач меняют столбец, порядок и блок одним запросом
-- (перенос блока целиком, связывание). Ключа нет в элементе — поле не трогается.
-- Работает с правами вызывающего: RLS даёт менять только свои места.
create function public.update_my_places(p_places jsonb)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.note_members m
  set
    urgency = case when e ? 'urgency' then (e ->> 'urgency')::public.urgency else m.urgency end,
    position = case when e ? 'position' then (e ->> 'position')::double precision else m.position end,
    link_group = case when e ? 'link_group' then (e ->> 'link_group')::uuid else m.link_group end
  from jsonb_array_elements(p_places) as e
  where m.note_id = (e ->> 'note_id')::uuid
    and m.user_id = (select auth.uid());
$$;

revoke execute on function public.update_my_places(jsonb) from public, anon;
grant execute on function public.update_my_places(jsonb) to authenticated;
