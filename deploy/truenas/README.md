# SkyStore on TrueNAS SCALE

Each GitHub release contains two prepared configurations:

- `skystore-truenas-auto.yaml` uses the permanent `stable` image channel. Install it once, keep the same YAML and secrets, and use TrueNAS's normal **Update** action whenever it detects a new SkyStore image.
- `skystore-truenas.yaml` pins one exact image digest for manual, immutable deployments.

The automatic configuration is recommended for the live SkyStore server. Stable releases move the `stable` tag only after the release workflow has validated the application, hydrated the catalog assets, published the image, and successfully pulled and inspected that image.

## Storage

SkyStore needs only this single existing host path:

```text
/mnt/Atlantis/Vault/Skystore
```

The one-shot `storage-init` service runs before PostgreSQL. It takes ownership of this SkyStore directory, creates `postgres`, `uploads`, and `backups`, and assigns their required container ownership and permissions automatically. You do not need to create additional datasets, subdirectories, ACL entries, or UID mappings. The service does not access anything above or beside the SkyStore directory.

## Install

1. Download `skystore-truenas-auto.yaml` from the latest GitHub release. Use `skystore-truenas.yaml` only when deliberately pinning a specific version.
2. If the GHCR package is private, add a TrueNAS container-registry credential for `ghcr.io` using your GitHub username and a read-only token with `read:packages`.
3. In TrueNAS SCALE, choose **Apps → Discover Apps → Install via YAML** and paste the release YAML.
4. Replace the three `REPLACE_WITH_...` values at the top of the YAML:
   - the same alphanumeric database password in `DATABASE_URL` and `POSTGRES_PASSWORD`;
   - a separate random `AUTH_SECRET` of at least 32 characters;
   - the Discord client secret.
5. Install the app and wait for `storage-init`, `migrate`, and `catalog-bootstrap` to complete. They are safe to run again during an update.
6. Point the existing Nginx setup at the TrueNAS LAN address on port `13000`. The included `nginx.conf.example` contains the required forwarded headers.

The Discord Developer Portal redirect must be exactly:

```text
https://skystore.kazvoeten.com/api/auth/callback/discord
```

The public application URL is `https://skystore.kazvoeten.com`. Do not expose PostgreSQL or the data directories.

Keep the GHCR package private unless you have independently confirmed redistribution rights for every bundled item image. A private package is still straightforward for TrueNAS to pull through its registry credential and does not affect public access to the running website.

## Upgrade

With `skystore-truenas-auto.yaml`, enable **Check for docker image updates** in TrueNAS Apps settings (it is enabled by default). When SkyStore publishes a stable release, TrueNAS detects the changed `stable` image and offers its normal **Update** action. The unchanged YAML retains all existing passwords and secrets, while `pull_policy: always` makes the recreated services pull the newly validated image.

The update reruns the one-shot migration and catalog-bootstrap services before starting the new web and worker services. Take a database backup before applying an update. Do not use an unrestricted Docker-socket updater: replacing only the long-running containers would skip those required one-shot services.

Digest-pinned `skystore-truenas.yaml` installations remain manual by design and require replacing the image references for each release.

## Back up

Back up `/mnt/Atlantis/Vault/Skystore/uploads` with the database. A filesystem copy of the live PostgreSQL directory is not a database backup. Schedule a PostgreSQL custom-format dump into `/mnt/Atlantis/Vault/Skystore/backups`, encrypt it, and copy it off the TrueNAS host.
