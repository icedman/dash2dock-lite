#!/usr/bin/env bash
set -euo pipefail

# tools/release.sh — Release orchestrator helper script
# Usage:
#   tools/release.sh prepare <gnome-major> <version> [source-branch]
#   tools/release.sh check
#   tools/release.sh package <version>
#   tools/release.sh publish <version> [remote]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

usage() {
  cat <<EOF
Usage: $0 <command> [args]

Commands:
  prepare <gnome-major> <version> [source-branch]
      Checks out g<gnome-major>, merges source-branch (default: main),
      updates metadata.json shell-version and version integer.
      Example: $0 prepare 50 50.0 main
               $0 prepare 50 50.1

  check
      Runs all mandatory quality gates:
      - make check (syntax)
      - make lint (eslint)
      - make check-settings (schema consistency)
      - make smoke (isolated nested shell test)

  package <version>
      Builds distribution packages:
      - Standard EGO zip: dash2dock-lite@icedman.github.com.zip
      - Release zip: dash2dock-lite-v<version>.zip
      Example: $0 package 50.0

  publish <version> [remote]
      Verifies clean working directory, tags v<version>, pushes branch
      and tag to remote (default: origin), and creates GitHub release
      using gh if installed (or provides release command instructions).
      Example: $0 publish 50.0 origin

EOF
  exit 1
}

cmd="${1:-}"
shift || true

case "$cmd" in
  prepare)
    GNOME_MAJOR="${1:-}"
    VERSION="${2:-}"
    SOURCE_BRANCH="${3:-main}"

    if [ -z "$GNOME_MAJOR" ] || [ -z "$VERSION" ]; then
      echo "Error: GNOME major version and release version are required."
      echo "Example: $0 prepare 50 50.0 main"
      exit 1
    fi

    TARGET_BRANCH="g${GNOME_MAJOR}"
    VERSION="${VERSION#v}"

    echo "==> Preparing release v${VERSION} for GNOME ${GNOME_MAJOR} on branch ${TARGET_BRANCH}..."

    # Ensure clean tree before switching
    if [ -n "$(git status --porcelain)" ]; then
      echo "Error: Working directory has uncommitted changes. Please commit or stash first."
      git status --short
      exit 1
    fi

    # Create target branch if it doesn't exist, else checkout
    if git show-ref --verify --quiet "refs/heads/${TARGET_BRANCH}"; then
      git checkout "${TARGET_BRANCH}"
    elif git show-ref --verify --quiet "refs/remotes/origin/${TARGET_BRANCH}"; then
      git checkout -b "${TARGET_BRANCH}" "origin/${TARGET_BRANCH}"
    else
      echo "Branch ${TARGET_BRANCH} does not exist. Creating from ${SOURCE_BRANCH}..."
      git checkout -b "${TARGET_BRANCH}" "${SOURCE_BRANCH}"
    fi

    # Merge source branch into target branch
    if [ "$TARGET_BRANCH" != "$SOURCE_BRANCH" ]; then
      echo "==> Merging ${SOURCE_BRANCH} into ${TARGET_BRANCH}..."
      git merge "${SOURCE_BRANCH}" --no-ff -m "chore(release): merge ${SOURCE_BRANCH} into ${TARGET_BRANCH} for v${VERSION}" || {
        echo "Merge conflict detected! Resolve conflicts, then run 'git commit' and continue."
        exit 1
      }
    fi

    # Update metadata.json shell-version and version
    echo "==> Updating metadata.json..."
    python3 - <<EOF
import json

meta_file = "metadata.json"
with open(meta_file, "r") as f:
    data = json.load(f)

# Ensure shell-version contains target GNOME major
shell_ver = str("${GNOME_MAJOR}")
current_shells = data.get("shell-version", [])
if shell_ver not in current_shells:
    current_shells.append(shell_ver)
data["shell-version"] = current_shells

# Compute monotonic integer version:
# Format: <gnome_major> * 100 + <sub_release> (e.g. 50.0 -> 5000, 50.1 -> 5001)
parts = "${VERSION}".split(".")
major = int(parts[0])
sub = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 0
computed_version = major * 100 + sub
curr_v = data.get("version", 0)
data["version"] = max(computed_version, curr_v + 1)

