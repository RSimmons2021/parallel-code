import { store, setStore } from './core';
import { STARTER_ASSETS, type AssetKind } from '../lib/registry-presets';

/**
 * Asset Registry — the studio's cross-client reuse flywheel. A studio-wide
 * (not per-project) library of versioned, reusable assets: system prompts,
 * prompts, guardrails, eval rubrics, tool specs, and snippets. Every asset
 * carries an immutable version history (diff + rollback) and a usage counter,
 * so the things that work compound across every engagement.
 */

export interface AssetVersion {
  version: number; // 1-based, monotonic
  body: string;
  ts: number;
  note?: string;
}

export interface Asset {
  id: string;
  kind: AssetKind;
  name: string;
  description: string;
  tags: string[];
  /** Current working body. Snapshotted into `versions` on save/commit. */
  body: string;
  versions: AssetVersion[];
  usageCount: number;
  createdAt: number;
  updatedAt: number;
}

const MAX_VERSIONS = 40;

function now(): number {
  return Date.now();
}

export function newAsset(kind: AssetKind = 'system'): Asset {
  const ts = now();
  return {
    id: crypto.randomUUID().slice(0, 8),
    kind,
    name: '',
    description: '',
    tags: [],
    body: '',
    versions: [],
    usageCount: 0,
    createdAt: ts,
    updatedAt: ts,
  };
}

export function getAsset(id: string): Asset | undefined {
  return store.assets.find((a) => a.id === id);
}

function patchAsset(id: string, patch: Partial<Asset>): void {
  setStore('assets', (a) => a.id === id, { ...patch, updatedAt: now() });
}

/** Insert a fully-formed asset (used for create + duplicate). Newest first. */
export function addAsset(asset: Asset): Asset {
  setStore('assets', (prev) => [asset, ...prev]);
  return asset;
}

export function createAsset(kind: AssetKind = 'system'): Asset {
  return addAsset(newAsset(kind));
}

export function updateAssetFields(
  id: string,
  patch: Partial<Pick<Asset, 'name' | 'description' | 'tags' | 'kind' | 'body'>>,
): void {
  patchAsset(id, patch);
}

export function deleteAsset(id: string): void {
  setStore('assets', (prev) => prev.filter((a) => a.id !== id));
}

export function duplicateAsset(id: string): Asset | undefined {
  const a = getAsset(id);
  if (!a) return undefined;
  const ts = now();
  return addAsset({
    ...a,
    id: crypto.randomUUID().slice(0, 8),
    name: `${a.name} copy`,
    versions: a.versions.map((v) => ({ ...v })),
    usageCount: 0,
    createdAt: ts,
    updatedAt: ts,
  });
}

export function latestAssetVersion(asset: Asset): AssetVersion | undefined {
  return asset.versions[asset.versions.length - 1];
}

/**
 * Snapshot the working body as a new immutable version if it differs from the
 * latest. Returns the version number the current body maps to.
 */
export function commitAssetVersion(id: string, note?: string): number {
  const asset = getAsset(id);
  if (!asset) return 0;
  const latest = latestAssetVersion(asset);
  if (latest && latest.body === asset.body) return latest.version;
  const version = (latest?.version ?? 0) + 1;
  const versions = [...asset.versions, { version, body: asset.body, ts: now(), note }].slice(
    -MAX_VERSIONS,
  );
  patchAsset(id, { versions });
  return version;
}

/** Restore a prior version into the working body. */
export function restoreAssetVersion(id: string, version: number): void {
  const asset = getAsset(id);
  const v = asset?.versions.find((p) => p.version === version);
  if (v) patchAsset(id, { body: v.body });
}

/** Record a use of the asset — the flywheel metric (insert / copy / send). */
export function markAssetUsed(id: string): void {
  const asset = getAsset(id);
  if (!asset) return;
  patchAsset(id, { usageCount: asset.usageCount + 1 });
}

/** Capture text from elsewhere in the studio into a new registry asset. */
export function captureAsset(opts: {
  kind: AssetKind;
  name: string;
  body: string;
  description?: string;
  tags?: string[];
}): Asset {
  const asset = newAsset(opts.kind);
  asset.name = opts.name;
  asset.body = opts.body;
  asset.description = opts.description ?? '';
  asset.tags = opts.tags ?? [];
  asset.versions = [{ version: 1, body: opts.body, ts: now(), note: 'captured' }];
  return addAsset(asset);
}

/** Text search across name / description / tags / body, optionally by kind. */
export function searchAssets(query: string, kind: AssetKind | 'all'): Asset[] {
  const q = query.trim().toLowerCase();
  return store.assets
    .filter((a) => (kind === 'all' ? true : a.kind === kind))
    .filter((a) => {
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.body.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
}

/**
 * Seed the starter library once. Guarded by a persisted flag so a user who
 * deletes the starters never has them reappear.
 */
export function seedRegistryIfNeeded(): void {
  if (store.registrySeeded) return;
  const ts = now();
  const seeded: Asset[] = STARTER_ASSETS.map((s, i) => ({
    id: crypto.randomUUID().slice(0, 8),
    kind: s.kind,
    name: s.name,
    description: s.description,
    tags: s.tags,
    body: s.body,
    versions: [{ version: 1, body: s.body, ts, note: 'starter' }],
    usageCount: 0,
    createdAt: ts + i,
    updatedAt: ts + i,
  }));
  setStore('assets', (prev) => [...seeded, ...prev]);
  setStore('registrySeeded', true);
}
