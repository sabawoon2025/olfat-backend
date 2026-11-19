# Deploy Olfat Backend on Hostinger (Unlimited / shared)

Use this after you pay for the Hostinger Unlimited cart.  
GitHub repo: `https://github.com/sabawoon2025/olfat-backend`

This app is **Laravel + MySQL + staff UI in `public/`**.  
Login page after deploy: `https://YOUR-DOMAIN/pages/login.html`

---

## Before you start (checklist)

Prepare these on paper / password manager:

| Item | Value |
|------|---------|
| Domain you will claim | e.g. `olfatbusiness.com` |
| MySQL database name | (Hostinger will generate a prefix) |
| MySQL username | (Hostinger will generate) |
| MySQL password | strong unique password |
| **Kabul admin** | `olfatkabul@gmail.com` + password **≥ 12 chars** |
| **Maidan admin** | `olfatmaidan@gmail.com` + password **≥ 12 chars** |
| **Ghazni admin** | `olfatghazni@gmail.com` + password **≥ 12 chars** |

All three get the same **Admin** role and full system access (equal users from three locations).

Do **not** use demo logins (`user1@example.com` / `password`) on the live site.

> Fix typos before seeding: use `gmail.com`, not `gamil.com`, or password-reset mail will never arrive.

---

## Step 1 — Finish Hostinger payment

