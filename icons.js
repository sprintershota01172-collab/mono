export const PATHS = {
  bird: '<path d="M4 14c0-5 3-8 8-8 1 0 2 .4 3 1l4-1-1 4c2 5-2 10-7 10-4 0-7-2-7-6Z"/><path d="M10 11c-2 0-3 2-3 4m5 5-1 2m4-3 1 3m3-12 3 1-3 1"/><circle cx="15.5" cy="9" r=".6" fill="currentColor"/>',
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
  history: '<path d="M5 4h14v17l-3-2-4 2-4-2-3 2Z M9 8h6M9 12h6M9 16h3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  pie: '<path d="M10 3a9 9 0 1 0 11 11H10Z"/><path d="M14 3v7h7a9 9 0 0 0-7-7Z"/>',
  suitcase:
    '<rect x="3" y="7" width="18" height="14" rx="3"/><path d="M8 7V4h8v3M8 7v14M16 7v14"/>',
  settings:
    '<path d="m9 3-.7 2.6-2.5 1L3.5 6l-2 3.5 2 1.9v2.7l-2 1.9 2 3.5 2.3-.6 2.5 1L9 22h4l.7-2.1 2.5-1 2.3.6 2-3.5-2-1.9v-2.7l2-1.9-2-3.5-2.3.6-2.5-1L13 3Z" transform="translate(1 -1) scale(.95)"/><circle cx="12" cy="11" r="3"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  back: '<path d="m14 5-7 7 7 7"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  utensils:
    '<path d="M5 3v7m4-7v7M3 3v5a4 4 0 0 0 8 0V3M7 12v9M19 21V3c-4 2-4 8 0 9"/>',
  basket: '<path d="m3 9 2 11h14l2-11ZM7 9l3-6m7 6-3-6M9 13v3m6-3v3"/>',
  train:
    '<rect x="5" y="3" width="14" height="16" rx="4"/><path d="M5 10h14M9 6h6M8 19l-2 3m10-3 2 3"/><circle cx="9" cy="15" r=".7"/><circle cx="15" cy="15" r=".7"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  phone:
    '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 5h4m-3 14h2"/>',
  music:
    '<path d="M9 18V5l11-2v13M9 9l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2.5"/><ellipse cx="17" cy="16" rx="3" ry="2.5"/>',
  sparkles:
    '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 2v4m-2-2h4"/>',
  shirt: '<path d="m8 3-6 4 3 5 3-2v11h8V10l3 2 3-5-6-4c0 4-8 4-8 0Z"/>',
  heart:
    '<path d="M12 21 3 12C-3 5 7-2 12 6c5-8 15-1 9 6Z" transform="translate(2 2) scale(.83)"/>',
  book: '<path d="M12 5C9 3 5 3 2 4v15c4-1 7 0 10 2 3-2 6-3 10-2V4c-3-1-7-1-10 1Zm0 0v16"/>',
  gift: '<path d="M3 9h18v4H3ZM5 13v8h14v-8M12 9v12"/><path d="M12 9c-12 0-6-12 0 0Zm0 0c12 0 6-12 0 0Z"/>',
  leaf: '<path d="M20 3C9 2 2 8 5 16c8 4 16-3 15-13ZM4 21 15 10"/>',
  dots: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  wallet:
    '<path d="M20 7H5a2 2 0 0 1 0-4h13v4M3 5v14a2 2 0 0 0 2 2h15V7M20 11h-6v5h6"/><circle cx="16" cy="13.5" r=".6"/>',
  arrow: '<path d="M12 4v16m-6-6 6 6 6-6"/>',
  up: '<path d="M12 20V4m-6 6 6-6 6 6"/>',
  trash: '<path d="M3 6h18M8 6V3h8v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  edit: '<path d="m4 16-1 5 5-1L21 7l-4-4ZM14 6l4 4"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 2v6m10-6v6M3 11h18M7 15h2m3 0h2m3 0h1M7 18h2m3 0h2"/>',
  moon: '<path d="M20 15A9 9 0 0 1 9 3a9 9 0 1 0 11 12Z"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  cloud:
    '<path d="M6 18a5 5 0 0 1 0-10 7 7 0 0 1 13-1 5.5 5.5 0 0 1 0 11M9 15l2 2 5-5"/>',
  shield: '<path d="M12 2 3 6v6c0 6 9 10 9 10s9-4 9-10V6ZM8 12l3 3 5-6"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  pin: '<path d="M19 9c0 6-7 13-7 13S5 15 5 9a7 7 0 1 1 14 0Z"/><circle cx="12" cy="9" r="2"/>',
};
export const ICON_CHOICES = [
  "utensils",
  "basket",
  "train",
  "home",
  "sun",
  "phone",
  "music",
  "sparkles",
  "shirt",
  "heart",
  "book",
  "gift",
  "leaf",
  "wallet",
  "suitcase",
  "pin",
  "bird",
  "dots",
];
export function icon(name, cls = "") {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name] || PATHS.dots}</svg>`;
}
