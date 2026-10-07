#!/usr/bin/env bash
# Dash2Dock Animated One-Line Installer
# Usage:
#   curl -sSL https://raw.githubusercontent.com/icedman/dash2dock-lite/main/install.sh | bash
#   or
#   bash <(curl -sSL https://raw.githubusercontent.com/icedman/dash2dock-lite/main/install.sh)

set -euo pipefail

REPO="icedman/dash2dock-lite"
UUID="dash2dock-lite@icedman.github.com"
INSTALL_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/${UUID}"

echo "========================================="
echo "   Dash2Dock Animated Installer"
echo "========================================="

# 1. Dependency checks
for cmd in curl unzip; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Error: Required tool '$cmd' is not installed. Please install it and try again." >&2
    exit 1
  fi
done

# 2. Detect GNOME Desktop & Shell Version
GNOME_VER=""
GNOME_MAJOR=""
DESKTOP="${XDG_CURRENT_DESKTOP:-${DESKTOP_SESSION:-}}"

if command -v gnome-shell >/dev/null 2>&1; then
  GNOME_VER=$(gnome-shell --version 2>/dev/null | awk '{print $3}' || true)
  if [ -n "$GNOME_VER" ]; then
    # e.g., "50.5" -> "50", "45.2" -> "45", "42.9" -> "42"
    GNOME_MAJOR=$(echo "$GNOME_VER" | cut -d'.' -f1)
  fi
fi

if [ -n "$GNOME_VER" ]; then
  echo "Detected GNOME Shell version: ${GNOME_VER} (Major: ${GNOME_MAJOR})"
else
  echo "WARNING: GNOME Shell does not appear to be running or installed on this system!"
  if [ -n "$DESKTOP" ]; then
    echo "    Current desktop session reported: ${DESKTOP}"
  fi
  echo "    Dash2Dock Animated requires GNOME Shell (42-50+). Installation can proceed,"
  echo "    but the extension will only function inside a GNOME desktop session."
fi
echo ""

# 3. Fetch Releases from GitHub API
echo "Fetching available releases from GitHub..."
API_URL="https://api.github.com/repos/${REPO}/releases"

# Fetch releases JSON into temporary file
RELEASES_TMP=$(mktemp)
trap 'rm -f "$RELEASES_TMP"' EXIT

if ! curl -sSL -H "Accept: application/vnd.github.v3+json" "$API_URL" -o "$RELEASES_TMP"; then
  echo "Error: Failed to fetch releases from GitHub." >&2
  exit 1
fi

# Parse releases and assets using python or awk/sed
AVAILABLE_OPTIONS=$(python3 - "$RELEASES_TMP" "$GNOME_MAJOR" << 'EOF'
import json, sys

rel_file = sys.argv[1]
gnome_major_str = sys.argv[2] if len(sys.argv) > 2 else ""
gnome_major = int(gnome_major_str) if gnome_major_str.isdigit() else None

try:
    with open(rel_file, 'r') as f:
        releases = json.load(f)
except Exception:
    releases = []

if not isinstance(releases, list):
    sys.exit(0)

idx = 1
for r in releases:
    tag = r.get('tag_name', '')
    name = r.get('name') or tag
    assets = r.get('assets', [])
    zip_asset = None
    for a in assets:
        if a.get('name', '').endswith('.zip'):
            zip_asset = a
            if tag in a.get('name', ''):
                break
    if not zip_asset and assets:
        zip_asset = assets[0]
    
    if zip_asset:
        dl_url = zip_asset.get('browser_download_url', '')
        asset_name = zip_asset.get('name', '')
        
        # Determine supported GNOME versions
        compat_info = ""
        is_rec = False
        tag_l = tag.lower()
        if tag_l.startswith('v50') or tag_l == 'g50':
            compat_info = "[GNOME 45 - 50]"
            if gnome_major is not None and 45 <= gnome_major <= 50:
                is_rec = True
        elif tag_l == 'g45':
            compat_info = "[GNOME 45 - 46]"
        elif tag_l == 'g44':
            compat_info = "[GNOME 42 - 44]"
            if gnome_major is not None and 42 <= gnome_major <= 44:
                is_rec = True

        rec_str = ' (Recommended for your GNOME version)' if is_rec else ''
        display_label = f'{tag} {compat_info} - {name}'
        if rec_str:
            display_label += f'{rec_str}'
        print(f'{idx}|{tag}|{display_label}|{dl_url}|{asset_name}|{1 if is_rec else 0}')
        idx += 1
EOF
)

