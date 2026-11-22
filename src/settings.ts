import { store } from './storage';

// Player settings that change how the game looks. Kept per device.

export type Backdrop = 'plain' | 'gym' | 'street' | 'notebook';

export interface Settings {
  backdrop: Backdrop;
  /** A scoreboard hanging over the court that shows the live score. Works with any backdrop. */
  scoreboard: boolean;
}

export const BACKDROPS: { id: Backdrop; name: string }[] = [
  { id: 'plain', name: 'Plain' },
  { id: 'gym', name: 'Gym' },
  { id: 'street', name: 'Street' },
  { id: 'notebook', name: 'Notebook' },
];

let current: Settings = { backdrop: 'plain', scoreboard: false, ...store.get<Partial<Settings>>('settings', {}) };
const listeners: ((s: Settings) => void)[] = [];

export const settings = (): Settings => current;

export function updateSettings(patch: Partial<Settings>): void {
  current = { ...current, ...patch };
  store.set('settings', current);
  for (const f of listeners) f(current);
}

export function onSettings(fn: (s: Settings) => void): void {
  listeners.push(fn);
}
