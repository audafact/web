#!/bin/bash

# Migration Validation Script
# Run this before applying any migration to ensure it won't break your schema

echo "🔍 Validating migration for destructive changes..."
echo "=================================================="

# Check if there are any pending migrations
PENDING_MIGRATIONS=$(npx supabase db diff --schema public 2>/dev/null | grep -E "(DROP|ALTER.*COLUMN|MODIFY)" || echo "No destructive changes found")

if [[ "$PENDING_MIGRATIONS" == "No destructive changes found" ]]; then
    echo "✅ No destructive changes detected"
    echo "✅ Migration is safe to apply"
    exit 0
else
    echo "❌ DESTRUCTIVE CHANGES DETECTED!"
    echo "=================================================="
    echo "$PENDING_MIGRATIONS"
    echo "=================================================="
    echo ""
    echo "⚠️  This migration will modify existing table structures!"
    echo "⚠️  Review the changes above before proceeding."
    echo ""
    echo "To proceed anyway, run: npx supabase db push --force"
    echo "To abort, press Ctrl+C"
    echo ""
    read -p "Do you want to proceed? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Proceeding with migration..."
        exit 0
    else
        echo "Migration aborted."
        exit 1
    fi
fi
