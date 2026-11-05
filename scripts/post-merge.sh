#!/bin/bash
set -e

echo "=== Post-merge setup ==="

echo "Installing dependencies..."
npm install --legacy-peer-deps

echo "Applying guarded 1C catalog migration..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/0111_1c_catalog_integration.sql

echo "Applying DB schema changes..."
# --force skips interactive confirmation prompts (stdin is closed in post-merge context).
# Drizzle push is additive-safe: uses IF NOT EXISTS for new columns/tables.
# Destructive changes (column drops) still require manual review before merging.
npx drizzle-kit push --force

echo "=== Post-merge setup complete ==="