if [ -z "$AVAILABLE_OPTIONS" ]; then
  echo "No downloadable release packages found on GitHub." >&2
  exit 1
fi

echo "Available Releases:"
echo "-----------------------------------------"

declare -a TAGS
declare -a DESCS
declare -a URLS
declare -a FILENAMES

REC_IDX=""
while IFS='|' read -r num tag desc url filename is_rec; do
  [ -z "$num" ] && continue
  TAGS[$num]="$tag"
  DESCS[$num]="$desc"
  URLS[$num]="$url"
  FILENAMES[$num]="$filename"
  
  echo "  [$num] $desc"
  if [ "${is_rec:-0}" = "1" ] && [ -z "$REC_IDX" ]; then
    REC_IDX="$num"
  fi
done <<< "$AVAILABLE_OPTIONS"

echo "-----------------------------------------"

# 4. User Selection & Version Compatibility Check
DEFAULT_PROMPT=""
if [ -n "$REC_IDX" ]; then
  DEFAULT_PROMPT=" [default: $REC_IDX]"
elif [ -n "$GNOME_MAJOR" ]; then
  DEFAULT_PROMPT=" [default: 1 (Force Install)]"
fi

# Determine input source:
INPUT_SRC=""
if [ -t 0 ]; then
  INPUT_SRC="/dev/stdin"
elif [ -e /dev/tty ] && [ -r /dev/tty ]; then
  INPUT_SRC="/dev/tty"
else
  INPUT_SRC="/dev/stdin"
fi

CHOICE=""
while [ -z "$CHOICE" ]; do
  printf "Select release to install (1-%d)%s: " "${#TAGS[@]}" "$DEFAULT_PROMPT"
  read -r user_input < "$INPUT_SRC" || user_input=""
  
  if [ -z "$user_input" ]; then
    if [ -n "$REC_IDX" ]; then
      CHOICE="$REC_IDX"
      break
    elif [ -n "$GNOME_MAJOR" ]; then
      CHOICE="1"
      break
    fi
  fi

  if [[ "$user_input" =~ ^[0-9]+$ ]] && [ "$user_input" -ge 1 ] && [ "$user_input" -le "${#TAGS[@]}" ]; then
    CHOICE="$user_input"
    break
  else
    echo "Invalid option. Please enter a number between 1 and ${#TAGS[@]}."
  fi
done

CHOSEN_TAG="${TAGS[$CHOICE]}"
CHOSEN_URL="${URLS[$CHOICE]}"
CHOSEN_FILE="${FILENAMES[$CHOICE]}"

# Check if current system GNOME is greater than the selected release compatibility
IS_FORCE_INSTALL=0
if [ -n "$GNOME_MAJOR" ]; then
  CHOSEN_MAX=50
  if [[ "${CHOSEN_TAG,,}" =~ ^g44 ]]; then
    CHOSEN_MAX=44
  elif [[ "${CHOSEN_TAG,,}" =~ ^g45 ]]; then
    CHOSEN_MAX=46
  fi

  if [ "$GNOME_MAJOR" -gt "$CHOSEN_MAX" ]; then
    IS_FORCE_INSTALL=1
    echo ""
    echo "NOTICE: Your system GNOME Shell (${GNOME_MAJOR}) is newer than the verified release range for ${CHOSEN_TAG} (up to ${CHOSEN_MAX})."
    printf "Would you like to force install and add GNOME %s to metadata.json? [Y/n]: " "$GNOME_MAJOR"
    read -r force_confirm < "$INPUT_SRC" || force_confirm="y"
    if [[ "${force_confirm,,}" =~ ^n ]]; then
      echo "Installation cancelled."
      exit 0
    fi
    echo "Proceeding with force install..."
  fi
