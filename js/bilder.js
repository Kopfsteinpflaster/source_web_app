// Kachelbilder als Inline-SVG (112 × 112), Strichzeichnung im Laternenlicht.

const KNOCHEN = "#ddd5c4";
const NATRIUM = "#e09a3e";
const GRUENSPAN = "#6f9c92";
const ROST = "#a8432f";
const FLAECHE = "#2a3038";

const licht = (id) => `
  <defs>
    <radialGradient id="${id}" cx="50%" cy="48%" r="45%">
      <stop offset="0" stop-color="${NATRIUM}" stop-opacity="0.28"/>
      <stop offset="1" stop-color="${NATRIUM}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="112" height="112" rx="4" fill="url(#${id})"/>`;

// Aufgeschlagener Foliant, rechts ein Auge mit geschlitzter Pupille
export const lexikon = `
<svg class="kachel-bild" viewBox="0 0 112 112" aria-hidden="true">
  ${licht("licht-lexikon")}
  <g fill="none" stroke="${KNOCHEN}" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round">
    <path d="M12 90 Q34 83 56 93 Q78 83 100 90" stroke-opacity="0.6"/>
    <path d="M14 34 Q36 27 56 36 L56 88 Q36 80 14 86 Z" fill="${FLAECHE}"/>
    <path d="M56 36 Q76 27 98 34 L98 86 Q76 80 56 88 Z" fill="${FLAECHE}"/>
    <g stroke-opacity="0.45" stroke-width="1.2">
      <path d="M21 43 Q34 39 49 44"/>
      <path d="M21 50 Q34 46 49 51"/>
      <path d="M21 57 Q34 53 49 58"/>
      <path d="M21 64 Q30 61 40 63"/>
      <path d="M21 71 Q34 67 49 72"/>
    </g>
  </g>
  <path d="M71 31 L71 100 L74 95 L77 100 L77 30" fill="${ROST}"/>
  <path d="M60 60 Q77 46 94 60 Q77 74 60 60 Z" fill="none" stroke="${NATRIUM}" stroke-width="1.6"/>
  <ellipse cx="77" cy="60" rx="2.2" ry="7" fill="${NATRIUM}"/>
  <g stroke="${NATRIUM}" stroke-width="1.2" stroke-linecap="round" opacity="0.7">
    <path d="M77 44 L77 40"/><path d="M66 47 L64 44"/><path d="M88 47 L90 44"/>
  </g>
</svg>`;

// Röhrenmonitor mit Eingabezeile und blinkendem Cursor
export const terminal = `
<svg class="kachel-bild" viewBox="0 0 112 112" aria-hidden="true">
  ${licht("licht-terminal")}
  <defs>
    <pattern id="zeilen" width="4" height="3" patternUnits="userSpaceOnUse">
      <rect width="4" height="1" fill="#000" opacity="0.35"/>
    </pattern>
  </defs>
  <path d="M46 84 L41 97 L71 97 L66 84" fill="${FLAECHE}" stroke="${KNOCHEN}" stroke-width="1.4" stroke-linejoin="round"/>
  <rect x="12" y="20" width="88" height="66" rx="9" fill="${FLAECHE}" stroke="${KNOCHEN}" stroke-width="1.4"/>
  <rect x="20" y="28" width="72" height="48" rx="5" fill="#0f1a18" stroke="${GRUENSPAN}" stroke-width="1"/>
  <g font-family="IBM Plex Mono, monospace" font-size="7.5" fill="${GRUENSPAN}">
    <text x="25" y="40">&gt; ping jwd</text>
    <text x="25" y="50" opacity="0.7">..fornax 7 3 1</text>
    <text x="25" y="62">&gt;</text>
  </g>
  <rect class="cursor" x="32" y="56" width="5" height="7.5" fill="${NATRIUM}"/>
  <rect x="20" y="28" width="72" height="48" rx="5" fill="url(#zeilen)"/>
  <circle cx="88" cy="81" r="1.6" fill="${NATRIUM}"/>
</svg>`;

// Münzseiten (100 × 100), eingeprägt in das Gold. Der Hintergrund kommt aus dem CSS.
const PRAEGUNG = "#5b3a12";

