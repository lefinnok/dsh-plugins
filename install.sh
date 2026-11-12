#!/usr/bin/env bash
# Link every plugin bundle in this repository into a dsh profile.
#
#   ./install.sh                    # profile $DSH_PROFILE, or "web"
#   ./install.sh --profile work
#   ./install.sh --dry-run
#
# Each bundle is added with `dsh plugin add <dir>`, which links the package into
# the profile and appends it to the profile's dsh.profile.bundles list.
set -euo pipefail

HERE=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
PROFILE=${DSH_PROFILE:-web}
DRY=0

while [[ $# -gt 0 ]]; do
  case $1 in
    --profile) PROFILE=${2:?--profile needs a name}; shift 2 ;;
    --dry-run) DRY=1; shift ;;
    -h|--help) sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "install.sh: unknown argument: $1" >&2; exit 2 ;;
  esac
done

command -v dsh >/dev/null || { echo "install.sh: 'dsh' is not on PATH" >&2; exit 1; }

run() {
  if (( DRY )); then printf '  +'; printf ' %q' "$@"; printf '\n'; else "$@"; fi
}

echo "install.sh: profile '$PROFILE', plugins from $HERE"
echo

count=0
for manifest in "$HERE"/*/package.json; do
  dir=$(dirname -- "$manifest")
  # Only bundle packages: a dsh block that declares a patch.
  grep -q '"dsh"[[:space:]]*:' "$manifest" || continue
  grep -q '"bundle"[[:space:]]*:[[:space:]]*{' "$manifest" || continue
  # Skip directories this repository ignores (reference checkouts, scratch).
  if git -C "$HERE" rev-parse --git-dir >/dev/null 2>&1 && git -C "$HERE" check-ignore -q -- "$dir/"; then
    continue
  fi
  name=$(sed -n 's/.*"name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$manifest" | head -1)
  echo "→ ${name:-$dir}"
  run dsh plugin --profile "$PROFILE" add "$dir"
  count=$((count + 1))
done

echo
if (( count == 0 )); then
  echo "install.sh: no bundle packages found in $HERE" >&2
  exit 1
fi
echo "install.sh: $count bundle(s) linked into '$PROFILE'. Restart dsh to load them."
