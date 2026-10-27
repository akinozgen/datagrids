// 16px grid, 1.5 stroke; colour comes from currentColor (forced-colors safe).
const svg = (body: string, cls = "") =>
  `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"${cls ? ` class="${cls}"` : ""}>${body}</svg>`;

export const icons = {
  search: svg('<circle cx="7" cy="7" r="4.25"/><path d="m10.25 10.25 3 3"/>'),
  x: svg('<path d="m4.5 4.5 7 7m0-7-7 7"/>'),
  sort: svg('<path class="dg-up" d="m5 6.5 3-3 3 3"/><path class="dg-down" d="m5 9.5 3 3 3-3"/>', "dg-sort-icon"),
  first: svg('<path d="m8.5 4.5-3.5 3.5 3.5 3.5M12 4.5 8.5 8l3.5 3.5"/>'),
  prev: svg('<path d="M9.5 4.5 6 8l3.5 3.5"/>'),
  next: svg('<path d="M6.5 4.5 10 8l-3.5 3.5"/>'),
  last: svg('<path d="m7.5 4.5 3.5 3.5-3.5 3.5M4 4.5 7.5 8 4 11.5"/>'),
  caret: svg('<path d="m4.5 6.5 3.5 3.5 3.5-3.5"/>', "dg-btn-caret"),
  columns: svg('<rect x="2.5" y="3" width="11" height="10" rx="1.5"/><path d="M6.25 3v10M9.75 3v10"/>'),
  refresh: svg('<path d="M13 8a5 5 0 1 1-1.46-3.54"/><path d="M13 3v2.5h-2.5"/>'),
  download: svg('<path d="M8 2.5v7.5m-3-3 3 3 3-3M3 12.5h10"/>'),
  more: svg('<circle cx="3.75" cy="8" r=".9" fill="currentColor"/><circle cx="8" cy="8" r=".9" fill="currentColor"/><circle cx="12.25" cy="8" r=".9" fill="currentColor"/>'),
  check: svg('<path d="m3.5 8.5 3 3 6-7"/>', "dg-i-check"),
  minus: svg('<path d="M4 8h8"/>', "dg-i-minus"),
  info: svg('<circle cx="8" cy="8" r="5.75"/><path d="M8 7.25v3.5M8 5.1v.01"/>'),
  alert: svg('<path d="M8 2.75 14 13H2z"/><path d="M8 6.5v3M8 11.2v.01"/>'),
  inbox: svg('<path d="M2.5 9.5h3l1 1.5h3l1-1.5h3"/><path d="M2.5 9.5 4.25 3.5h7.5l1.75 6v3H2.5z"/>'),
  spinner: svg('<path d="M8 2.5A5.5 5.5 0 1 1 2.5 8" stroke-width="1.75"/>', "dg-spin"),
  filter: svg('<path d="M2.5 3.5h11L9.25 8.5v4L6.75 13.5v-5z"/>'),
  lock: svg('<rect x="3.5" y="7" width="9" height="6.5" rx="1.25"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/>'),
  play: svg('<path d="M5 3.5v9l7-4.5z"/>'),
  chevron: svg('<path d="M6.5 4.5 10 8l-3.5 3.5"/>', "dg-dir"),
  edit: svg('<path d="M10.5 3 13 5.5 6 12.5H3.5V10z"/>'),
  trash: svg('<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.5 8.5h6l.5-8.5"/>'),
  send: svg('<path d="m2.5 8 11-5-4 11-2-4.5z"/>', "dg-dir"),
  copy: svg('<rect x="5.5" y="5.5" width="7.5" height="7.5" rx="1.25"/><path d="M3 10.5V3h7.5"/>'),
  eye: svg('<path d="M1.75 8S4 3.5 8 3.5 14.25 8 14.25 8 12 12.5 8 12.5 1.75 8 1.75 8z"/><circle cx="8" cy="8" r="2"/>'),
  print: svg('<path d="M4.5 6V2.5h7V6M4.5 11.5h-2v-5h11v5h-2"/><path d="M4.5 9.5h7v4h-7z"/>'),
  up: svg('<path d="m4.5 9.5 3.5-3.5 3.5 3.5"/>'),
  down: svg('<path d="m4.5 6.5 3.5 3.5 3.5-3.5"/>'),
  grip: svg('<circle cx="6" cy="4" r=".8" fill="currentColor"/><circle cx="10" cy="4" r=".8" fill="currentColor"/><circle cx="6" cy="8" r=".8" fill="currentColor"/><circle cx="10" cy="8" r=".8" fill="currentColor"/><circle cx="6" cy="12" r=".8" fill="currentColor"/><circle cx="10" cy="12" r=".8" fill="currentColor"/>'),
} as const;

export type IconName = keyof typeof icons;
