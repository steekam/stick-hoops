// Stick Hoops brand: a pencil-sketch mark (the ball dropping through the ring) and the
// wordmark. Everything uses currentColor, so it follows the light and dark themes.
// The same drawings are exported as standalone files in public/brand/.

/** The mark: the ball dropping through the ring. One idea, bold enough to read at favicon size. */
export const MARK = `<svg class="mark" viewBox="0 0 64 64" role="img" aria-label="Stick Hoops" focusable="false">
  <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
    <!-- motion: two pencil dashes trailing the ball -->
    <path d="M10 12 L17 16 M8 20 L14 22" stroke-width="2.6"/>
    <!-- back of the rim, behind the ball -->
    <path d="M10 40 Q32 31 54 40" stroke-width="3"/>
    <!-- the ball, shaded on the lower right -->
    <circle cx="32" cy="27" r="12" stroke-width="3.6" style="fill:var(--paper,#fbfbf8)"/>
    <path d="M20.5 27 H43.5 M32 15 V39 M24 18.5 Q29.5 27 24 35.5 M40 18.5 Q34.5 27 40 35.5" stroke-width="1.8"/>
    <path d="M36 37.5 L42.5 31 M31 38.8 L43.8 26 M40.5 24.5 L43.6 21.4" stroke-width="1.4" opacity=".7"/>
    <!-- net -->
    <path d="M12 43 L19 58 M22 45.5 L25 59 M32 46 L32 60 M42 45.5 L39 59 M52 43 L45 58 M19 58 Q32 62.5 45 58" stroke-width="2"/>
    <!-- front of the rim, over the ball, so it reads as dropping in -->
    <path d="M10 40 Q32 51 54 40" stroke-width="4.4"/>
  </g>
</svg>`;

/** Small mark for the favicon: just the ball dropping into the ring. */
export const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g fill="none" stroke="#121211" stroke-linecap="round" stroke-linejoin="round"><path d="M10 40 Q32 31 54 40" stroke-width="3.4"/><circle cx="32" cy="27" r="12" stroke-width="4.4" fill="#fbfbf8"/><path d="M20.5 27 H43.5 M32 15 V39" stroke-width="2.4"/><path d="M12 43 L19 58 M32 46 L32 60 M52 43 L45 58 M19 58 Q32 62.5 45 58" stroke-width="2.8"/><path d="M10 40 Q32 51 54 40" stroke-width="5.2"/></g></svg>`;
