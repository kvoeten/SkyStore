#!/usr/bin/env bash
# Restore an encrypted SkyStore backup. This intentionally replaces the selected database
# and reference/catalog-image volumes after an explicit confirmation.
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: BACKUP_AGE_IDENTITY_FILE=/secure/key.agekey $0 /path/to/skystore-<timestamp>.tar.gz.age" >&2
  exit 64
fi
archive="$1"
[[ -f "$archive" ]] || { echo "Backup file does not exist: $archive" >&2; exit 66; }
[[ -n "${BACKUP_AGE_IDENTITY_FILE:-}" && -f "${BACKUP_AGE_IDENTITY_FILE:-}" ]] || { echo "Set BACKUP_AGE_IDENTITY_FILE to a readable age identity file." >&2; exit 64; }
for command in docker age tar; do command -v "$command" >/dev/null || { echo "Required command not found: $command" >&2; exit 69; }; done

running="$(docker compose ps --status running --services 2>/dev/null || true)"
if grep -Eq '^(web|worker)$' <<<"$running"; then
  echo "Refusing restore while web or worker is running. Run: docker compose stop web worker" >&2
  exit 73
fi

project="${COMPOSE_PROJECT_NAME:-skystore}"
database="${POSTGRES_DB:-skystore}"
database_user="${POSTGRES_USER:-skystore}"
printf "This replaces database '%s' and volumes '%s_uploads' and '%s_catalog_images'. Type RESTORE to continue: " "$database" "$project" "$project"
read -r confirmation
[[ "$confirmation" == "RESTORE" ]] || { echo "Restore cancelled."; exit 0; }

temp_dir="$(mktemp -d "${TMPDIR:-/tmp}/skystore-restore.XXXXXX")"
cleanup() { rm -rf -- "$temp_dir"; }
trap cleanup EXIT
age -d -i "$BACKUP_AGE_IDENTITY_FILE" -o "$temp_dir/bundle.tar.gz" "$archive"
tar -C "$temp_dir" -xzf "$temp_dir/bundle.tar.gz"
[[ -s "$temp_dir/database.dump" && -f "$temp_dir/uploads.tar" && -f "$temp_dir/catalog_images.tar" ]] || { echo "Backup is incomplete or not a SkyStore bundle." >&2; exit 65; }

echo "Restoring database..."
docker compose exec -T postgres pg_restore --clean --if-exists --no-owner --no-privileges -U "$database_user" -d "$database" < "$temp_dir/database.dump"

for volume in uploads catalog_images; do
  docker_volume="${project}_${volume}"
  echo "Replacing volume '$docker_volume'..."
  docker run --rm -v "${docker_volume}:/target" -v "$temp_dir:/backup:ro" alpine:3.21 sh -ec \
    "find /target -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +; tar -C /target -xf /backup/${volume}.tar"
done

echo "Restore complete. Start web and worker, then check /api/health/ready."
