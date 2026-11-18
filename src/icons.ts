const paths: Record<string, string> = {
  orbit:
    '<circle cx="12" cy="12" r="2.5"/><ellipse cx="12" cy="12" rx="10" ry="5" transform="rotate(-32 12 12)"/><path d="M5.2 8.4C5.1 5.8 6 4 7.8 3.4c3.6-1.2 8.5 3.2 10.4 8.6 1.8 5.2 1.1 8.1-1 8.7"/>',
  compass:
    '<circle cx="12" cy="12" r="9"/><path d="m15.7 8.3-2.1 5.3-5.3 2.1 2.1-5.3 5.3-2.1Z"/>',
  collection:
    '<rect x="3.5" y="3.5" width="6" height="6" rx="1.2"/><rect x="14.5" y="3.5" width="6" height="6" rx="1.2"/><rect x="3.5" y="14.5" width="6" height="6" rx="1.2"/><rect x="14.5" y="14.5" width="6" height="6" rx="1.2"/>',
  book: '<path d="M3 5.5c3-1.2 6-1.1 9 1.2 3-2.3 6-2.4 9-1.2v13c-3-1.2-6-1.1-9 1.2-3-2.3-6-2.4-9-1.2v-13Z"/><path d="M12 6.7v13"/>',
  volume:
    '<path d="M3 9h4l5-4v14l-5-4H3zM16 8a6 6 0 0 1 0 8M19 5a10 10 0 0 1 0 14"/>',
  mute: '<path d="M3 9h4l5-4v14l-5-4H3zM16 9l5 6m0-6-5 6"/>',
  expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  shrink: '<path d="M3 8h5V3m13 5h-5V3M8 21v-5H3m13 5v-5h5"/>',
  sliders:
    '<path d="M3 6h5m4 0h9M3 12h11m4 0h3M3 18h2m4 0h12"/><circle cx="10" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="7" cy="18" r="2"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  up: '<path d="m6 15 6-6 6 6"/>',
  right: '<path d="m9 6 6 6-6 6"/>',
  left: '<path d="m15 6-6 6 6 6"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
  top: '<rect x="4" y="5" width="16" height="14" rx="2"/><ellipse cx="12" cy="12" rx="4.6" ry="3.4"/><circle cx="12" cy="12" r=".6"/>',
  rotate: '<path d="M20.2 8a8.4 8.4 0 1 0 .2 7M20.4 3.4V8h-4.6"/>',
  label: '<path d="M3 4h8l10 10-7 7L3 10V4Z"/><circle cx="7.6" cy="8" r="1"/>',
  reset: '<path d="M3 5v5h5M3.5 9.4a8.3 8.3 0 1 1-.1 5.7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  focus:
    '<path d="M8 3H4v4m12-4h4v4M4 17v4h4m12-4v4h-4"/><circle cx="12" cy="12" r="3.4"/>',
  grid: '<path d="m12 3 10 9-10 9L2 12l10-9Zm-5 4.5 10 9m-10 0 10-9M2 12h20"/>',
  camera:
    '<path d="M3 7h4l1.5-2.5h7L17 7h4v12H3V7Z"/><circle cx="12" cy="13" r="3.8"/>',
  mouse:
    '<rect x="6" y="2.5" width="12" height="19" rx="6"/><path d="M12 3v6M7 10h10"/>',
  drag: '<path d="m3 12 3-3m-3 3 3 3m15-3-3-3m3 3-3 3M3 12h18"/>',
  zoom: '<circle cx="10" cy="10" r="6.4"/><path d="m15 15 5 5M7.4 10h5.2M10 7.4v5.2"/>',
  crosshair:
    '<circle cx="12" cy="12" r="6.8"/><path d="M12 2v6m0 8v6M2 12h6m8 0h6"/>',
  "arrow-up-right": '<path d="M6 18 18 6M7 6h11v11"/>',
  "arrow-right": '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  tower:
    '<path d="m6.5 21 5.5-15L17.5 21M8.3 16h7.4M7.5 3a6 6 0 0 0-2.3 5m11.3-5a6 6 0 0 1 2.3 5M4.5 1a10 10 0 0 0-3.2 7M19.5 1a10 10 0 0 1 3.2 7"/><circle cx="12" cy="5" r="1.2"/>',
  pulse: '<path d="M2 12h4l3-7 5 14 3-7h5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  diameter: '<circle cx="12" cy="12" r="8.5"/><path d="m5.5 18.5 13-13"/>',
  distance: '<path d="M4 18 17 5M11 5h6v6M4 12v6h6"/>',
  spark:
    '<path d="m12 2 2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2L12 2Z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9a2.6 2.6 0 0 1 5 .7c0 1.6-2.6 2-2.6 4M12 17h.01"/>',
  keyboard:
    '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h.1m3.9 0h.1m3.9 0h.1m3.9 0h.1M6 12h.1m3.9 0h.1m3.9 0h.1m3.9 0h.1M7 15h10"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.5 1.5m11.2 11.2 1.5 1.5M4.9 19.1l1.5-1.5m11.2-11.2 1.5-1.5"/>',
};
export const icon = (name: string, size = 18) =>
  `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ""}</svg>`;
export const brandMark = `<svg class="brand-mark" width="43" height="43" viewBox="0 0 48 48" fill="none" aria-hidden="true"><g transform="rotate(-33 24 24)" stroke="currentColor"><ellipse cx="24" cy="24" rx="21" ry="8.6" stroke-width="1.6"/><ellipse cx="24" cy="24" rx="16.4" ry="14.2" stroke-width="1.5" stroke-dasharray="83 18"/><ellipse cx="24" cy="24" rx="10.9" ry="10.6" stroke-width="1.5" stroke-dasharray="59 10"/></g><circle cx="24" cy="24" r="4" fill="currentColor"/><circle cx="42.1" cy="12.3" r="2.5" fill="currentColor" stroke="#080e16" stroke-width="1.4"/></svg>`;
