// Lightweight original vector compositions, with no network dependency.
export function illustration(kind='nest') {
 const drawings={
  nest:'<rect x="22" y="29" width="142" height="82" rx="16" fill="currentColor" opacity=".09" transform="rotate(-12 93 70)"/><rect x="35" y="18" width="142" height="82" rx="16" fill="currentColor" opacity=".15"/><rect x="49" y="35" width="27" height="19" rx="5" fill="currentColor" opacity=".7"/><path d="M51 80h40m49 0h18" stroke="currentColor" stroke-width="4"/><circle cx="149" cy="45" r="13" fill="currentColor" opacity=".35"/><circle cx="136" cy="45" r="13" fill="currentColor" opacity=".25"/>',
  grow:'<rect x="31" y="76" width="28" height="30" rx="6" fill="currentColor" opacity=".2"/><rect x="70" y="52" width="28" height="54" rx="6" fill="currentColor" opacity=".4"/><rect x="109" y="22" width="28" height="84" rx="6" fill="currentColor" opacity=".75"/><path d="m27 52 47-27 24 5 48-21m-17 0h18v18" stroke="currentColor" stroke-width="3"/>',
  tea:'<circle cx="91" cy="62" r="39" stroke="currentColor" stroke-width="17" opacity=".12"/><path d="M91 23a39 39 0 0 1 39 39" stroke="currentColor" stroke-width="17"/><path d="M91 62h59M91 62V45" stroke="currentColor" stroke-width="3"/><circle cx="158" cy="92" r="13" fill="currentColor" opacity=".2"/>',
  journey:'<rect x="38" y="40" width="113" height="65" rx="13" fill="currentColor" opacity=".16"/><path d="M73 40V25h43v15M62 41v64m65-64v64" stroke="currentColor" stroke-width="3"/><path d="m139 21 33-7-15 23-5-11Z" fill="currentColor" opacity=".8"/>'
 };
 return `<svg class="editorial-art" viewBox="0 0 200 125" fill="none" aria-hidden="true" stroke-linecap="round" stroke-linejoin="round">${drawings[kind]||drawings.nest}</svg>`;
}
