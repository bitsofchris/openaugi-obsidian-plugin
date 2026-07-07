import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Guard test for the release contract. Obsidian resolves the "latest version"
// from manifest.json at the repo root, then downloads the GitHub release whose
// tag equals that version. If manifest.json / package.json / versions.json ever
// disagree, releases go out inconsistent — which is how the 0.6.0 release shipped
// with a stale package.json and a MISSING versions.json, and (plausibly) how the
// plugin got auto-removed from the community store. This test makes that drift a
// red build instead of a production incident. See docs/PUBLISHING.md.

const root = path.resolve(__dirname, '..');
const readJson = (rel: string) =>
  JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));

const SEMVER = /^\d+\.\d+\.\d+$/; // x.y.z only — no "v" prefix, no pre-release suffix

describe('version consistency (release contract)', () => {
  const manifest = readJson('manifest.json');
  const pkg = readJson('package.json');
  const versions = readJson('versions.json');

  it('manifest.json version is valid semver (x.y.z, no v prefix)', () => {
    expect(manifest.version).toMatch(SEMVER);
  });

  it('package.json version matches manifest.json', () => {
    expect(pkg.version).toBe(manifest.version);
  });

  it('versions.json contains the current manifest version', () => {
    expect(Object.keys(versions)).toContain(manifest.version);
  });

  it('versions.json maps the current version to manifest.minAppVersion', () => {
    expect(versions[manifest.version]).toBe(manifest.minAppVersion);
  });

  it('every versions.json key is valid semver', () => {
    for (const v of Object.keys(versions)) {
      expect(v, `versions.json key "${v}"`).toMatch(SEMVER);
    }
  });
});
