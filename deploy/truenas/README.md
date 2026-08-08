# SkyStore on TrueNAS SCALE

The GitHub release contains `skystore-truenas.yaml` with the exact released container digest already filled in. Use that file instead of the repository template whenever possible.

## Prepare the host paths

Create these datasets or directories:

- `/mnt/Atlantis/Vault/Skystore/postgres`
- `/mnt/Atlantis/Vault/Skystore/uploads`
- `/mnt/Atlantis/Vault/Skystore/backups`

Grant the PostgreSQL path to container UID/GID `70:70`. Grant the uploads and backups paths to UID/GID `1001:1001`. Keep all three private from SMB guests and other applications.

## Install

1. Download `skystore-truenas.yaml` from the intended GitHub release.
2. If the GHCR package is private, add a TrueNAS container-registry credential for `ghcr.io` using your GitHub username and a read-only token with `read:packages`.
3. In TrueNAS SCALE, choose **Apps → Discover Apps → Install via YAML** and paste the release YAML.
4. Replace the three `REPLACE_WITH_...` values at the top of the YAML:
   - the same alphanumeric database password in `DATABASE_URL` and `POSTGRES_PASSWORD`;
   - a separate random `AUTH_SECRET` of at least 32 characters;
   - the Discord client secret.
5. Install the app and wait for `migrate` and `catalog-bootstrap` to complete. They are safe to run again during an update.
6. Point the existing Nginx setup at the TrueNAS LAN address on port `13000`. The included `nginx.conf.example` contains the required forwarded headers.

The Discord Developer Portal redirect must be exactly:

```text
https://skystore.kazvoeten.com/api/auth/callback/discord
```

The public application URL is `https://skystore.kazvoeten.com`. Do not expose PostgreSQL or the data directories.

Keep the GHCR package private unless you have independently confirmed redistribution rights for every bundled item image. A private package is still straightforward for TrueNAS to pull through its registry credential and does not affect public access to the running website.

## Upgrade

Take a database backup, download the new release YAML, copy your existing secret values into it, and replace the custom app YAML. The released file pins the image by digest; it never follows `latest` accidentally.

## Back up

Back up `/mnt/Atlantis/Vault/Skystore/uploads` with the database. A filesystem copy of the live PostgreSQL directory is not a database backup. Schedule a PostgreSQL custom-format dump into `/mnt/Atlantis/Vault/Skystore/backups`, encrypt it, and copy it off the TrueNAS host.