1. Open your cart and complete payment.
2. Log in to [hPanel](https://hpanel.hostinger.com).
3. Skip optional add-ons (email marketing, etc.) if you already skipped them at checkout.

---

## Step 2 — Claim free domain

1. In hPanel go to **Domains**.
2. Claim the **free domain** included with the plan (`.com`, `.net`, `.org`, etc.).
3. Wait until status is **Active**.
4. Write down the exact domain (example: `yourdomain.com`).

If DNS is still “Pending”, wait 15–60 minutes before testing the website.

---

## Step 3 — Create website / hosting for that domain

1. hPanel → **Websites** → **Add website** (or manage the one Hostinger created).
2. Choose **Empty website** / skip WordPress builder (you are deploying Laravel, not WordPress).
3. Attach your claimed domain.

---

## Step 4 — Enable SSL (HTTPS)

1. Website dashboard → **Security** → **SSL**.
2. Enable **Free SSL** (Let’s Encrypt).
3. Turn on **Force HTTPS** if available.
4. Confirm `https://yourdomain.com` loads (even if it shows Hostinger empty page for now).

---

## Step 5 — Set PHP 8.3 or 8.4

1. Website → **Advanced** → **PHP Configuration** (or **PHP version**).
2. Select **PHP 8.3** or **8.4** (required for this project).
3. Enable these extensions if you can toggle them:
   - `pdo_mysql`, `mbstring`, `openssl`, `tokenizer`, `xml`, `ctype`, `json`, `fileinfo`, `curl`, `bcmath`

---

## Step 6 — Create MySQL database

1. hPanel → **Databases** → **Management** → **Create database**.
2. Create:
   - Database
   - User
   - Password (save it)
3. Assign the user to the database with **All privileges**.
4. Note these exact values for `.env`:

| Laravel key | Where to get it |
|-------------|-----------------|
| `DB_HOST` | Usually `localhost` or the host shown in hPanel (sometimes `127.0.0.1`) |
| `DB_PORT` | `3306` |
| `DB_DATABASE` | full database name (often like `u123456789_olfat`) |
| `DB_USERNAME` | full username (often like `u123456789_olfat`) |
| `DB_PASSWORD` | the password you set |

---

## Step 7 — Enable SSH

1. hPanel → **Advanced** → **SSH Access**.
2. Enable SSH.
3. Note:
   - Host / IP
   - Port (often `65002` or `22`)
   - Username
4. On your Windows PC (PowerShell):

```powershell
ssh -p 65002 YOUR_SSH_USERNAME@YOUR_SERVER_IP
```

(Use the port Hostinger shows. Enter the SSH password when asked.)

---

## Step 8 — Deploy code from GitHub

Hostinger Git can pull the repo, but it does **not** run Composer. Prefer **SSH + git clone** (most reliable for Laravel).

### 8A. Preferred: clone with SSH

After you are logged in via SSH:

```bash
# Go to your domain folder (path may look like this — check with `pwd` / File Manager):
cd ~/domains/YOUR-DOMAIN.com

# If public_html has default Hostinger files, that is OK for now.
# Clone the project next to public_html (NOT only inside it):
git clone https://github.com/sabawoon2025/olfat-backend.git olfat

cd olfat
```

If the GitHub repo is **private**, use a GitHub Personal Access Token when asked for password, or set up a deploy key.

### 8B. Alternative: Hostinger Git UI

1. Website → **Advanced** → **Git**.
2. Connect GitHub → authorize `sabawoon2025/olfat-backend`.
3. Branch: `main`.
4. Deploy directory: choose a folder such as `olfat` under the domain (avoid dumping Laravel root files as the only public site root without Step 9).
5. Deploy once, then continue with Composer over SSH in that folder.

---

## Step 9 — Point the website to Laravel `public/`

Laravel must serve from the **`public`** folder only.

### Option A — Change website root (best, if available)

1. Website settings → **Root directory** / **Document root**.
2. Point it to:

```text
domains/YOUR-DOMAIN.com/olfat/public
```

(Exact path depends on where you cloned; use File Manager to confirm.)

3. Save and wait a minute.

### Option B — Keep `public_html` and redirect with `.htaccess`

If you cannot change the root:

1. Open File Manager → `public_html`.
2. Delete default Hostinger `index.html` / placeholder files (keep folder).
3. Create/edit `public_html/.htaccess` with:

```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteRule ^(.*)$ ../olfat/public/$1 [L]
</IfModule>
```

Only use this if your clone path is `domains/YOUR-DOMAIN.com/olfat` and `public_html` is the sibling folder. Adjust the relative path if your layout differs.

### Confirm structure looks like this

```text
domains/YOUR-DOMAIN.com/
  olfat/                 ← Laravel project root (from GitHub)
    app/
    bootstrap/
    config/
    database/
    public/              ← web root must point here
      index.php
      pages/
      assets/
    storage/
    artisan
    composer.json
    .env                 ← you create this next (never commit)
  public_html/           ← Hostinger default (redirect or unused)
```

---

## Step 10 — Install PHP dependencies (Composer)

Still in SSH, inside the project folder:

```bash
cd ~/domains/YOUR-DOMAIN.com/olfat

# If composer is available:
composer install --no-dev --optimize-autoloader
```

If `composer` is missing:

```bash
php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');"
php composer-setup.php
php -r "unlink('composer-setup.php');"
php composer.phar install --no-dev --optimize-autoloader
```

---

## Step 11 — Create production `.env`

```bash
cd ~/domains/YOUR-DOMAIN.com/olfat
cp .env.production.example .env
nano .env
```

(Or edit `.env` in File Manager.)

Set at least:

```env
APP_NAME="Olfat Backend"
APP_ENV=production
APP_DEBUG=false
APP_URL=https://YOUR-DOMAIN.com

DB_CONNECTION=mysql
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=PASTE_HOSTINGER_DB_NAME
DB_USERNAME=PASTE_HOSTINGER_DB_USER
DB_PASSWORD=PASTE_HOSTINGER_DB_PASSWORD

SESSION_DRIVER=database
SESSION_ENCRYPT=true
SESSION_DOMAIN=YOUR-DOMAIN.com
SESSION_SECURE_COOKIE=true

CACHE_STORE=database
QUEUE_CONNECTION=database

LOG_LEVEL=error

SANCTUM_TOKEN_EXPIRATION=720

# Three equal Admin accounts (same full access from three locations)
# Use a DIFFERENT strong password (12+ chars) for each person.
SEED_ADMIN_1_NAME="Olfat Kabul"
SEED_ADMIN_1_EMAIL=olfatkabul@gmail.com
SEED_ADMIN_1_PASSWORD=ReplaceWithStrongPass12

SEED_ADMIN_2_NAME="Olfat Maidan"
SEED_ADMIN_2_EMAIL=olfatmaidan@gmail.com
SEED_ADMIN_2_PASSWORD=ReplaceWithStrongPass12

SEED_ADMIN_3_NAME="Olfat Ghazni"
SEED_ADMIN_3_EMAIL=olfatghazni@gmail.com
SEED_ADMIN_3_PASSWORD=ReplaceWithStrongPass12

ALLOW_DESTRUCTIVE_SETUP=false
```

Generate app key and finish setup:

```bash
php artisan key:generate
php artisan storage:link
php artisan migrate --force
# Clear config first so SEED_ADMIN_* from .env are visible to the seeder
php artisan config:clear
php artisan db:seed --force
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

Make storage writable:

```bash
chmod -R ug+rwx storage bootstrap/cache
```

`db:seed` creates **all three** admins with role `admin` and `is_active=true`.

---

## Step 12 — Verify the three location admins

1. Open `https://YOUR-DOMAIN.com/pages/login.html`
2. Log in as `olfatkabul@gmail.com` and select **Kabul** (first login claims that province)
3. Log out, then log in as `olfatmaidan@gmail.com` and select **Maidan**
4. Log out, then log in as `olfatghazni@gmail.com` and select **Ghazni**
5. Confirm a second user **cannot** log in to a province already claimed by someone else
6. Create a sale in Kabul; Maidan/Ghazni operators work in their own province stock/docs

All three are **Admin** for their own province. One shared MySQL database; data is tied to `location_id`. Separate login tokens per email.

Share each password only with that location’s operator. Do not reuse one password for all three if you can avoid it.

---

## Step 13 — Cron (backups + maintenance)

1. hPanel → **Advanced** → **Cron Jobs**.
2. Add:

| Field | Value |
|-------|--------|
| Schedule | Every minute (`* * * * *`) |
| Command | `cd /home/YOUR_SSH_USER/domains/YOUR-DOMAIN.com/olfat && php artisan schedule:run >> /dev/null 2>&1` |

Use the real absolute path from `pwd` inside the project.

This runs daily DB backup, weekly integrity check, and token pruning.

---

## Step 14 — Final tests (must pass)

Open these in the browser:

1. `https://YOUR-DOMAIN.com/pages/login.html`
2. Log in as User 1 → Dashboard loads with live data
3. Log in as User 2 → same system data visible
4. Log in as User 3 → same system data visible
5. Create a small sale or purchase as User 1
6. Refresh as User 2 → data appears correctly
7. Open `https://YOUR-DOMAIN.com/api/health` → should return healthy (200)

Also confirm:

- HTTP redirects to HTTPS
- `APP_DEBUG=false`
- Demo emails are **not** in the users list

---

## How the 3-user system works on the server

- One MySQL database; each sale/purchase/stock row belongs to a **province** (`location_id`).
- Each email claims **one** location on first login (Kabul / Maidan / Ghazni). Another user cannot claim that same location.
- Writes (sales, stock, payments, etc.) are forced to the logged-in user’s province.
- Each login gets its own Sanctum token. The staff UI uses relative API URL `/api/v1`.

---

## Updating the site later (after code changes)

On your PC push to GitHub, then on the server:

```bash
cd ~/domains/YOUR-DOMAIN.com/olfat
git pull origin main
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

---

## Common problems

| Problem | Fix |
|---------|-----|
| 500 error / blank page | Check `storage/logs/laravel.log`; ensure `.env` DB values and `APP_KEY` exist |
| 404 on all pages | Document root not pointing to `public/` (redo Step 9) |
| CSS/JS missing | Root must be `public/`; do not serve project root |
| DB connection refused | Use Hostinger’s shown DB host/name/user exactly |
| Login works locally but not live | Wrong `APP_URL` / HTTPS / cached config → `php artisan config:clear` then `config:cache` |
| Permission denied writing files | `chmod -R ug+rwx storage bootstrap/cache` |
| Composer memory error | `php -d memory_limit=512M composer.phar install --no-dev --optimize-autoloader` |

---

## Security reminders

- Never commit `.env`
- Never leave `APP_DEBUG=true` online
- Never seed demo users on production
- Use strong unique passwords for all 3 emails
- Keep Free SSL + Force HTTPS on

---

## What to do right after payment (order)

1. Claim domain  
2. Empty website + SSL + PHP 8.3+  
3. Create MySQL DB  
4. Enable SSH  
5. `git clone` repo  
6. Point root to `olfat/public`  
7. `composer install` + `.env` (all 3 `SEED_ADMIN_*` emails) + migrate/seed  
8. Test all 3 admin logins + shared data  
9. Add cron  

When payment is done and you have the domain name, tell me the domain and we can go through each step with your exact hPanel paths.
