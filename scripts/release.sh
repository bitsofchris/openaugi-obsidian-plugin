#!/usr/bin/env bash
#
# release.sh — publish a new OpenAugi plugin version, safely and verifiably.
#
# Usage:  ./scripts/release.sh X.Y.Z
#
# Why this exists: doing releases by hand drifted manifest.json / package.json /
# versions.json out of sync (0.6.0 shipped with a stale package.json and no
# versions.json) and left a window where the repo advertised a version that had
# no published release — which is plausibly why the plugin was auto-removed from
# the community store. This script bumps all three files in lockstep, then does
# push → tag → wait-for-CI → PUBLISH → verify in one shot so that window never
# opens. See docs/PUBLISHING.md.
#
set -euo pipefail

REPO="bitsofchris/openaugi-obsidian-plugin"
die() { printf '\n\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }
ok()  { printf '\033[32m✓ %s\033[0m\n' "$*"; }
step(){ printf '\n\033[1m▸ %s\033[0m\n' "$*"; }

VERSION="${1:-}"
[[ -n "$VERSION" ]] || die "usage: ./scripts/release.sh X.Y.Z"
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "version must be X.Y.Z (no 'v' prefix): got '$VERSION'"

cd "$(git rev-parse --show-toplevel)"
NOTES="docs/release-notes/${VERSION}.md"

# ── Preconditions ────────────────────────────────────────────────────────────
step "Preconditions"
command -v gh >/dev/null || die "gh CLI not found"
gh auth status >/dev/null 2>&1 || die "gh not authenticated (run: gh auth login)"
[[ "$(git branch --show-current)" == "master" ]] || die "must be on master"
[[ -z "$(git status --porcelain)" ]] || die "working tree not clean — commit or stash first"
git fetch -q origin master
[[ "$(git rev-parse HEAD)" == "$(git rev-parse origin/master)" ]] || die "local master differs from origin/master — push/pull first"
git rev-parse "$VERSION" >/dev/null 2>&1 && die "tag $VERSION already exists locally"
[[ -f "$NOTES" ]] || die "release notes not found: $NOTES (write them first — they become the GitHub release body)"
ok "on master, clean, synced; notes present; tag is free"

# ── Quality gate ─────────────────────────────────────────────────────────────
step "Tests + build"
npm test
npm run build
ok "tests + build pass"

# ── Bump all three version files in lockstep ─────────────────────────────────
step "Bump manifest.json / package.json / versions.json → $VERSION"
node - "$VERSION" <<'NODE'
const fs = require('fs');
const v = process.argv[2];
const write = (f, o) => fs.writeFileSync(f, JSON.stringify(o, null, '\t') + '\n');

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
manifest.version = v;
write('manifest.json', manifest);

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = v;
write('package.json', pkg);

const versions = JSON.parse(fs.readFileSync('versions.json', 'utf8'));
versions[v] = manifest.minAppVersion; // version -> min Obsidian version
write('versions.json', versions);

console.log(`  manifest ${manifest.version} · package ${pkg.version} · versions[${v}]=${versions[v]}`);
NODE
# The guard test now proves the three files agree before we tag anything.
npx vitest run tests/version-consistency.test.ts
ok "version files consistent"

# ── Commit + push + tag ──────────────────────────────────────────────────────
step "Commit, push, tag"
git add manifest.json package.json versions.json "$NOTES"
git commit -q -m "Release $VERSION"
git push -q origin master
git tag -a "$VERSION" -m "$VERSION"        # no 'v' prefix — Obsidian requires tag == manifest version
git push -q origin "$VERSION"
ok "pushed master + tag $VERSION (CI release workflow triggered)"

# ── Wait for CI to build the draft release ───────────────────────────────────
step "Waiting for release workflow"
sleep 5
RUN_ID="$(gh run list --workflow=release.yml --limit 1 --json databaseId --jq '.[0].databaseId')"
gh run watch "$RUN_ID" --exit-status >/dev/null || die "release workflow failed — see: gh run view $RUN_ID"
ok "workflow succeeded (draft release created)"

# ── Publish immediately (close the inconsistency window) ─────────────────────
step "Publishing release $VERSION"
gh release edit "$VERSION" --draft=false --latest --notes-file "$NOTES" >/dev/null
ok "release published"

# ── Verify remote consistency ────────────────────────────────────────────────
step "Verifying"
RAW="https://raw.githubusercontent.com/${REPO}"
DL="https://github.com/${REPO}/releases/download/${VERSION}"
root_v="$(curl -sfL "$RAW/master/manifest.json"  | node -e 'process.stdin.on("data",d=>console.log(JSON.parse(d).version))')"
rel_v="$(curl -sfL "$DL/manifest.json"           | node -e 'process.stdin.on("data",d=>console.log(JSON.parse(d).version))')"
[[ "$root_v" == "$VERSION" ]] || die "root manifest on master is '$root_v', expected '$VERSION'"
[[ "$rel_v"  == "$VERSION" ]] || die "released manifest asset is '$rel_v', expected '$VERSION'"
is_draft="$(gh release view "$VERSION" --json isDraft --jq .isDraft)"
[[ "$is_draft" == "false" ]] || die "release is still a draft"
ok "root manifest = release asset = tag = $VERSION; release is published"

# ── Store-listing health (informational) ─────────────────────────────────────
step "Community-store listing check"
if curl -sfL "https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json" | grep -qi '"openaugi"'; then
  ok "plugin is currently listed in the Obsidian community store"
else
  printf '\033[33m! Not in the community store list. Users update via BRAT or manual install.\n'
  printf '  To relist, see docs/PUBLISHING.md → "If the plugin gets removed from the store".\033[0m\n'
fi

printf '\n\033[32m✓ Released %s\033[0m  →  https://github.com/%s/releases/tag/%s\n' "$VERSION" "$REPO" "$VERSION"
