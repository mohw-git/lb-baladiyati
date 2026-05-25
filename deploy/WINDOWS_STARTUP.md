# Baladi — Windows Server production startup & daily operations

Canonical guide for **PM2**, **Caddy**, and **production PowerShell scripts** under `deploy\`.

## Architecture

| Public URL | Upstream |
|------------|----------|
| https://api.lb-baladiyati.com | 127.0.0.1:3000 (NestJS) |
| https://lb-baladiyati.com | 127.0.0.1:3001 (Next.js production) |

Caddy: `C:\caddy\Caddyfile` — not managed by app scripts (left running).

## Production scripts

| Script | Purpose |
|--------|---------|
| `deploy\first-clone.ps1` | **Once only** — clone repo if missing, create folders, copy env **examples** |
| `deploy\start.ps1` | Start PM2 apps + local smoke |
| `deploy\stop.ps1` | Stop PM2 apps (not Caddy/Postgres) |
| `deploy\restart.ps1` | Restart PM2 + smoke |
| `deploy\status.ps1` | PM2, ports, Caddy (`-Logs` for tail) |
| `deploy\deploy.ps1` | **Normal update** — `git pull`, build, migrate, restart, smoke |
| `deploy\backup.ps1` | Pre-deploy backup (optional `-Uploads`, `pg_dump`) |
| `deploy\smoke.ps1` | Health checks (local and/or public) |

All scripts use `$ErrorActionPreference = 'Stop'`, avoid printing secrets, and exit non-zero on failure.

## Daily operations

### Status

```powershell
cd C:\baladiyati\app
.\deploy\status.ps1
.\deploy\status.ps1 -Logs
```

### Start / stop / restart

```powershell
.\deploy\start.ps1
.\deploy\start.ps1 -IncludePublicSmoke

.\deploy\stop.ps1
.\deploy\stop.ps1 -Delete    # remove from PM2 process list

.\deploy\restart.ps1
.\deploy\restart.ps1 -IncludePublicSmoke
```

### Deploy new code (normal — **git pull**, never reclone)

```powershell
cd C:\baladiyati\app
.\deploy\backup.ps1 -Uploads
.\deploy\deploy.ps1
```

With branch:

```powershell
.\deploy\deploy.ps1 -Branch fix/complaint-workflow-governance
```

Options:

| Flag | Use when |
|------|----------|
| `-SkipGitPull` | Tree already synced |
| `-SkipMigrate` | Rollback redeploy, DB unchanged |
| `-SkipInstall` | Skip `npm ci` |
| `-NoRestart` | Build only |

**Policy:** deploy uses the existing repo at `C:\baladiyati\app`. It does **not** delete, reclone, or overwrite `.env`, uploads, secrets, or the database. If `git pull --ff-only` fails or the working tree is dirty, deploy **stops** with an error.

### Rollback basics

1. `git fetch origin`
2. `git checkout <previous-tag-or-commit>`
3. `.\deploy\deploy.ps1 -SkipGitPull` (or `-SkipMigrate` if DB unchanged)
4. If a bad migration ran, restore DB from `C:\baladiyati\backup\<timestamp>\` before redeploying.

### Backup before deploy

```powershell
.\deploy\backup.ps1 -Uploads
```

Creates `C:\baladiyati\backup\yyyyMMdd-HHmmss\` with redacted env copies, git info, optional uploads copy, optional `pg_dump`.

### Smoke test only

```powershell
.\deploy\smoke.ps1
.\deploy\smoke.ps1 -IncludePublic
```

## First-time setup (once)

```powershell
.\deploy\first-clone.ps1 -RepoUrl https://github.com/YOUR_ORG/YOUR_REPO.git
# Edit .env and secrets manually
.\deploy\deploy.ps1
npm install -g pm2-windows-startup
pm2-startup install
.\deploy\start.ps1 -IncludePublicSmoke
```

## PM2 config file naming

**File:** `C:\baladiyati\ecosystem.config.cjs` (must contain `.config.cjs` in the name)

Do **not** use `pm2.ecosystem.cjs` — PM2 7 runs it as a plain script.

```powershell
copy C:\baladiyati\app\deploy\pm2.ecosystem.example.cjs C:\baladiyati\ecosystem.config.cjs
pm2 start C:\baladiyati\ecosystem.config.cjs
pm2 save
```

Production processes:

- **baladi-api** — `node dist\src\main.js` (not `nest start:dev`)
- **baladi-web** — `next start -p 3001` (not `next dev`)

Always **`npm run build`** in `web-dashboard` before restart if web code changed.

## Reboot persistence

```powershell
npm install -g pm2-windows-startup
pm2-startup install
pm2 save
```

Built-in `pm2 startup` fails on Windows (`Init system not found`).

After reboot: `.\deploy\status.ps1` and `.\deploy\smoke.ps1 -IncludePublic`

## Never on production

- `npm run prisma:seed` / `prisma seed`
- `prisma migrate dev`
- `prisma db push`
- `npm run db:reset`
- `next dev` / `npm run start:dev`
- Reclone over `C:\baladiyati\app` during normal deploy

## PostgreSQL

Runs on the **Windows host**. `DATABASE_URL` in `.env` — never printed by scripts.

## Logs

```powershell
pm2 logs baladi-api --lines 100
pm2 logs baladi-web --lines 100
.\deploy\status.ps1 -Logs
```

## NSSM / Docker

- **NSSM:** alternative if PM2 is unreliable — see `DEPLOYMENT.md`
- **Docker:** not installed on this server; native Node + PM2 recommended for FYP production
