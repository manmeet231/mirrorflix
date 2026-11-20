# MirrorFlix deployment guide

## Current production layout

- VPS: Ubuntu 24.04.5; SSH port `2105`; login user `root`.
- Project checkout: `/root/mirrorflix-source`.
- Frontend deployment: `/var/www/alterbucket/frontend`; Nginx serves its `dist` directory.
- Nginx hosts `alterbucket.in` and `www.alterbucket.in`, with TLS certificates present, and serves `/var/www/alterbucket/frontend/dist`.
- Nginx contains a proxy to `127.0.0.1:8000`, but public `/api/movies/featured` and `/api/genres` currently return 404. The existing FastAPI routes answer directly on `http://103.235.105.231:8001`; that listener has no successful CORS preflight and is not a safe HTTPS frontend target.
- PostgreSQL 16 database: `mirrorflix_db`; app role: `mirrorflix_user`; PostgreSQL listens on `127.0.0.1:5432`.
- Port 8001 is currently allowed by UFW from anywhere and has a Uvicorn listener. Route the API through the existing HTTPS Nginx site after reviewing the full server block; do not point the browser at the HTTP IP:port. Do not expose port 5432; it is currently local-only. The process/service ownership of ports 8000 and 8001 still needs confirmation.
- The systemd service name for the API has not been identified. Do not restart a guessed service.

## SSH access

From Windows PowerShell:

```powershell
ssh -p 2105 root@103.235.105.231
```

Enter the password only at the SSH prompt. Do not put it in a command, file, environment variable, or this document.

## Local development

1. Create and activate a Python virtual environment.
2. Install `requirements.txt`; install `requirements-dev.txt` for tests.
3. Copy `.env.example` to an ignored `.env` and set `DATABASE_URL` locally. Never commit `.env`.
4. For a local connection to the VPS database, use an SSH tunnel rather than opening PostgreSQL publicly:

```powershell
ssh -N -L 5433:127.0.0.1:5432 -p 2105 root@103.235.105.231
```

Then set the local `DATABASE_URL` to use `127.0.0.1:5433` in the ignored `.env`. Do not put the real database password in chat or source files.

Start the backend from the project root:

```powershell
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Start the frontend in another terminal with `npm run dev`. In development, the default API origin is `http://127.0.0.1:8000`; configure `VITE_API_BASE_URL` only when using another API origin.

## Database inspection

On the VPS, connect through the local PostgreSQL socket:

```bash
sudo -u postgres psql -d mirrorflix_db
```

Useful read-only commands include `\dt`, `\d+ movies`, and `\d+ featured_movies`. Do not run schema migrations or data changes without explicit approval.

## Existing deployment workflow

`.github/workflows/deploy.yml` deploys the frontend when `main` is updated. It uses GitHub Actions SSH secrets, pins the VPS host key, pulls `main` in `/var/www/alterbucket/frontend`, runs `npm ci`, and builds the site. The workflow does not deploy the backend. Do not push directly to `main` or change the production workflow without approval.

## Safe deployment preparation

Before a production deployment is approved:

1. Identify the exact API service/process on ports 8000 and 8001.
2. Confirm the complete Nginx location blocks and service ownership; the public API paths currently return 404.
3. Choose a secure location for `DATABASE_URL` and `API_ADMIN_TOKEN`; neither belongs in Git or frontend code.
4. Back up the current frontend files, backend source, Nginx config, and identified service unit.
5. Prepare a rollback using those exact backups and verified service names.
6. Run backend tests, frontend tests/build, and API checks in a staging or local environment.

No production files, firewall rules, services, Nginx configuration, or database records were changed for this work. Production deployment is pending explicit approval of a concrete plan.

## Rollback and troubleshooting

- The deployment workflow only performs frontend build/deploy. A frontend rollback must restore the backed-up `dist` or redeploy a previously verified commit.
- Backend rollback must restore the identified backend backup and restart only the verified service unit. That unit is not yet identified.
- Check `nginx -t` before any approved Nginx reload.
- Check `systemctl status <verified-service-name>` and service logs only after identifying the correct service.
- Use `/api/health` to verify database connectivity after an approved backend deployment.
- If SSH fails, diagnose connectivity without changing SSH or firewall configuration.