fi

echo ""
echo "Downloading $CHOSEN_FILE ($CHOSEN_TAG)..."
DOWNLOAD_FILE="/tmp/${CHOSEN_FILE}"

if ! curl -sSL -L "$CHOSEN_URL" -o "$DOWNLOAD_FILE"; then
  echo "Error: Download failed from $CHOSEN_URL" >&2
  exit 1
fi

echo "Installing to $INSTALL_DIR..."
rm -rf "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR"

if ! unzip -q -o "$DOWNLOAD_FILE" -d "$INSTALL_DIR"; then
  echo "Error: Failed to extract $DOWNLOAD_FILE" >&2
  rm -f "$DOWNLOAD_FILE"
  exit 1
fi
rm -f "$DOWNLOAD_FILE"

# If force install on newer GNOME, patch metadata.json to include current GNOME_MAJOR
if [ "$IS_FORCE_INSTALL" -eq 1 ] && [ -n "$GNOME_MAJOR" ] && [ -f "$INSTALL_DIR/metadata.json" ]; then
  echo "Updating $INSTALL_DIR/metadata.json to include GNOME \"$GNOME_MAJOR\"..."
  python3 - "$INSTALL_DIR/metadata.json" "$GNOME_MAJOR" << 'EOF'
import json, sys

meta_path = sys.argv[1]
gnome_ver = sys.argv[2]

try:
    with open(meta_path, 'r') as f:
        meta = json.load(f)
    shells = meta.get("shell-version", [])
    if gnome_ver not in shells:
        shells.append(gnome_ver)
        meta["shell-version"] = shells
        with open(meta_path, 'w') as f:
            json.dump(meta, f, indent=2)
            f.write("\n")
        print(f"Added \"{gnome_ver}\" to shell-version: {shells}")
except Exception as e:
    print(f"Warning: Failed to update metadata.json: {e}", file=sys.stderr)
EOF
fi

# Compile schemas if source xml is present
if [ -d "$INSTALL_DIR/schemas" ] && command -v glib-compile-schemas >/dev/null 2>&1; then
  echo "Compiling GSettings schemas..."
  glib-compile-schemas "$INSTALL_DIR/schemas"
fi

echo ""
echo "========================================="
echo "   Installation Successful!"
echo "========================================="
# Ask to enable the extension
if command -v gnome-extensions >/dev/null 2>&1; then
  echo ""
  printf "Would you like to enable Dash2Dock Animated now? [Y/n]: "
  read -r enable_confirm < "$INPUT_SRC" || enable_confirm="y"
  if [[ ! "${enable_confirm,,}" =~ ^n ]]; then
    echo "Enabling extension $UUID..."
    if gnome-extensions enable "$UUID"; then
      echo "Extension enabled successfully!"
    else
      echo "Notice: Could not enable immediately (session restart may be required)."
    fi
  fi
fi

echo ""
echo "Next steps:"
if command -v gnome-extensions >/dev/null 2>&1; then
  echo "  - To configure: run 'gnome-extensions prefs $UUID'"
else
  echo "  - Enable the extension in your Extensions app or via CLI."
fi
echo "  - If the dock does not appear immediately, restart GNOME Shell:"
echo "     * On X11: Press Alt+F2, type 'r', and press Enter."
echo "     * On Wayland: Log out and log back in."
echo ""
echo "-----------------------------------------"
echo "Support Dash2Dock Animated:"
echo "  If you enjoy this extension, consider supporting development:"
echo "  - Buy Me A Coffee: https://www.buymeacoffee.com/icedman"
echo "  - Ko-fi:           https://ko-fi.com/icedman"
echo "-----------------------------------------"
echo ""
