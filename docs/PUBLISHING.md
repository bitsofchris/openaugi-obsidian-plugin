# Publishing a New Release

This guide walks through the complete process of publishing a new OpenAugi plugin release.

## Pre-Release Checklist

Before starting the release process:

- [ ] All features/fixes are merged to master
- [ ] Code builds without errors (`npm run build`)
- [ ] Type checking passes (`npm run typecheck`)
- [ ] Manual testing completed in test vault (`/Users/chris/zk-for-testing`)
- [ ] CODEBASE_MAP.md is up to date with any architectural changes

## Release Process

### Step 1: Bump the Version

Update the version number in **both** files (they must match):

1. `manifest.json` - Update the `"version"` field
2. `package.json` - Update the `"version"` field

Use semantic versioning:
- **MAJOR** (1.0.0): Breaking changes
- **MINOR** (0.1.0): New features, backwards compatible
- **PATCH** (0.0.1): Bug fixes, backwards compatible

### Step 2: Commit the Version Bump

```bash
git add manifest.json package.json
git commit -m "Bump version to X.Y.Z"
git push origin master
```

### Step 3: Create and Push the Git Tag

The tag **must** match the version in `manifest.json` exactly.

```bash
git tag -a X.Y.Z -m "X.Y.Z"
git push origin X.Y.Z
```

Notes:
- `-a` creates an [annotated tag](https://git-scm.com/book/en/v2/Git-Basics-Tagging#_creating_tags) (required for Obsidian releases)
- `-m` specifies the tag message - must match the version number

### Step 4: Wait for GitHub Actions

The workflow will automatically:
1. Build the plugin
2. Create a draft release with the built artifacts

Monitor progress at: https://github.com/bitsofchris/openaugi-obsidian-plugin/actions

### Step 5: Generate Release Notes

**Claude should generate release notes** by comparing the new tag to the previous release:

1. Look at all commits since the last release tag
2. Identify user-facing changes (features, fixes, improvements)
3. Create release notes in this format:

```markdown
## TL;DR
[One-sentence summary of the most important change(s)]

## What's New

### Features
- [Feature 1]: [Brief description of what it does and why users care]
- [Feature 2]: [Brief description]

### Bug Fixes
- [Fix 1]: [What was broken and how it's fixed]

### Improvements
- [Improvement 1]: [What's better now]

## How to Use

[For any new features, include brief usage instructions]

## Upgrade Notes

[Any breaking changes or things users need to know when upgrading]
```

Write this out to a markdown file.

### Step 6: Publish the Release

1. Go to https://github.com/bitsofchris/openaugi-obsidian-plugin/releases
2. Find the draft release created by the workflow
3. Click **Edit**
4. Paste the generated release notes
5. Click **Publish release**

### Step 7: Update Documentation

Ensure all docs reflect the new release:

- [ ] `docs/CODEBASE_MAP.md` - Architecture changes
- [ ] `CLAUDE.md` - Any new development guidelines
- [ ] `README.md` - User-facing documentation (if applicable)

## Quick Reference

```bash
# Full release flow (example for version 0.4.0)
npm run build
npm run typecheck

# Commit version bump
git add manifest.json package.json
git commit -m "Bump version to 0.4.0"
git push origin master

# Tag and push
git tag -a 0.4.0 -m "0.4.0"
git push origin 0.4.0

# Then: Edit draft release on GitHub and publish
```

## Troubleshooting

### Tag already exists
```bash
# Delete local tag
git tag -d X.Y.Z
# Delete remote tag (if pushed)
git push origin --delete X.Y.Z
```

### Wrong version tagged
1. Delete the incorrect tag (see above)
2. Fix the version in manifest.json/package.json
3. Commit and re-tag

### Workflow failed
1. Check the Actions tab for error details
2. Fix the issue
3. Delete the tag and re-push after fixing
