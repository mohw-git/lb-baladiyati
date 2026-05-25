# Baladi — Windows Server deployment guide

This document covers **local development**, **Windows Server production** (Caddy + Node), and an **optional Docker Compose** path. It does not deploy for you — run these steps on the server when ready.

## Architecture (production)

| URL | Service | Process port (localhost) |
|-----|---------|--------------------------|
| https://lb-baladiyati.com | Next.js web dashboard | `3001` |
| https://api.lb-baladiyati.com | NestJS API | `3000` |
| www → apex | Caddy redirect | — |

Caddy terminates TLS and reverse-proxies to `127.0.0.1`. See `Caddyfile.example`.

---

## Local development (Windows)

Keep using separate terminals — nothing in production config is required locally.

```powershell
# 1) Backend (repo root)
copy .env.example .env          # first time only
npm install
npm run prisma:generate
npm run prisma:migrate          # or prisma:migrate after schema changes
npm run start:dev               # http://localhost:3000

# 2) Web dashboard
cd web-dashboard
copy .env.example .env.local
npm install
npm run dev                     # http://localhost:3001

# 3) Mobile (Expo Go)
cd mobile-app
$env:EXPO_PUBLIC_API_URL = "http://YOUR_LAN_IP:3000"
npx expo start --clear
```

**Uploads (dev):** default `UPLOAD_PATH=./uploads` under repo root. KYC files are **not** publicly served under `/uploads/kyc`.

**Seed (dev only):** `npm run prisma:seed` — **never** on production.

---

## Windows Server layout (recommended)

```
C:\baladiyati\
  app\              ← git clone of this repository
  data\uploads\     ← UPLOAD_PATH (persistent)
  secrets\
    firebase-adminsdk.json
  logs\             ← optional PM2 / service logs
```

### Environment files (never commit)

| File | Purpose |
|------|---------|
| `C:\baladiyati\app\.env` | Backend production — copy from `.env.production.example` |
| `C:\baladiyati\app\web-dashboard\.env.production` | Web build — copy from `web-dashboard/.env.production.example` |

Set at minimum:

- `JWT_SECRET` — random ≥32 chars  
- `DATABASE_URL` — PostgreSQL connection string  
- `UPLOAD_PATH=C:\baladiyati\data\uploads`  
- `APP_PUBLIC_URL`, `FRONTEND_URL`, `API_PUBLIC_URL`, `CORS_ORIGINS` — HTTPS production domains  
- `FIREBASE_SERVICE_ACCOUNT_PATH=C:\baladiyati\secrets\firebase-adminsdk.json`  
- `RESEND_API_KEY` (or SMTP)  
- `NEXT_PUBLIC_API_URL=https://api.lb-baladiyati.com` (web build)

The backend **refuses to start** in `NODE_ENV=production` if placeholders or localhost URLs remain (`production-validator.ts`).

---

## Caddy (Windows)

1. Copy `Caddyfile.example` into your Caddy config path.  
2. Point Namecheap DNS `A` records for `@`, `www`, `api` to the server.  
3. Ensure API and web listen on `127.0.0.1:3000` and `:3001` only (not public ports).  
4. Reload Caddy after edits.

Uploads are served by the API at `https://api.lb-baladiyati.com/uploads/...` (not by Caddy static files).

---

## Production commands (Node + PM2 / Windows services)

### One-time setup

```powershell
cd C:\baladiyati\app
.\deploy\first-clone.ps1 -RepoUrl <your-repo-url>
# Edit .env and C:\baladiyati\secrets\ manually — scripts do not fill secrets

.\deploy\deploy.ps1
npm install -g pm2-windows-startup
pm2-startup install
.\deploy\start.ps1 -IncludePublicSmoke
```

### Build

```powershell
cd C:\baladiyati\app
npm run prisma:generate
npm run build                    # backend → dist/

cd web-dashboard
npm run build                    # requires .env.production
```

### Database migrations (production)

```powershell
cd C:\baladiyati\app
npm run prisma:migrate:deploy
```

**Do not run:** `prisma migrate dev`, `prisma db push`, `npm run prisma:seed`, `npm run db:reset`.

### Start / restart (PM2 — see `deploy/WINDOWS_STARTUP.md`)

**Use `ecosystem.config.cjs`, not `pm2.ecosystem.cjs`.** PM2 7 on Windows only loads ecosystem files whose names contain `.config.js` / `.config.cjs`.

```powershell
copy deploy\pm2.ecosystem.example.cjs C:\baladiyati\ecosystem.config.cjs
cd C:\baladiyati\app\web-dashboard
npm run build
pm2 start C:\baladiyati\ecosystem.config.cjs
pm2 save
npm install -g pm2-windows-startup
pm2-startup install
```

Or install **NSSM** Windows services `BaladiApi` / `BaladiWeb` pointing to:

- API: `node C:\baladiyati\app\dist\src\main.js`  
- Web: `node C:\baladiyati\app\web-dashboard\node_modules\next\dist\bin\next start -p 3001`

### Daily operations (PowerShell scripts)

See **`deploy/WINDOWS_STARTUP.md`** for full detail.

| Task | Command |
|------|---------|
| Status | `.\deploy\status.ps1` (`-Logs`) |
| Start | `.\deploy\start.ps1` |
| Stop | `.\deploy\stop.ps1` |
| Restart | `.\deploy\restart.ps1` |
| Deploy update | `.\deploy\backup.ps1 -Uploads` then `.\deploy\deploy.ps1` |
| Smoke only | `.\deploy\smoke.ps1 -IncludePublic` |

**First clone (once only):** `.\deploy\first-clone.ps1 -RepoUrl <url>` — never used for normal updates.

**Normal deploy policy:** uses existing `C:\baladiyati\app`, runs `git pull --ff-only`, does **not** reclone or overwrite `.env`/uploads/DB. Stops on dirty tree or pull conflicts.

```powershell
cd C:\baladiyati\app
.\deploy\deploy.ps1
.\deploy\deploy.ps1 -Branch fix/complaint-workflow-governance
```

Options: `-SkipGitPull`, `-SkipMigrate`, `-SkipInstall`, `-NoRestart`.

**Never on production:** seed, `prisma migrate dev`, `prisma db push`, `next dev`, `start:dev`.

Always **`npm run build`** in `web-dashboard` before restart (deploy does this automatically).

### Smoke tests

```powershell
.\deploy\smoke.ps1
.\deploy\smoke.ps1 -IncludePublic
```

### Logs

- `.\deploy\status.ps1 -Logs`
- PM2: `pm2 logs baladi-api` / `pm2 logs baladi-web`  
- Windows Service: Event Viewer / NSSM log redirection  
- Backend structured JSON logs via pino to stdout

---

## Docker on Windows Server (optional)

**Recommendation:** For a single Windows Server FYP deployment, **native Node + PM2/NSSM + Caddy** is simpler and matches your `.env` Windows paths. Use Docker if you already run Docker Desktop for Windows and want Postgres in a container.

```powershell
cd C:\baladiyati\app
# Add POSTGRES_PASSWORD=... to .env for compose
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml run --rm api npx prisma migrate deploy
docker compose -f docker-compose.prod.yml up -d
```

Inside containers, `UPLOAD_PATH=/data/uploads` with volume `C:\baladiyati\data\uploads` mounted. Firebase JSON mount: `C:\baladiyati\secrets` → `/run/secrets`.

Caddy still runs on the host and proxies to published `127.0.0.1:3000` / `:3001`.

---

## Mobile app (production API URL)

- **Expo Go (dev):** set `EXPO_PUBLIC_API_URL` to your LAN IP.  
- **EAS production build:** `eas.json` sets `EXPO_PUBLIC_API_URL=https://api.lb-baladiyati.com`.  
- `app.config.ts` **throws** if a production profile build would use localhost.

```powershell
cd mobile-app
eas build --profile production --platform android
```

---

## GitHub / CI

**Now:** manual `git pull` + `deploy\deploy.ps1` on the server.  
**Later:** GitHub Actions with SSH to Windows (WinRM/OpenSSH) — keep secrets in server `.env`, not in the repo.

---

## Backups & rollback

```powershell
.\deploy\backup.ps1 -Uploads
```

| Asset | Backup |
|-------|--------|
| PostgreSQL | `pg_dump` via `backup.ps1` (if on PATH) |
| `C:\baladiyati\data\uploads` | `backup.ps1 -Uploads` |
| `.env` / secrets | redacted copy in backup folder + secure vault |

**Rollback:** `git checkout <tag>` → `.\deploy\deploy.ps1 -SkipGitPull` (add `-SkipMigrate` if DB unchanged) → `.\deploy\smoke.ps1 -IncludePublic`. Restore DB from `C:\baladiyati\backup\<timestamp>\` if a migration broke data.

---

## Security checklist

- [ ] Real `.env` never committed (`**/.env.production` gitignored)  
- [ ] Firebase Admin JSON only under `C:\baladiyati\secrets`  
- [ ] `ENABLE_SWAGGER=false` in production  
- [ ] Seed **not** run on production  
- [ ] Resend/domain verified for `MAIL_FROM`  
- [ ] Caddy HTTPS working for all three hostnames  

---

## Upload path (single source of truth)

All backend disk I/O uses `UPLOAD_PATH` resolved by `src/core/storage/upload-path.util.ts`:

- `StorageService` — general uploads  
- `KycService` — KYC documents (still blocked at HTTP `/uploads/kyc`)  
- `ServeStaticModule` — public files under `/uploads`  

Local default: `./uploads`. Production: `C:\baladiyati\data\uploads`.
