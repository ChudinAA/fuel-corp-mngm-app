#!/usr/bin/env bash
# Export the database configured by DATABASE_URL to a compressed SQL dump.
# In the Replit shell, DATABASE_URL normally points to development. For a
# production dump, obtain the connection details from Replit Database Settings
# and run this script in a secure shell without recording the URL.

set -euo pipefail

OUTPUT_FILE="${OUTPUT_FILE:-database_export_$(date +%Y%m%d_%H%M%S).sql.gz}"
TEMP_FILE="${OUTPUT_FILE}.tmp.$$"
trap 'rm -f "$TEMP_FILE"' EXIT

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not configured."
  echo "Set DATABASE_URL in a secure shell, then run:"
  echo "  bash scripts/export-database.sh"
  exit 1
fi

echo "Exporting the database configured by DATABASE_URL..."
echo "Output file: $OUTPUT_FILE"

pg_dump \
  "$DATABASE_URL" \
  --no-owner \
  --no-acl \
  --format=plain \
  --exclude-table=session \
  | gzip -9 > "$TEMP_FILE"

mv "$TEMP_FILE" "$OUTPUT_FILE"
SIZE=$(du -sh "$OUTPUT_FILE" | cut -f1)
echo "Export complete: $OUTPUT_FILE ($SIZE)"
