# SkyStore operations

## Deployment boundary

Only the `web` service is published, bound to loopback by default. Terminate TLS at a reverse proxy and forward HTTPS traffic to `127.0.0.1:${SKYSTORE_WEB_PORT:-3000}`. Configure Discord with the exact public callback URL:

`https://<host>/api/auth/callback/discord`

Do not expose PostgreSQL, worker, uploaded references, catalog images, or backup files. Run the offline extractor outside the application stack. Only its normalized catalog bundle and web-safe images may be provided to the explicit catalog importer; never copy or mount Skyrim assets into Docker.

## First deployment

Create a private `.env` from `.env.example` and add:

```dotenv
POSTGRES_DB=skystore
POSTGRES_USER=skystore
POSTGRES_PASSWORD=<unique-long-password>
DATABASE_URL=postgres://skystore:<same-password>@postgres:5432/skystore
AUTH_SECRET=<at-least-32-random-characters>
AUTH_DISCORD_ID=<Discord OAuth client id>
AUTH_DISCORD_SECRET=<Discord OAuth client secret>
SKYSTORE_ADMIN_DISCORD_ID=<immutable Discord user id>
```

Build the image, run the explicit catalog import from the normalized extractor output, then start the application:

```bash
docker compose build
docker compose --profile setup run --rm catalog-import
docker compose up -d
```

The `migrate` service must finish successfully before import, web, or worker access PostgreSQL. `catalog-import` is a setup-profile operation and is not a web/worker startup dependency. On the administrator's first Discord login, SkyStore creates the real Whiterun membership and installs the idempotent August 5, 2026 official reference rules. It never creates a placeholder user, account, receipt, stock movement, or market observation. Check the stack with `docker compose ps` and `docker compose logs migrate`, then check the app with `curl -fsS http://127.0.0.1:3000/api/health/ready`.

Upgrade by taking a verified backup, pulling the intended source revision, and running `docker compose up --build -d`. Import a newly extracted catalog only as a deliberate, separately reviewed operation. Never run `docker compose down -v` in production: it removes the named data volumes.

## Data volumes

| Volume | Contents | Handling |
| --- | --- | --- |
| `postgres_data` | Authoritative PostgreSQL data | Back up daily with the supplied script. |
| `uploads` | Uploaded provenance/reference material | Retain with database backup policy. |
| `catalog_images` | Offline-rendered WebP/catalog fallback artwork | Populate only from normalized catalog output. |
| `backups` | Optional local staging for operations tooling | Do not treat as the only backup copy. |

## Encrypted off-host backups

On the Docker host install [`age`](https://age-encryption.org/) and [`rclone`](https://rclone.org/). Configure an age recipient in `BACKUP_AGE_RECIPIENT` and an rclone remote path in `OFFSITE_BACKUP_TARGET`, for example:

```bash
export BACKUP_AGE_RECIPIENT='age1...'
export OFFSITE_BACKUP_TARGET='b2:skystore-production-backups'
./scripts/backup.sh
```

Schedule that command daily with the deployment account's scheduler. The script creates a PostgreSQL custom-format dump, encrypts it before upload, verifies the remote object is present, and retains no plaintext dump. Protect the age identity separately from the backup bucket; test restoration quarterly.

## Restore drill

Stop web and worker, download an encrypted backup, and restore only into a deliberately selected stack:

```bash
docker compose stop web worker
export BACKUP_AGE_IDENTITY_FILE=/secure/path/skystore-backup.agekey
./scripts/restore.sh /secure/path/skystore-20260805T000000Z.dump.age
docker compose up -d web worker
```

The restore script requires explicit confirmation and refuses to run while web or worker is running. It replaces database contents, so restore rehearsals should use an isolated Compose project and fresh volumes. Verify `/api/health/ready`, sign-in, delayed-guide cutoff, and a sample historical receipt after each drill.
