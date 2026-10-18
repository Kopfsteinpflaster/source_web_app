// SOURCE – Einstieg: Hash-Router, OT-Menü, Service Worker.

import * as ansichten from "./ansichten.js";
import { knallAnzeigen } from "./knall.js";

knallAnzeigen();

const routen = {
  "/": ansichten.start,
  "/lexikon": ansichten.lexikon,
  "/terminal": ansichten.terminal,
  "/news": ansichten.news,
  "/ot/muenzwurf": ansichten.muenzwurf,
  "/ot/knall": ansichten.knall,
  "/ot/regeln": ansichten.regeln,
  "/ot/impressum": ansichten.impressum,
};

const ansicht = document.getElementById("ansicht");

// Die Boot-Sequenz läuft nur beim ersten Aufruf einer Sitzung
function ersterStart() {
  try {
    if (sessionStorage.getItem("gebootet")) return false;
    sessionStorage.setItem("gebootet", "1");
  } catch {
    // ohne Speicher einfach immer booten
  }
  return true;
}
const booten = ersterStart();

// Liefert die Ansicht und ihre Parameter, z. B. #/lexikon/lotus → lexikon({ id: "lotus" })
function finden(pfad) {
  if (routen[pfad]) return [routen[pfad], {}];
  const lex = pfad.match(/^\/lexikon\/([\w-]+)$/);
  if (lex) return [ansichten.lexikon, { id: lex[1] }];
  // QR-Codes zeigen auf #/scan/<code>, eingelesen wird im Terminal
  const scan = pfad.match(/^\/scan\/([\w-]+)$/);
  if (scan) return [ansichten.terminal, { scan: scan[1] }];
  return [ansichten.nichtGefunden, {}];
}

let aufruf = 0;

async function zeigen() {
  const pfad = location.hash.replace(/^#/, "") || "/";
  const [ansichtFn, parameter] = finden(pfad);
  const dieser = ++aufruf;
  const html = await ansichtFn({ ...parameter, booten: booten && pfad === "/" });
  if (dieser !== aufruf) return; // inzwischen weiternavigiert
  ansicht.innerHTML = html;
  ansicht.scrollTop = 0;
  if (pfad !== "/") ansicht.focus({ preventScroll: true });
  ansichtFn.binden?.(ansicht, parameter);
}

window.addEventListener("hashchange", () => {
  otSchliessen();
  zeigen();
});
zeigen();

// ---------- OT-Menü hinter dem gesplitterten Bildschirm ----------

const splitter = document.querySelector(".splitter");
const otMenue = document.getElementById("ot-menue");

function otOeffnen() {
  otMenue.hidden = false;
  requestAnimationFrame(() => otMenue.classList.add("offen"));
  splitter.setAttribute("aria-expanded", "true");
  otMenue.querySelector(".ot-liste a").focus();
}

function otSchliessen() {
  if (otMenue.hidden) return;
  otMenue.classList.remove("offen");
  splitter.setAttribute("aria-expanded", "false");
  setTimeout(() => (otMenue.hidden = true), 250);
}

splitter.addEventListener("click", otOeffnen);
otMenue.addEventListener("click", (e) => {
  if (e.target === otMenue || e.target.closest("[data-ot-schliessen]")) {
    otSchliessen();
    splitter.focus();
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") otSchliessen();
});

// ---------- Uhr in der Statusleiste ----------

const uhr = document.getElementById("uhr");
function uhrStellen() {
  uhr.textContent = new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}
uhrStellen();
setInterval(uhrStellen, 15000);

// ---------- Service Worker ----------

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}
