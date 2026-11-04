-- Тесты схемы и правил доступа (ТР-1…ТР-6, ТР-8, ТР-9).
-- Запуск: supabase test db

begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(38);

-- ------------------------------------------------------------
-- Тестовые данные: пользователь A (создатель) и B (девушка)
-- ------------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'A@test.local', '{"full_name": "User A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local', '{"full_name": "User B"}');

select is(
  (select count(*)::int from public.profiles where email in ('a@test.local', 'b@test.local')),
  2, 'Профили создаются при регистрации, email в нижнем регистре'
);

-- ------------------------------------------------------------
-- Пользователь A
-- ------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000000a"}', true);

insert into public.notes (id, title, kind, urgency) values
  ('10000000-0000-0000-0000-000000000001', 'Тестирование Лаб 5', 'temporary', 'critical'),
  ('10000000-0000-0000-0000-000000000002', 'Магазин', 'permanent', 'no_deadline');

select is(
  (select count(*)::int from public.note_members where user_id = '00000000-0000-0000-0000-00000000000a' and role = 'owner'),
  2, 'Создатель автоматически становится владельцем заметки'
);

select is(
  (select urgency::text from public.notes where title = 'Тестирование Лаб 5'),
  'critical', 'ТР-2: заметка лежит в выбранном столбце'
);

select throws_ok(
  $$ insert into public.notes (title) values ('   ') $$,
  '23514', null, 'ТР-3: заметку без названия сохранить нельзя'
);

insert into public.notes (title) values ('Без столбца');

select is(
  (select urgency::text from public.notes where title = 'Без столбца'),
  'no_deadline', 'ТР-2: по умолчанию заметка попадает в «Без дедлайна»'
);

insert into public.labels (id, name, color) values
  ('20000000-0000-0000-0000-000000000001', 'Дом', '#22aa55'),
  ('20000000-0000-0000-0000-000000000002', 'Секрет', '#000000');

select throws_ok(
  $$ insert into public.labels (name, color) values ('Другой', '#22aa55') $$,
  '23505', null, 'ТР-6: цвет ярлыка уникален у пользователя'
);

select throws_ok(
  $$ insert into public.labels (name, color) values (' дом ', '#123456') $$,
  '23505', null, 'ТР-6: название ярлыка уникально без учёта регистра'
);

insert into public.note_labels (note_id, label_id)
  values ('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001');

update public.notes set primary_label_id = '20000000-0000-0000-0000-000000000001'
  where id = '10000000-0000-0000-0000-000000000002';

select throws_ok(
  $$ update public.notes set primary_label_id = '20000000-0000-0000-0000-000000000002'
     where id = '10000000-0000-0000-0000-000000000002' $$,
  '23503', null, 'ТР-5: основной ярлык должен висеть на заметке'
);

insert into public.checklist_items (id, note_id, text, position) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'Йогурт', 1),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Яйца', 2);

select lives_ok(
  $$ select public.share_note('10000000-0000-0000-0000-000000000002', ' B@test.local ') $$,
  'ТР-9: владелец делится заметкой по email'
);

select throws_ok(
  $$ select public.share_note('10000000-0000-0000-0000-000000000002', 'nobody@test.local') $$,
  'P0001', null, 'ТР-9: нельзя поделиться с тем, кто не входил в приложение'
);

-- ------------------------------------------------------------
-- Пользователь B
-- ------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000000b"}', true);

select results_eq(
  $$ select title from public.notes $$,
  $$ values ('Магазин'::text) $$,
  'ТР-9: B видит только общую заметку, личные заметки A скрыты'
);

select results_eq(
  $$ select name from public.labels $$,
  $$ values ('Дом'::text) $$,
  'ТР-9: B видит ярлык создателя на общей заметке, но не остальные ярлыки A'
);

select is(
  (select count(*)::int from public.profiles),
  2, 'B видит свой профиль и профиль соучастника'
);

update public.checklist_items set is_done = true where id = '30000000-0000-0000-0000-000000000001';
update public.notes set title = 'Магазин (правка B)' where id = '10000000-0000-0000-0000-000000000002';

-- Попытки B изменить чужое: строки просто не находятся
update public.notes set title = 'Взлом' where id = '10000000-0000-0000-0000-000000000001';
delete from public.notes where id = '10000000-0000-0000-0000-000000000002';