with open(meta_file, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")

print(f"Updated metadata.json: shell-version={data['shell-version']}, version={data['version']}")
EOF

    echo "==> Remember to update RELEASES.md with a summary of changes (features, bugfixes, release files)."
    echo "==> Stage changes:"
    echo "    git add metadata.json RELEASES.md"
    echo "    git commit -m 'release: prepare v${VERSION}'"
    echo "==> Next: verify with '$0 check' then package with '$0 package ${VERSION}'"
    ;;

  check)
    echo "==> Running Quality Gates..."
    echo "--- [1/4] make check (syntax) ---"
    make check
    echo "--- [2/4] make lint ---"
    make lint
    echo "--- [3/4] make check-settings ---"
    make check-settings
    echo "--- [4/4] make smoke (headless shell toggle) ---"
    make smoke
    echo "==> All quality gates PASSED clean!"
    ;;

  package)
    VERSION="${1:-}"
    if [ -z "$VERSION" ]; then
      echo "Error: Version string required."
      echo "Example: $0 package 50.0"
      exit 1
    fi
    VERSION="${VERSION#v}"

    echo "==> Packaging extension release v${VERSION}..."
    VERSION="$VERSION" "$SCRIPT_DIR/publish.sh" "$VERSION"
    ;;

  publish)
    VERSION="${1:-}"
    REMOTE="${2:-origin}"

    if [ -z "$VERSION" ]; then
      echo "Error: Version string required."
      echo "Example: $0 publish 50.0 origin"
      exit 1
    fi
    VERSION="${VERSION#v}"
    TAG="v${VERSION}"
    CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
    VERSIONED_ZIP="dash2dock-lite-v${VERSION}.zip"
    EGO_ZIP="dash2dock-lite@icedman.github.com.zip"

    # Verify packages exist
    if [ ! -f "$VERSIONED_ZIP" ] || [ ! -f "$EGO_ZIP" ]; then
      echo "Zip packages not found. Running package first..."
      "$SCRIPT_DIR/release.sh" package "$VERSION"
    fi

    # Determine tag format (accepts e.g. 50.0 or v50.0)
    TAG="v${VERSION}"

    # Verify working tree has been committed
    if [ -n "$(git status --porcelain)" ]; then
      echo "Error: Uncommitted changes in working tree:"
      git status --short
      echo "A committed publish requires clean, committed tree before tagging."
      exit 1
    fi

    # Create annotated git tag on current source tree commit
    COMMIT_HASH="$(git rev-parse --short HEAD)"
    if git rev-parse "$TAG" >/dev/null 2>&1; then
      echo "==> Tag ${TAG} already exists on commit $(git rev-parse --short "$TAG")."
    else
      echo "==> Tagging source tree commit ${COMMIT_HASH} with ${TAG}..."
      git tag -a "$TAG" -m "Release ${TAG} for GNOME ${CURRENT_BRANCH} (commit ${COMMIT_HASH})"
    fi

    echo "==> Pushing branch ${CURRENT_BRANCH} and tag ${TAG} to ${REMOTE}..."
    git push "$REMOTE" "$CURRENT_BRANCH"
    git push "$REMOTE" "$TAG"

    echo "==> Verified: Commit ${COMMIT_HASH} tagged as ${TAG} and pushed."

    # Check for GitHub CLI
    if command -v gh >/dev/null 2>&1; then
      echo "==> Creating GitHub Release via gh..."
      gh release create "$TAG" \
        "$VERSIONED_ZIP" \
        "$EGO_ZIP" \
        --title "Dash2Dock Animated ${TAG}" \
        --generate-notes || {
          echo "Warning: gh release create failed. Please create release manually on GitHub."
        }
    else
      echo "==> 'gh' CLI not found. You can upload the generated zips to GitHub manually:"
      echo "    Artifact 1: $REPO_ROOT/$VERSIONED_ZIP"
      echo "    Artifact 2: $REPO_ROOT/$EGO_ZIP"
      echo "    URL: https://github.com/icedman/dash2dock-lite/releases/new?tag=${TAG}"
    fi

    echo "==> To submit to GNOME Extensions (EGO):"
    echo "    Upload $REPO_ROOT/$EGO_ZIP to https://extensions.gnome.org/upload/"
    ;;

  *)
    usage
    ;;
esac
