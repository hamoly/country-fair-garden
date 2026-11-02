// Small inline SVG illustrations used by the cards, order tag and almanac.
// They replace the emoji from the console version.

import type { NewsIcon } from '../game/engine';

const svg = (body: string, viewBox = '0 0 32 32') =>
  `<svg viewBox="${viewBox}" aria-hidden="true" focusable="false">${body}</svg>`;

export const ICONS: Record<NewsIcon, string> = {
  carrot: svg(
    `<path d="M21 11c-2.6-2.6-6.6-2.2-8.6.6L4.6 25.3c-.6.9.3 1.8 1.2 1.2l13.7-7.8c2.8-2 3.3-5.9 1.5-7.7z" fill="#ec7a2c"/>
     <path d="M11 17.4l2.8 1.4M8.6 21l2.4 1.2M14.3 13.6l2.6 1.6" stroke="#c45f1c" stroke-width="1.3" stroke-linecap="round"/>
     <path d="M20.6 11.4c.5-3.2 2.4-5.6 5.4-6.8M21.4 12.6c2.6-1.3 5.2-1.2 7.2.2M19.8 11c-.3-2.8.6-5.2 2.6-7" stroke="#4f9a3a" stroke-width="2.2" stroke-linecap="round" fill="none"/>`,
  ),
  tomato: svg(
    `<circle cx="16" cy="18.5" r="10" fill="#d8402e"/>
     <ellipse cx="11.6" cy="15" rx="2.6" ry="1.6" fill="#f08a72" opacity=".75"/>
     <path d="M16 13.4l-2.6 2.4.4-3.4-3.6.6 2.8-2.4-2.6-1.8 3.6-.2.6-3.2 1.4 3 3-1.8-1 3.2 3.4.4-3.2 1.8 2.2 2.6-3.4-1.2z" fill="#4f9a3a"/>`,
  ),
  pumpkin: svg(
    `<path d="M16.4 10c-.5-2.4.6-4.6 2.8-5.8" stroke="#6b6f2e" stroke-width="2.4" stroke-linecap="round" fill="none"/>
     <ellipse cx="9.6" cy="19.5" rx="6.4" ry="8.2" fill="#d9761f"/>
     <ellipse cx="22.4" cy="19.5" rx="6.4" ry="8.2" fill="#d9761f"/>
     <ellipse cx="16" cy="19.5" rx="6.6" ry="9" fill="#eb8a2a"/>`,
  ),
  water: svg(
    `<path d="M16 3.5c4.6 6.1 8.2 10.5 8.2 15.2a8.2 8.2 0 0 1-16.4 0c0-4.7 3.6-9.1 8.2-15.2z" fill="#5aa9e0"/>
     <path d="M12.4 19.6a4.2 4.2 0 0 0 3.6 4.1" stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none" opacity=".85"/>`,
  ),
  rain: svg(
    `<path d="M9 19.5a5 5 0 0 1 .6-10A7 7 0 0 1 23 9a5.3 5.3 0 0 1 .5 10.5z" fill="#9fb4c8"/>
     <path d="M11 23l-1.5 4M16.5 23l-1.5 4M22 23l-1.5 4" stroke="#4f97d6" stroke-width="2.2" stroke-linecap="round"/>`,
  ),
  compost: svg(
    `<path d="M3.5 27c3-6.4 8-9.4 12.5-9.4s9.5 3 12.5 9.4z" fill="#6e4a22"/>
     <path d="M9.6 16c0-5.2 4.2-8.4 9.4-8.4-.2 5.2-3.8 9-9.4 8.4z" fill="#c98f3a"/>
     <path d="M9.6 16c2.6-2.6 5.2-4.2 8.4-5.8" stroke="#8a5a2b" stroke-width="1.2" fill="none"/>
     <path d="M18.6 19.4c1.6-4.2 5.2-5.8 8.8-5-1.4 3.8-4.6 5.8-8.8 5z" fill="#b5762e"/>`,
  ),
  summer: svg(
    `<circle cx="16" cy="16" r="6.4" fill="#f5b52f"/>
     <path d="M16 3v4M16 25v4M3 16h4M25 16h4M6.8 6.8l2.8 2.8M22.4 22.4l2.8 2.8M6.8 25.2l2.8-2.8M22.4 9.6l2.8-2.8" stroke="#f5b52f" stroke-width="2.4" stroke-linecap="round"/>`,
  ),
  stone: svg(
    `<path d="M4.5 22.5l4-9.5 8-4 8.5 5 3 8.5-6 4H11z" fill="#aaa79d"/>
     <path d="M8.5 13l5.5 5.4 11-4.4M14 18.4l-3 8" stroke="#85827a" stroke-width="1.4" fill="none"/>`,
  ),
  rabbit: svg(
    `<ellipse cx="14" cy="21.5" rx="8.6" ry="6.4" fill="#a88a6b"/>
     <circle cx="21.6" cy="15.4" r="4.6" fill="#a88a6b"/>
     <ellipse cx="19.8" cy="7" rx="1.7" ry="5" fill="#a88a6b" transform="rotate(-12 19.8 7)"/>
     <ellipse cx="23.6" cy="7.4" rx="1.7" ry="5" fill="#a88a6b" transform="rotate(14 23.6 7.4)"/>
     <circle cx="5.8" cy="20.4" r="2.3" fill="#eee2d2"/>
     <circle cx="23.2" cy="14.6" r="1" fill="#1d1510"/>`,
  ),
  grew: svg(
    `<path d="M16 28V15" stroke="#3b7c2b" stroke-width="2.4" stroke-linecap="round"/>
     <path d="M16 16.4c-1-5-5-7.6-10-7.1.4 5 4.4 8 10 7.1z" fill="#4f9a3a"/>
     <path d="M16 14.2c.8-5 4.6-8 10-8-.2 5.4-4.4 8.6-10 8z" fill="#6fb24a"/>`,
  ),
};

/** A pleated prize rosette. Blue for first premium, cream for a participant ribbon. */
export function rosette(kind: 'first' | 'participant'): string {
  const [ring, tailA, tailB, label, small] =
    kind === 'first'
      ? ['#2f66be', '#1f4c96', '#2a5db0', 'FIRST', 'PREMIUM']
      : ['#d9cfbd', '#b9ad97', '#c9bea9', 'THANK', 'YOU'];
  const pleats = Array.from({ length: 28 }, (_, i) => {
    const a = (i / 28) * Math.PI * 2;
    return `<circle cx="${(60 + Math.cos(a) * 44).toFixed(1)}" cy="${(58 + Math.sin(a) * 44).toFixed(1)}" r="9" fill="${ring}"/>`;
  }).join('');
  return svg(
    `<path d="M44 82 L28 152 L44 141 L54 156 L61 88z" fill="${tailA}"/>
     <path d="M76 82 L92 152 L76 141 L66 156 L59 88z" fill="${tailB}"/>
     ${pleats}
     <circle cx="60" cy="58" r="44" fill="${ring}"/>
     <circle cx="60" cy="58" r="31" fill="#f8f0de" stroke="#d6b55a" stroke-width="3"/>
     <text x="60" y="60" text-anchor="middle" font-family="'Alfa Slab One', Georgia, serif" font-size="15" fill="${tailA}">${label}</text>
     <text x="60" y="75" text-anchor="middle" font-family="Figtree, system-ui, sans-serif" font-weight="700" font-size="8.5" letter-spacing="1.6" fill="#6b5a3e">${small}</text>`,
    '0 0 120 160',
  );
}
