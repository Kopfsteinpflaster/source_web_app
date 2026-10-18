// Knall-Zähler: 0 bis 5, gespeichert auf dem Gerät.
// Ab 3 wird die ganze Oberfläche unruhig. Bei 5 kommt der Absturz, danach geht es bei 3 weiter.

import { unterseite, lesen, schreiben } from "./hilfen.js";

const MAX = 5;
const NACH_ABSTURZ = 3;

let stand = lesen("knall", 0);
if (!Number.isInteger(stand) || stand < 0 || stand > MAX) stand = 0;

// Setzt den Stand am Wurzelelement, das CSS macht daraus die Unruhe
export function knallAnzeigen() {
  document.documentElement.dataset.knall = stand;
}

function setzen(n) {
  stand = Math.max(0, Math.min(MAX, n));
  schreiben("knall", stand);
  knallAnzeigen();
}

const zustand = (n) => (n >= MAX ? "absturz" : n >= 3 ? "instabil" : "stabil");

export const knall = () =>
  unterseite(
    "ot/knall",
    `<div class="knall">
      <div class="knall-leiste" aria-hidden="true">${"<span></span>".repeat(MAX)}</div>
      <p class="knall-zahl" aria-live="polite"></p>
      <div class="knall-knoepfe">
        <button class="knall-weniger" type="button">[ - abgebaut ]</button>
        <button class="knall-mehr" type="button">[ + kraft benutzt ]</button>
      </div>
      <div class="melden" role="status" hidden>
        <p><b>!</b> Du hattest einen Absturz. Melde dich nach der Session bei der Spielleitung.</p>
        <button type="button">[ erledigt ]</button>
      </div>
    </div>
    <div class="ot-text">
      <h2>Knall abbauen</h2>
      <p>Knall verschwindet nicht von alleine. Du wirst einen Knall los, wenn du eines davon tust:</p>
      <ul>
        <li>Einen intimen Moment erleben. (Ein tiefgreifendes und persönliches Gespräch reicht.)</li>
        <li>Etwas (oder irgendwen) zerstören.</li>
        <li>Exzessiver Konsum berauschender Substanzen. (Lotus und Goldener Wein zählen nicht, wenn sie für andere
          Spieleffekte eingenommen werden.)</li>
      </ul>
      <h2>Absturz</h2>
      <p>Bei 5 Knall bekommst du einen Absturz: einen akuten Kontrollverlust. Danach sinkt dein Knall auf 3.</p>
    </div>`
  );

knall.binden = (wurzel) => {
  const leiste = wurzel.querySelectorAll(".knall-leiste span");
  const zahl = wurzel.querySelector(".knall-zahl");
  const weniger = wurzel.querySelector(".knall-weniger");
  const mehr = wurzel.querySelector(".knall-mehr");
  const melden = wurzel.querySelector(".melden");

  function zeigen() {
    leiste.forEach((s, i) => s.classList.toggle("voll", i < stand));
    wurzel.querySelector(".knall").dataset.zustand = zustand(stand);
    zahl.innerHTML = `<b>${stand}</b>/${MAX} <span>${zustand(stand)}</span>`;
    weniger.disabled = stand === 0;
    mehr.disabled = stand >= MAX;
    melden.hidden = !lesen("knall-melden", false);
  }

  weniger.addEventListener("click", () => {
    setzen(stand - 1);
    zeigen();
  });

  mehr.addEventListener("click", () => {
    setzen(stand + 1);
    zeigen();
    if (stand >= MAX) absturz(zeigen);
  });

  melden.querySelector("button").addEventListener("click", () => {
    schreiben("knall-melden", false);
    zeigen();
    mehr.focus();
  });

  zeigen();
  // Wurde die App mitten im Absturz geschlossen, kommt er jetzt
  if (stand >= MAX) absturz(zeigen);
};

// ---------- Absturz: Vollbild-Glitch, dann die Anweisung ----------

const PANIK = [
  "kernel panic - not syncing: verstand nicht gefunden",
  "segfault in /proc/self/ich",
  "fornax-cluster: signal übernimmt",
  "ERR 0x05: zu viel knall",
  "die stimmen werden lauter",
];

const ZEICHEN = [..."▓▒░#@%&$01ᚠᚢᚦ"];

const muell = () =>
  Array.from({ length: 64 }, (_, i) =>
    i % 7 === 3
      ? PANIK[i % PANIK.length]
      : Array.from({ length: 90 }, () => ZEICHEN[Math.floor(Math.random() * ZEICHEN.length)]).join("")
  ).join("\n");

function absturz(danach) {
  const handy = document.querySelector(".handy");
  if (handy.querySelector(".absturz")) return;
  const ruhig = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const el = document.createElement("div");
  el.className = "absturz glitcht";
  el.tabIndex = -1;
  el.setAttribute("role", "alertdialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-labelledby", "absturz-titel");
  el.innerHTML = `
    <pre class="absturz-muell" aria-hidden="true">${muell()}</pre>
    <div class="absturz-inhalt">
      <h2 id="absturz-titel" data-text="ABSTURZ">ABSTURZ</h2>
      <p>Akuter Kontrollverlust. Dein Charakter wird von seinem Wahnsinn übermannt. Spiel es aus.</p>
      <p>Danach sinkt dein Knall auf 3. Melde dich nach der Session bei der Spielleitung.</p>
      <button type="button">[ weiter ]</button>
    </div>`;
  handy.append(el);
  el.focus();
  navigator.vibrate?.([300, 100, 200, 80, 500]);

  setTimeout(() => {
    el.classList.replace("glitcht", "ruhig");
    el.querySelector("button").focus();
  }, ruhig ? 0 : 2600);

  // Beim Wegnavigieren verschwindet die Anzeige, der Absturz bleibt aber offen
  const weg = () => el.remove();
  window.addEventListener("hashchange", weg, { once: true });

  el.querySelector("button").addEventListener("click", () => {
    window.removeEventListener("hashchange", weg);
    el.remove();
    setzen(NACH_ABSTURZ);
    schreiben("knall-melden", true);
    danach();
  });
}
