# Olfat Backend — Mobile Business Management System

Laravel API + staff UI for the business management system.

## Stack

- PHP 8.3+
- Laravel 13
- Laravel Sanctum
- MySQL (production) — SQLite is fine for local development

## Local setup

1. Install PHP 8.3+ and Composer (or use `.tools` if present).
2. `copy .env.example .env` (Windows) or `cp .env.example .env`
3. `composer install`
4. `php artisan key:generate`
5. Keep `DB_CONNECTION=sqlite` locally, or configure MySQL.
6. `php artisan migrate --seed`
7. `php artisan serve`
8. Open `http://127.0.0.1:8000/pages/login.html`

Local seeded users (password from `SEED_USER_PASSWORD`, default `password`):

- `user1@example.com` (admin)
- `user2@example.com` (staff)
- `user3@example.com` (staff)

## Production deployment

- **Hostinger (Unlimited / shared):** full step-by-step from payment → domain → GitHub → 3 users in **`HOSTINGER_DEPLOY.md`**.
- **Vercel (serverless):** step-by-step guide in **`VERCEL_DEPLOY.md`** (uses `vercel.json`, `api/index.php`, `.env.vercel.example`).
- **Classic server (Nginx/Apache + PHP-FPM):** see **`DEPLOY.md`** and **`.env.production.example`**.

## Operations (DBA)

| Command | Purpose |
|---|---|
| `php artisan db:backup` | Verified, compressed logical backup with retention (scheduled daily 02:00) |
| `php artisan db:integrity-check` | Referential + business-rule audit, exit code 1 on problems (scheduled weekly) |
| `GET /api/health` | DB + cache probe for uptime monitors (200 / 503) |
| `GET /api/v1/audit-logs` | Admin-only change history (who/what/when/old/new) |

Runbooks: `docs/BACKUP_AND_RECOVERY.md`, `docs/DBA_COMPLIANCE_REPORT.md`, `docs/DATA_DICTIONARY.md`.

Quick check after configuring production `.env`:

```bash
php scripts/prepare-production.php
```

## Tests

```bash
php artisan test
```

## Profit & Loss

Business P&L uses **weighted average** purchase cost for COGS. Home expenses are excluded from business net profit.

## API docs

See `docs/API_INDEX.md` and phase docs under `docs/`.
