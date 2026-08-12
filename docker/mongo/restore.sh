#!/usr/bin/env bash
set -euo pipefail

mongo_uri="${MONGO_URI:-mongodb://mongodb:27017}"
mongo_database="${MONGO_DATABASE:-test}"
backup_file="${BACKUP_FILE:-/backup/backup.gz}"

if [[ ! -r "${backup_file}" ]]; then
  echo "MongoDB backup is not readable: ${backup_file}" >&2
  exit 1
fi

collection_count="$(
  mongosh "${mongo_uri}/${mongo_database}" \
    --quiet \
    --eval 'db.getCollectionNames().length'
)"

if [[ "${collection_count}" != "0" ]]; then
  echo "MongoDB database '${mongo_database}' already contains data; skipping restore."
  exit 0
fi

echo "Restoring '${mongo_database}' from ${backup_file}..."
mongorestore \
  --uri="${mongo_uri}" \
  --archive="${backup_file}" \
  --gzip \
  --nsInclude="${mongo_database}.*"

echo "MongoDB restore completed."
