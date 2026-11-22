// Hand-drawn icons, 24×24, stroked in currentColor. A shared SVG filter (#pencil, defined in
// index.html) roughens the edges slightly so they match the pencil court.

const PATHS: Record<string, string> = {
  // modes
  practice: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 11.5v1"/>',
  levels: '<path d="M3 20.5h5.2v-5.1h5v-5.2h5V5.1H21"/><path d="M4 18l2-2M9 13.3l2-2M14 8.2l2-2" stroke-width="1" opacity=".55"/>',
  time: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9.2M10 3h4M12 3v3M18.4 7.1l1.6-1.6"/>',
  streak: '<path d="M12 21.2c-3.9 0-6.4-2.7-6.4-6.2 0-3.9 3.6-5.6 3.8-9.8 2.1 1.6 3.4 3.7 3.4 6 1-1 1.7-2.1 1.9-3.6 2.1 2 3.4 4.6 3.4 7.4 0 3.6-2.4 6.2-6.1 6.2z"/><path d="M12 21c-1.7 0-2.7-1.2-2.7-2.7 0-1.8 1.6-2.5 1.8-4.2 1.5 1 2.7 2.4 2.7 4 0 1.7-.7 2.9-1.8 2.9z" stroke-width="1.3"/>',
  horse: '<rect x="2.8" y="6.5" width="8.4" height="11" rx=".6"/><rect x="12.8" y="6.5" width="8.4" height="11" rx=".6"/><path d="M5.3 9.5v5M8.7 9.5v5M5.3 12h3.4"/><circle cx="17" cy="12" r="2.4"/>',
  sabotage: '<path d="M13.4 2.5 5.2 13.4h6.1l-1.2 8.1 8.4-11.6h-6.1l1-7.4z"/>',
  // controls
  menu: '<path d="M4 7.2h16M4 12h16M4 16.8h16"/>',
  sound: '<path d="M4 9.2h3.8L13 5v14l-5.2-4.2H4z"/><path d="M16.2 9.2a4 4 0 0 1 0 5.6M18.8 6.6a7.6 7.6 0 0 1 0 10.8"/>',
  mute: '<path d="M4 9.2h3.8L13 5v14l-5.2-4.2H4z"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1.1 1-1.1 1.7v.8M12 17.3v.2"/>',
  tutorial: '<path d="M4.2 19.8l1-4.2L16 4.8l3.2 3.2L8.4 18.8z"/><path d="M14 6.8l3.2 3.2M5.2 15.6l3.2 3.2" stroke-width="1.3"/>',
};

export type IconName = keyof typeof PATHS;

export function icon(name: string, cls = 'ic'): string {
  const p = PATHS[name];
  if (!p) return '';
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
}
