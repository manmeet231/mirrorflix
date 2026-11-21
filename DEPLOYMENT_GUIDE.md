# MirrorFlix deployment guide

## Current production layout

- VPS: Ubuntu 24.04.5; SSH port `2105`; login user `root`.
- Project checkout: `/root/mirrorflix-source`.
- The managed `alterbucket-api.service` is active and runs as `deploy:deploy` from `/home/deploy/alterbucket/backend`, using `/home/deploy/alterbucket/backend/.env`. Its `ExecStart` invokes that directory's `venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000`. The service file is `/etc/systemd/system/alterbucket-api.service`; only environment variable names were inspected, never values.
- The currently deployed `main.py` exposes `/`, `/api/health`, and `/api/database-check`; it does not expose the frontend's movie or anime routes. The existing environment uses separate database settings. The local recovered API now supports those settings as well as `DATABASE_URL`, and its imports support both the current service launch (`main:app` from the backend directory) and project-root development.
- Frontend deployment: `/var/www/alterbucket/frontend`; Nginx serves its `dist` directory.
- Nginx hosts `alterbucket.in` and `www.alterbucket.in`, with TLS certificates present, and serves `/var/www/alterbucket/frontend/dist`.
- The HTTPS Nginx server block has `location /api/` proxying to `http://127.0.0.1:8000`, with the usual forwarded host and client headers. Public `/api/movies/featured` and `/api/genres` currently return 404 through Nginx, so the service on port 8000 does not currently provide the recovered API paths.
- A separate PostgreSQL 16 server listens on `127.0.0.1:5432`; its inspected database was `mirrorflix_db`. The active service's `.env` instead points to `127.0.0.1:3306`, database `alterbucket_db`, a separate MySQL/MariaDB target. A read-only table listing confirmed `alterbucket_db` exists and currently has no tables; do not use the PostgreSQL schema findings as a substitute.
- Port 8000 is the `alterbucket-api.service` upstream (process cgroup `/system.slice/alterbucket-api.service`), whose working directory and launch command are now known. Port 8001 is a separate Uvicorn process in an interactive root login session (`/user.slice/user-0.slice/session-870.scope`); it is not the Nginx upstream and should not be treated as the managed production service.
- Port 8001 is currently allowed by UFW from anywhere. Do not point the browser at the HTTP IP:port. Do not expose database ports; they are currently bound to loopback. The service's `ExecStart`, working directory, and environment-file path have been confirmed.

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
4. For local access to the active VPS MySQL database, use an SSH tunnel rather than exposing port 3306 publicly:

```powershell
ssh -N -L 3307:127.0.0.1:3306 -p 2105 root@103.235.105.231
```

Then set the local `DATABASE_URL` to use `127.0.0.1:3307` in the ignored `.env`. Do not put the real database password in chat or source files.

Start the backend from the project root:

```powershell
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Start the frontend in another terminal with `npm run dev`. In development, the default API origin is `http://127.0.0.1:8000`; configure `VITE_API_BASE_URL` only when using another API origin.

## Database inspection

The active backend database is MySQL/MariaDB. On the VPS, an administrator can inspect its schema through the local MySQL socket:

```powershell
ssh -p 2105 root@103.235.105.231 "sudo mysql -D alterbucket_db"
```

Useful read-only commands include `SHOW TABLES;` and queries against `information_schema.columns`. The checked `alterbucket_db` currently has no tables. The separate PostgreSQL database `mirrorflix_db` is not the active backend database. Do not create schema or change data without explicit approval.

## Existing deployment workflow

`.github/workflows/deploy.yml` deploys the frontend when `main` is updated. It uses GitHub Actions SSH secrets, pins the VPS host key, pulls `main` in `/var/www/alterbucket/frontend`, runs `npm ci`, and builds the site. The workflow does not deploy the backend. Do not push directly to `main` or change the production workflow without approval.

## Safe deployment preparation

Before a production deployment is approved:

1. Service status and launch path are confirmed; its existing routes are only `/`, `/api/health`, and `/api/database-check`. Do not print `.env` values.
2. The service's unit definition, `ExecStart`, working directory, and environment file path are confirmed; port 8001 is only an interactive-session process.
3. The complete Nginx HTTPS server block is confirmed: `/api/` proxies to `127.0.0.1:8000`; public API paths currently return 404.
4. The active database is MySQL/MariaDB; the service venv has PyMySQL. The local backend now supports MySQL `DB_*` configuration and generic JSON columns. Confirm the active schema (currently empty) and validate the local backend for the service's launch mode before deployment.
6. The guarded local schema initializer requires the configured DB name to match an explicit confirmation and refuses to initialize any database that already has tables. Review its DDL and verify the empty target before use.
7. Keep the existing secure database settings; choose a secure location for `API_ADMIN_TOKEN` before enabling the protected content-writing route.
8. Back up the current frontend files, backend source, Nginx config, and identified service unit.
9. Prepare a rollback using those exact backups and verified service names.
10. Run backend tests, frontend tests/build, and API checks in a staging or local environment.

No production files, firewall rules, services, Nginx configuration, or database records were changed for this work. Production deployment is pending explicit approval of a concrete plan.

## Rollback and troubleshooting

- The deployment workflow only performs frontend build/deploy. A frontend rollback must restore the backed-up `dist` or redeploy a previously verified commit.
- Backend rollback must restore the identified backend backup and restart only the verified service unit (`alterbucket-api.service`), after its unit configuration and runtime paths have been inspected.
- Check `nginx -t` before any approved Nginx reload.
- Check `systemctl status <verified-service-name>` and service logs only after identifying the correct service.
- Use `/api/health` to verify database connectivity after an approved backend deployment.
- If SSH fails, diagnose connectivity without changing SSH or firewall configuration.