select throws_ok(
  $$ update public.notes set owner_id = '00000000-0000-0000-0000-00000000000b'
     where id = '10000000-0000-0000-0000-000000000002' $$,
  'P0001', null, 'ТР-9: участник не может присвоить себе заметку'
);

insert into public.labels (id, name, color)
  values ('20000000-0000-0000-0000-00000000000b', 'Дом', '#22aa55');

select is(
  (select count(*)::int from public.labels where owner_id = '00000000-0000-0000-0000-00000000000b'),
  1, 'ТР-9: B может создать такой же ярлык у себя'
);

select throws_ok(
  $$ insert into public.note_labels (note_id, label_id)
     values ('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-00000000000b') $$,
  '42501', null, 'ТР-9: на общей заметке только ярлыки создателя'
);

select throws_ok(
  $$ select public.share_note('10000000-0000-0000-0000-000000000002', 'a@test.local') $$,
  'P0001', null, 'ТР-9: делиться может только владелец'
);

-- ------------------------------------------------------------
-- Снова A: проверяем, что изменения B видны, а попытки взлома — нет
-- ------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000000a"}', true);

select ok(
  (select is_done from public.checklist_items where id = '30000000-0000-0000-0000-000000000001'),
  'ТР-4, ТР-9: пункт, отмеченный B, зачёркнут у A'
);

select is(
  (select title from public.notes where id = '10000000-0000-0000-0000-000000000002'),
  'Магазин (правка B)', 'ТР-9: правка названия от B видна A'
);

select is(
  (select title from public.notes where id = '10000000-0000-0000-0000-000000000001'),
  'Тестирование Лаб 5', 'ТР-9: B не может изменить личную заметку A'
);

select is(
  (select count(*)::int from public.notes where id = '10000000-0000-0000-0000-000000000002'),
  1, 'ТР-9: B не может удалить общую заметку'
);

-- ТР-8: архивация сохраняет столбец
update public.notes set archived_at = now() where id = '10000000-0000-0000-0000-000000000001';
update public.notes set archived_at = null where id = '10000000-0000-0000-0000-000000000001';

select is(
  (select urgency::text from public.notes where id = '10000000-0000-0000-0000-000000000001'),
  'critical', 'ТР-8: восстановленная заметка возвращается в свой столбец'
);

-- ТР-5: снятие основного ярлыка сбрасывает цвет карточки
delete from public.note_labels
  where note_id = '10000000-0000-0000-0000-000000000002'
    and label_id = '20000000-0000-0000-0000-000000000001';

select is(
  (select primary_label_id from public.notes where id = '10000000-0000-0000-0000-000000000002'),
  null::uuid, 'ТР-5: после снятия ярлыка основной ярлык сбрасывается'
);

-- ------------------------------------------------------------
-- Журнал выполненных пунктов постоянных заметок (архив покупок)
-- ------------------------------------------------------------

select is(
  (select count(*)::int from public.completed_items
   where note_id = '10000000-0000-0000-0000-000000000002'
     and completed_by = '00000000-0000-0000-0000-00000000000b'),
  1, 'Пункт постоянной заметки, зачёркнутый B, попал в архив с отметкой, кто зачеркнул'
);

insert into public.checklist_items (id, note_id, text)
  values ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Отчёт');
update public.checklist_items set is_done = true where id = '30000000-0000-0000-0000-000000000003';

select is(
  (select count(*)::int from public.completed_items
   where note_id = '10000000-0000-0000-0000-000000000001'),
  0, 'Пункты временной задачи в журнал не попадают (они уходят в архив вместе с задачей)'
);

update public.checklist_items set is_done = false where id = '30000000-0000-0000-0000-000000000001';

select is(
  (select count(*)::int from public.completed_items
   where item_id = '30000000-0000-0000-0000-000000000001'),
  0, 'Отметка, снятая в течение 5 минут, считается ошибкой и убирается из архива'
);

select throws_ok(
  $$ insert into public.completed_items (note_id, text)
     values ('10000000-0000-0000-0000-000000000002', 'подделка') $$,
  '42501', null, 'Записи в журнал добавляет только база, не приложение'
);

update public.checklist_items set is_done = true where id = '30000000-0000-0000-0000-000000000002';

-- ------------------------------------------------------------
-- Этап 9: у временной задачи у каждого своё место (столбец, порядок, архив)
-- ------------------------------------------------------------

