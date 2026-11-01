-- Необязательный дедлайн временной задачи (общий для всех участников, как название)
alter table public.notes add column due_date date;
