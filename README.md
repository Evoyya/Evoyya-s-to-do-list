# Task-менеджер

Замена Google Keep для двоих: постоянные заметки и временные задачи по срочности,
ярлыки с цветом, архив, общие заметки, статистика. Работает в браузере и
устанавливается как приложение на iPhone, Windows и macOS.

- Приложение: https://evoyya-s-to-do-list.vercel.app
- Требования: [REQUIREMENTS.md](REQUIREMENTS.md), план: [ROADMAP.md](ROADMAP.md), стек: [STACK.md](STACK.md)

## Разработка

```bash
npm install
npm run dev          # http://localhost:5173
npm run lint         # oxlint
npm run typecheck    # TypeScript
npm test             # unit-тесты (Vitest)
npm run build        # сборка в dist/
npm run icons        # значки приложения из public/icon.svg
```

Переменные окружения — в `.env.local` (образец в `.env.example`).

Тесты правил доступа к базе (pgTAP) запускаются в Docker:

```bash
npx supabase db start
npx supabase test db
```

## Автопроверки (GitHub Actions)

| Workflow | Когда | Что делает |
|---|---|---|
| `CI` | каждый push в `main` и pull request | lint, форматирование, типы, unit-тесты, сборка; отдельно — миграции и тесты RLS на локальной базе |
| `Backup` | каждый день в 05:30 МСК и вручную | выгружает базу, шифрует и сохраняет как artifact на 30 дней |
| `Restore test` | вручную | разворачивает бэкап в отдельный тестовый проект и считает строки |

Деплой делает Vercel сам при каждом push в `main`.

## Бэкапы

### Настройка (один раз)

В GitHub: репозиторий → **Settings → Secrets and variables → Actions → New repository secret**.

1. **`SUPABASE_DB_URL`** — строка подключения к рабочей базе.
   Supabase → проект → кнопка **Connect** → **Session pooler** (GitHub не умеет IPv6,
   поэтому нужен именно pooler). Вида
   `postgresql://postgres.zxkdvwwxxbdvdikdrojh:[ПАРОЛЬ]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`.
   Пароль базы — тот, что задавали при создании проекта; если забыли — **Project Settings → Database → Reset database password**.
2. **`BACKUP_PASSPHRASE`** — придуманный длинный пароль для шифрования бэкапов.
   **Сохраните его в менеджере паролей**: без него бэкап не расшифровать.

Репозиторий публичный: скачать artifact может любой вошедший в GitHub, поэтому бэкап
всегда зашифрован (GPG, AES-256).

### Где лежат бэкапы

GitHub → **Actions → Backup** → нужный запуск → **Artifacts → database-backup**.
Внутри `backup-ГГГГ-ММ-ДД.tar.gz.gpg` с тремя файлами: `roles.sql`, `schema.sql`, `data.sql`.

Расшифровать вручную:

```bash
gpg -o backup.tar.gz --decrypt backup-2026-11-01.tar.gz.gpg
tar -xzf backup.tar.gz
```

### Восстановление

1. Создайте **новый пустой** проект Supabase (в уже восстановленный повторно не развернуть —
   таблицы там уже есть; тестовый проект для повторной проверки удалите и создайте заново).
2. Добавьте секрет **`RESTORE_DB_URL`** — строку Session pooler **нового** проекта.
   Workflow откажется работать, если строка указывает на рабочую базу.
3. **Actions → Restore test → Run workflow**. Без параметров берётся последний успешный бэкап.
4. В логе последнего шага — число восстановленных пользователей, заметок, пунктов, ярлыков
   и `signup_trigger = 1`.

Восстанавливается всё, кроме триггера на `auth.users` (служебная схема Supabase не входит
в выгрузку): его создаёт [supabase/restore/after-restore.sql](supabase/restore/after-restore.sql).
Без него у новых пользователей не появится профиль. При восстановлении вручную выполните
этот файл последним. Предупреждение про `log_min_messages` в шаге ролей — нормально.

Чтобы перенести приложение на восстановленный проект, поменяйте `VITE_SUPABASE_URL` и
`VITE_SUPABASE_PUBLISHABLE_KEY` в Vercel и добавьте адрес нового проекта в настройки
Google OAuth (Authorized redirect URIs: `https://<новый-ref>.supabase.co/auth/v1/callback`).

## Если Supabase поставил проект на паузу

Бесплатный проект Supabase засыпает после 7 дней без активности. Приложение тогда
не загружает заметки. Ежедневный бэкап обращается к базе и обычно не даёт ей уснуть.

Как включить:

1. Откройте https://supabase.com/dashboard → проект **evoyya-s-to-do-list**.
2. Нажмите **Restore project** (или **Resume**) и подождите несколько минут.
3. Обновите страницу приложения — данные на месте, пауза их не удаляет.

Если проект на паузе больше 90 дней, восстановить его из панели уже нельзя — тогда
нужен бэкап (см. выше).