select public.share_note('10000000-0000-0000-0000-000000000001', 'b@test.local');

select is(
  (select urgency::text from public.note_members
   where note_id = '10000000-0000-0000-0000-000000000001'
     and user_id = '00000000-0000-0000-0000-00000000000b'),
  'critical', 'ТР-9: новый участник начинает со столбца владельца'
);

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000000b"}', true);

update public.note_members set urgency = 'no_deadline', archived_at = now()
  where note_id = '10000000-0000-0000-0000-000000000001'
    and user_id = '00000000-0000-0000-0000-00000000000b';

-- Место A для B недоступно: строка просто не находится
update public.note_members set urgency = 'urgent'
  where note_id = '10000000-0000-0000-0000-000000000001'
    and user_id = '00000000-0000-0000-0000-00000000000a';

select throws_ok(
  $$ update public.note_members set role = 'owner'
     where note_id = '10000000-0000-0000-0000-000000000001'
       and user_id = '00000000-0000-0000-0000-00000000000b' $$,
  '42501', null, 'ТР-9: участник не может сменить себе роль'
);

select is(
  (select count(*)::int from public.note_members
   where note_id = '10000000-0000-0000-0000-000000000001'
     and user_id = '00000000-0000-0000-0000-00000000000b'
     and archived_at is not null),
  1, 'ТР-9: B отправляет общую задачу в свой архив'
);

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000000a"}', true);

select is(
  (select urgency::text || ', в архиве: ' || (archived_at is not null)::text
   from public.note_members
   where note_id = '10000000-0000-0000-0000-000000000001'
     and user_id = '00000000-0000-0000-0000-00000000000a'),
  'critical, в архиве: false', 'ТР-9: действия B не двигают задачу у A'
);

-- ------------------------------------------------------------
-- Этап 14 (ТР-11): связи задач личные
-- ------------------------------------------------------------

select public.update_my_places(
  '[{"note_id": "10000000-0000-0000-0000-000000000001", "link_group": "50000000-0000-0000-0000-000000000001", "urgency": "urgent"}]'
);

select is(
  (select link_group::text || ', ' || urgency::text from public.note_members
   where note_id = '10000000-0000-0000-0000-000000000001'
     and user_id = '00000000-0000-0000-0000-00000000000a'),
  '50000000-0000-0000-0000-000000000001, urgent', 'ТР-11: A связывает задачу и переносит её одним запросом'
);

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000000b"}', true);

select public.update_my_places(
  '[{"note_id": "10000000-0000-0000-0000-000000000001", "link_group": "60000000-0000-0000-0000-000000000001"}]'
);

select is(
  (select link_group::text from public.note_members
   where note_id = '10000000-0000-0000-0000-000000000001'
     and user_id = '00000000-0000-0000-0000-00000000000b'),
  '60000000-0000-0000-0000-000000000001', 'ТР-11: B связывает общую задачу у себя'
);

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000000a"}', true);

select is(
  (select link_group::text from public.note_members
   where note_id = '10000000-0000-0000-0000-000000000001'
     and user_id = '00000000-0000-0000-0000-00000000000a'),
  '50000000-0000-0000-0000-000000000001', 'ТР-11: связи B не меняют связи A'
);

-- A закрывает доступ к задаче
delete from public.note_members
  where note_id = '10000000-0000-0000-0000-000000000001'
    and user_id = '00000000-0000-0000-0000-00000000000b';

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000000b"}', true);

select is(
  (select count(*)::int from public.notes where id = '10000000-0000-0000-0000-000000000001'),
  0, 'ТР-9: после закрытия доступа B не видит задачу'
);

-- B сам выходит из общей заметки
delete from public.note_members
  where note_id = '10000000-0000-0000-0000-000000000002'
    and user_id = '00000000-0000-0000-0000-00000000000b';

select is(
  (select count(*)::int from public.notes),
  0, 'ТР-9: B может выйти из общей заметки'
);

select is(
  (select count(*)::int from public.completed_items),
  0, 'Вышедший из общей заметки не видит её журнал выполненных пунктов'
);

-- ------------------------------------------------------------
-- Анонимный пользователь
-- ------------------------------------------------------------

set local role anon;

select throws_ok(
  $$ select count(*) from public.notes $$,
  '42501', null, 'Без входа данные недоступны'
);

select * from finish();
rollback;
