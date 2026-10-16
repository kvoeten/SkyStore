#!/bin/sh
# Key is supplied privately by the operator, never stored in the public repository.
set -eu
url=${1:?Encrypted transfer URL required}
: "${SKYSTORE_TRANSFER_KEY:?Private transfer key required}"
case "$url" in https://raw.githubusercontent.com/kvoeten/SkyStore/*/deploy/transfers/*.encrypted.json) ;; *) echo "Unexpected transfer URL" >&2; exit 1;; esac
web=$(docker ps -q --filter label=com.docker.compose.project=ix-skystore --filter label=com.docker.compose.service=web)
test -n "$web" || { echo "Start the updated SkyStore app first." >&2; exit 1; }
umask 077
target=/mnt/Atlantis/Vault/Skystore/backups
mkdir -p "$target"
encrypted=$(mktemp "$target/event-transfer.XXXXXX")
helper=$(mktemp "$target/event-import.XXXXXX")
trap 'rm -f "$encrypted" "$helper"' EXIT
curl -fL "$url" -o "$encrypted"
# Authentication is checked before any plaintext is written or imported.
docker exec -i -e SKYSTORE_TRANSFER_KEY="$SKYSTORE_TRANSFER_KEY" "$web" node --input-type=module -e '
import {createDecipheriv} from "node:crypto";
let input="";for await(const chunk of process.stdin)input+=chunk;
const p=JSON.parse(input);if(p.version!==1)throw Error("Unknown transfer format");
const d=createDecipheriv("aes-256-gcm",Buffer.from(process.env.SKYSTORE_TRANSFER_KEY,"hex"),Buffer.from(p.iv,"hex"));
d.setAuthTag(Buffer.from(p.tag,"hex"));const bytes=Buffer.concat([d.update(Buffer.from(p.data,"base64")),d.final()]);
process.stdout.write(bytes);
' < "$encrypted" > "$target/skystore-event-state.sql"
unset SKYSTORE_TRANSFER_KEY
curl -fL https://github.com/kvoeten/SkyStore/releases/download/v0.4.0/import-loot-transfer.sh -o "$helper"
sh "$helper" "$target/skystore-event-state.sql"
