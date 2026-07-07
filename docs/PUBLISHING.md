# Publishing a New Release

**name:** publish-release
**description:** How to cut and publish a new OpenAugi plugin version safely, keep it consistent with the Obsidian community store, and what to do if the plugin gets de-listed.
**when to use:** Any time you ship a new version of the plugin (features, fixes) or need to relist it in the community store.

---

## TL;DR — use the script

```bash
# 1. Write the release notes first (they become the GitHub release body):
#      docs/release-notes/X.Y.Z.md
# 2. Then run:
./scripts/release.sh X.Y.Z
```

`release.sh` does the whole thing and **verifies it**: checks preconditions →
runs tests + build → bumps `manifest.json`, `package.json`, **and
`versions.json`** in lockstep → commits, pushes, tags → waits for CI → **publishes
the draft immediately** → verifies that the repo-root manifest, the released
manifest asset, and the tag all equal `X.Y.Z`. It stops loudly on any mismatch.

Everything below explains *why* it does what it does, and the manual fallback.

## The three things Obsidian actually checks

1. **`manifest.json` at the repo-root HEAD** — Obsidian reads only the `version`
   field here to decide "what's the latest version."
2. **A GitHub release whose tag == that version** (no `v` prefix), with
   `main.js`, `manifest.json`, and `styles.css` attached as assets. Obsidian
   downloads the files from the *release*, not from the repo tree.
3. **`versions.json`** — maps each plugin version → minimum Obsidian version.
   Used to decide whether a given user's Obsidian is new enough to be offered the
   update.

If the root manifest advertises a version that has **no matching published
release**, the plugin is in an inconsistent state — and Obsidian's automated
validation can drop it from the store. Never leave that window open. (This is
what bit us on 0.6.0.)

## Version files — all THREE must move together

| File | Field | Notes |
|------|-------|-------|
| `manifest.json` | `version` | source of truth for the release tag |
| `package.json`  | `version` | keep in sync (npm/build hygiene) |
| `versions.json` | add `"X.Y.Z": "<minAppVersion>"` | **easy to forget — it's why updates/relisting break** |

The `tests/version-consistency.test.ts` guard test fails the build if these ever
disagree. `npm test` therefore catches a forgotten `versions.json` bump before
you tag.

> Historical note: earlier versions of this doc listed only `manifest.json` and
> `package.json`. `versions.json` was missing entirely, which broke the
> `npm version` script and left the store metadata incomplete. Don't regress.

## Pre-release checklist

- [ ] Features/fixes merged to master; `git status` clean; local == `origin/master`
- [ ] `npm test` passes (includes the version-consistency guard) — see [TESTING.md](TESTING.md)
- [ ] `npm run build` clean (tsc + esbuild)
- [ ] Manually tested in a real vault (`npm run dev`, reload plugin, exercise the change)
- [ ] `docs/CODEBASE_MAP.md` / `README.md` updated for any behavior change
- [ ] Release notes written to `docs/release-notes/X.Y.Z.md`

## Release notes format

Write `docs/release-notes/X.Y.Z.md` before releasing. Claude: diff commits since
the previous tag and focus on user-facing changes.

```markdown
# X.Y.Z — <one-line theme>

## Added / Changed / Fixed / Deprecated
- <user-facing change>: <why the user cares>

## Notes
- <breaking changes or upgrade steps, if any>
```

## Manual fallback (if you can't use the script)

Only if `release.sh` can't run. Do the steps **in this order** and don't stop
before publishing:

```bash
# 1. Bump ALL THREE (or run: npm version X.Y.Z  — see note below)
#    manifest.json .version, package.json .version, versions.json add "X.Y.Z":"<minAppVersion>"
npm test && npm run build            # guard test must be green

git add manifest.json package.json versions.json docs/release-notes/X.Y.Z.md
git commit -m "Release X.Y.Z"
git push origin master

git tag -a X.Y.Z -m "X.Y.Z"          # annotated, no 'v' prefix
git push origin X.Y.Z                # triggers .github/workflows/release.yml → draft

# 2. Wait for the workflow, then PUBLISH RIGHT AWAY (don't leave it a draft):
gh run watch "$(gh run list --workflow=release.yml --limit 1 --json databaseId --jq '.[0].databaseId')" --exit-status
gh release edit X.Y.Z --draft=false --latest --notes-file docs/release-notes/X.Y.Z.md

# 3. Verify root manifest, released asset, and tag all say X.Y.Z:
curl -sL https://raw.githubusercontent.com/bitsofchris/openaugi-obsidian-plugin/master/manifest.json | grep version
curl -sL https://github.com/bitsofchris/openaugi-obsidian-plugin/releases/download/X.Y.Z/manifest.json | grep version
```

> `npm version X.Y.Z` also works: `.npmrc` sets `tag-version-prefix=""` (so the
> tag has no `v`), and the `version` npm script runs `version-bump.mjs` which
> updates `manifest.json` + `versions.json`, while npm bumps `package.json`. It
> commits and tags for you — but it does **not** push or publish, so you still
> owe steps 1–3 above (push, wait, publish, verify). The script does all of it.

## Community-store listing health

The plugin is listed in Obsidian's store via
[`obsidianmd/obsidian-releases`](https://github.com/obsidianmd/obsidian-releases).
That repo's `community-plugins.json` is now an **automated mirror** of Obsidian's
internal list (commits read `chore: Mirror community plugins and themes`), so you
can't fix listing by PR'ing that file — it gets overwritten.

Check whether we're currently listed:

```bash
curl -sL https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json | grep -i openaugi
```

- **Listed** → core Settings → Community plugins → "Check for updates" works for users.
- **Not listed** → core update check can't see us; users must use **BRAT** or a
  manual install. See the relisting steps below.

### If the plugin gets removed from the store

This happened on **2026-07-07** (removed in mirror commit `85db6f23`, bundled with
several unrelated plugins — an automated batch removal). The mirror commits carry
no per-plugin reason and Obsidian doesn't file an issue on your repo, so:

1. **Fix consistency first** (so a resubmit passes validation): run a clean
   release with `release.sh` — root manifest version must equal a *published*
   release with the three assets, `versions.json` present, `README`/`LICENSE`
   present. (All true as of 0.6.0.)
2. **Ask Obsidian why + request reinstatement** — don't blindly resubmit an
   auto-removal. Post in the Obsidian Discord **`#plugin-dev`** channel (fastest;
   plugin-review team is active there) or the forum **Developers: Plugin & API**
   category. Cite: repo URL, removal date `2026-07-07`, mirror commit `85db6f23`.
3. **If they tell you to resubmit:** the current path is the web portal at
   **community.obsidian.md** → sign in with your Obsidian account → link GitHub →
   Plugins → New plugin → enter the repo URL. (The old "PR to
   community-plugins.json" flow is dead now that the file is bot-mirrored.)
4. **Gotcha — "An entry already exists for this repository":** because the old
   entry is archived rather than deleted, resubmitting the same repo URL can be
   rejected. Ask a moderator in `#plugin-dev` to delete the archived entry, then
   resubmit.

Sources: Obsidian plugin submission docs; obsidian-releases repo (mirror
architecture); forum thread "Cannot resubmit plugin after archiving: 'An entry
already exists for this repository'".

## Troubleshooting

**Tag already exists / wrong version tagged**
```bash
git tag -d X.Y.Z
git push origin --delete X.Y.Z     # if already pushed
# fix versions, re-run ./scripts/release.sh X.Y.Z
```

**Workflow failed** — `gh run view <id>`, fix, delete the tag, re-run the script.

**Release stuck as draft** — `gh release edit X.Y.Z --draft=false --latest`.
