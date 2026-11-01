-- Выполняется после восстановления бэкапа в новый проект Supabase.
-- Выгрузка схемы не включает служебную схему auth, поэтому триггер
-- на auth.users из первой миграции приходится создать заново —
-- без него у новых пользователей не появится профиль.
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();
