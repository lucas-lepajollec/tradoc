#!/bin/sh
set -eu

data_dir="${DATA_DIR:-/app/data}"
secret_file="${APP_SECRET_FILE:-${data_dir}/.app_secret}"

if [ -z "${APP_SECRET:-}" ]; then
  mkdir -p "$data_dir"
  if [ ! -s "$secret_file" ]; then
    umask 077
    python -c 'import secrets; print(secrets.token_urlsafe(32))' > "$secret_file"
  fi
  APP_SECRET="$(cat "$secret_file")"
  export APP_SECRET
  printf '%s\n' '[TraDoc] APP_SECRET loaded from persistent storage.'
  printf '%s\n' '[TraDoc] Retrieve it with: docker compose exec tradoc cat /app/data/.app_secret'
fi

exec "$@"
