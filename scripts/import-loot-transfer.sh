#!/bin/sh
# Run on TrueNAS after upgrading SkyStore. SQL contains private event state.
set -eu
state=${1:?Usage: sh import-loot-transfer.sh /mnt/Atlantis/Vault/Skystore/backups/skystore-event-state.sql}
test -f "$state" || { echo "Transfer file not found: $state" >&2; exit 1; }
database_container=$(docker ps -q --filter label=com.docker.compose.project=ix-skystore --filter label=com.docker.compose.service=postgres)
test -n "$database_container" || { echo "Start the upgraded SkyStore app first." >&2; exit 1; }
app_containers=$(docker ps --filter label=com.docker.compose.project=ix-skystore --format '{{.ID}} {{.Label "com.docker.compose.service"}}' | awk '$2=="web" || $2=="worker" {print $1}')
backup="$(dirname "$state")/before-event-transfer-$(date -u +%Y%m%dT%H%M%SZ).dump"
umask 077
if test -n "$app_containers"; then docker stop $app_containers; fi
restart_app() { if test -n "$app_containers"; then docker start $app_containers; fi; }
trap restart_app EXIT
docker exec "$database_container" pg_dump -U skystore -d skystore -Fc > "$backup"
test -s "$backup"
docker exec -i "$database_container" psql -v ON_ERROR_STOP=1 -U skystore -d skystore < "$state"
echo "Event state imported. Existing public reports were not replaced. Backup: $backup"
