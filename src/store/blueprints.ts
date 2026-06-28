import { store, setStore } from './core';
import { BLUEPRINTS, type Blueprint } from '../lib/blueprints';

/**
 * Studio Blueprint CRUD. Built-in blueprints ship in the binary; custom
 * blueprints are user-authored and persisted with app state (see autosave.ts /
 * persistence.ts), so each client engagement can compound into reusable assets.
 */

/** Built-in blueprints followed by the user's custom ones. */
export function allBlueprints(): Blueprint[] {
  return [...BLUEPRINTS, ...store.customBlueprints];
}

export function saveCustomBlueprint(bp: Blueprint): void {
  const next: Blueprint = { ...bp, isCustom: true };
  const idx = store.customBlueprints.findIndex((b) => b.id === next.id);
  if (idx >= 0) {
    setStore('customBlueprints', idx, next);
  } else {
    setStore('customBlueprints', store.customBlueprints.length, next);
  }
}

export function deleteCustomBlueprint(id: string): void {
  setStore(
    'customBlueprints',
    store.customBlueprints.filter((b) => b.id !== id),
  );
}

export function setDefaultStack(id: string): void {
  setStore('defaultStackId', id);
}

/** Clone any blueprint (built-in or custom) into a new editable custom one. */
export function duplicateBlueprint(bp: Blueprint): Blueprint {
  return {
    ...bp,
    id: `custom-${crypto.randomUUID().slice(0, 8)}`,
    name: `${bp.name} (copy)`,
    isCustom: true,
  };
}