// Glück: achtstrahlige Sonne im Perlkranz
export const glueck = `
<svg class="muenz-bild" viewBox="0 0 100 100" aria-hidden="true">
  <circle cx="50" cy="50" r="44" fill="none" stroke="${PRAEGUNG}" stroke-width="1.2" stroke-dasharray="0.1 4.2" stroke-linecap="round" stroke-opacity="0.8"/>
  <g fill="none" stroke="${PRAEGUNG}" stroke-width="1.6" stroke-linejoin="round" stroke-opacity="0.85" transform="translate(50 44) scale(0.72) translate(-50 -50)">
    <path d="M50 18 L55 40 L72 28 L60 45 L82 50 L60 55 L72 72 L55 60 L50 82 L45 60 L28 72 L40 55 L18 50 L40 45 L28 28 L45 40 Z"/>
    <circle cx="50" cy="50" r="7"/>
  </g>
</svg>`;

// Pech: Auge mit geschlitzter Pupille, quer durch die Münze ein Riss
export const pech = `
<svg class="muenz-bild" viewBox="0 0 100 100" aria-hidden="true">
  <circle cx="50" cy="50" r="44" fill="none" stroke="${PRAEGUNG}" stroke-width="1.2" stroke-dasharray="0.1 4.2" stroke-linecap="round" stroke-opacity="0.8"/>
  <g transform="translate(0 -5)">
  <g fill="none" stroke="${PRAEGUNG}" stroke-width="1.6" stroke-linecap="round" stroke-opacity="0.85">
    <path d="M22 50 Q50 26 78 50 Q50 74 22 50 Z"/>
    <path d="M50 30 L50 24"/><path d="M36 34 L33 29"/><path d="M64 34 L67 29"/>
  </g>
  <ellipse cx="50" cy="50" rx="3" ry="11" fill="${PRAEGUNG}" fill-opacity="0.85"/>
  </g>
  <polyline points="70,8 64,24 69,31 58,44 61,50" fill="none" stroke="#1b1206" stroke-width="1.3" stroke-linejoin="round" stroke-opacity="0.7"/>
</svg>`;

// Gefaltete Zeitung mit unscharfem Foto: eine Gestalt unter der Laterne
export const news = `
<svg class="kachel-bild" viewBox="0 0 112 112" aria-hidden="true">
  ${licht("licht-news")}
  <g transform="rotate(-6 56 58)">
    <path d="M18 24 L94 24 L94 94 L18 94 Z" fill="${FLAECHE}" stroke="${KNOCHEN}" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M56 24 L56 94" stroke="${KNOCHEN}" stroke-opacity="0.25" stroke-width="1"/>
    <path d="M24 32 L88 32" stroke="${KNOCHEN}" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M24 38 L88 38" stroke="${KNOCHEN}" stroke-opacity="0.4" stroke-width="0.8"/>
    <path d="M24 45 L76 45" stroke="${NATRIUM}" stroke-width="2.4" stroke-linecap="round"/>
    <rect x="24" y="52" width="30" height="34" fill="#141820" stroke="${KNOCHEN}" stroke-opacity="0.5" stroke-width="0.8"/>
    <path d="M30 86 L30 58 Q30 55 34 55 L37 55" fill="none" stroke="${KNOCHEN}" stroke-opacity="0.6" stroke-width="1"/>
    <circle cx="38" cy="57" r="5" fill="${NATRIUM}" opacity="0.35"/>
    <path d="M43 86 L43 74 Q43 68 47 68 Q51 68 51 74 L51 86 Z" fill="#0a0c10"/>
    <circle cx="45.6" cy="71.5" r="0.9" fill="${NATRIUM}"/>
    <circle cx="48.6" cy="71.5" r="0.9" fill="${NATRIUM}"/>
    <g stroke="${KNOCHEN}" stroke-opacity="0.45" stroke-width="1" stroke-linecap="round">
      <path d="M60 54 L88 54"/><path d="M60 59 L88 59"/><path d="M60 64 L84 64"/>
      <path d="M60 69 L88 69"/><path d="M60 74 L88 74"/><path d="M60 79 L80 79"/>
      <path d="M60 84 L88 84"/>
    </g>
  </g>
</svg>`;
