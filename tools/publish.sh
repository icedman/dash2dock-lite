#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

BUILD_DIR="$REPO_ROOT/build"
UUID="$(python3 -c "import json; print(json.load(open('$REPO_ROOT/metadata.json'))['uuid'])" 2>/dev/null || echo "dash2dock-lite@icedman.github.com")"
ZIP_FILE="$REPO_ROOT/${UUID}.zip"

echo "Packaging ${UUID}..."

# Clean build directory and existing zip
rm -rf "$BUILD_DIR"
rm -f "$ZIP_FILE"
mkdir -p "$BUILD_DIR"

# Copy root metadata, styles, and docs
cp "$REPO_ROOT/metadata.json" "$BUILD_DIR/"
cp "$REPO_ROOT/stylesheet.css" "$BUILD_DIR/"
cp "$REPO_ROOT/LICENSE" "$BUILD_DIR/"
cp "$REPO_ROOT/README.md" "$BUILD_DIR/"
if [ -f "$REPO_ROOT/CHANGELOG.md" ]; then
  cp "$REPO_ROOT/CHANGELOG.md" "$BUILD_DIR/"
fi

# Copy shipped root JS modules
cp "$REPO_ROOT"/*.js "$BUILD_DIR/"

# Copy component subdirectories
cp -r "$REPO_ROOT/apps" "$BUILD_DIR/"
cp -r "$REPO_ROOT/effects" "$BUILD_DIR/"
cp -r "$REPO_ROOT/preferences" "$BUILD_DIR/"
cp -r "$REPO_ROOT/themes" "$BUILD_DIR/"
cp -r "$REPO_ROOT/ui" "$BUILD_DIR/"

# Copy schemas (only source XML, never compiled cache)
mkdir -p "$BUILD_DIR/schemas"
cp "$REPO_ROOT/schemas"/*.xml "$BUILD_DIR/schemas/"

# Clean any non-distribution or obsolete files
rm -f "$BUILD_DIR/eslint.config.js"
rm -f "$BUILD_DIR/schemas/"*.compiled
rm -f "$BUILD_DIR/apps/mount-dash2dock-lite.desktop"
rm -f "$BUILD_DIR/"*_.js

# Package into zip
rm -f "$REPO_ROOT"/*.zip
(
  cd "$BUILD_DIR"
  zip -qr "$ZIP_FILE" .
)

echo "Successfully created ${ZIP_FILE} ($(du -h "$ZIP_FILE" | cut -f1))"
