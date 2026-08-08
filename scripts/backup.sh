#!/usr/bin/env bash
# Create an encrypted, complete logical backup and copy it to an off-host rclone target.
set -euo pipefail

required=(BACKUP_AGE_RECIPIENT OFFSITE_BACKUP_TARGET)
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required environment variable: $name" >&2
    exit 64
  fi
done
for command in docker age rclone tar; do command -v "$command" >/dev/null || { echo "Required command not found: $command" >&2; exit 69; }; done

project="${COMPOSE_PROJECT_NAME:-skystore}"
database="${POSTGRES_DB:-skystore}"
database_user="${POSTGRES_USER:-skystore}"
output_dir="${BACKUP_OUTPUT_DIR:-$PWD/.backups}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
bundle_name="skystore-${timestamp}.tar.gz"
encrypted_name="${bundle_name}.age"
temp_dir="$(mktemp -d "${TMPDIR:-/tmp}/skystore-backup.XXXXXX")"
cleanup() { rm -rf -- "$temp_dir"; }
trap cleanup EXIT
mkdir -p -- "$output_dir"
umask 077

echo "Dumping PostgreSQL database '$database'..."
docker compose exec -T postgres pg_dump -U "$database_user" -Fc "$database" > "$temp_dir/database.dump"

for volume in uploads catalog_images; do
  docker_volume="${project}_${volume}"
  echo "Archiving volume '$docker_volume'..."
  docker run --rm -v "${docker_volume}:/source:ro" -v "$temp_dir:/backup" alpine:3.21 \
    tar -C /source -cf "/backup/${volume}.tar" .
done

tar -C "$temp_dir" -czf "$temp_dir/$bundle_name" database.dump uploads.tar catalog_images.tar
encrypted_path="$output_dir/$encrypted_name"
age -r "$BACKUP_AGE_RECIPIENT" -o "$encrypted_path" "$temp_dir/$bundle_name"
rclone copyto --immutable "$encrypted_path" "$OFFSITE_BACKUP_TARGET/$encrypted_name"
rclone lsf "$OFFSITE_BACKUP_TARGET" | grep -Fqx "$encrypted_name"
echo "Encrypted backup uploaded and verified: $OFFSITE_BACKUP_TARGET/$encrypted_name"
