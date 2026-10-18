// News: Artikel aus data/news.json, die neuesten oben. Artikel mit Zeit in der Zukunft bleiben unsichtbar.
// Gelesene Artikel merkt sich das Gerät, die Startseite zeigt, wie viele neu sind.

import { maskieren, unterseite, ausgabe, lesen, schreiben } from "./hilfen.js";

// Jedes Mal frisch laden, damit neue Artikel sofort ankommen (offline liefert der Service Worker den letzten Stand)
async function laden() {
  const antwort = await fetch("data/news.json");
  if (!antwort.ok) throw new Error(antwort.status);
  const { artikel } = await antwort.json();
  const jetzt = new Date();
  return artikel.filter((a) => new Date(a.zeit) <= jetzt);
}

const gelesen = () => new Set(lesen("news-gelesen", []));

function alsGelesen(id) {
  const ids = gelesen();
  ids.add(id);
  schreiben("news-gelesen", [...ids]);
}

export async function ungelesen() {
  try {
    const ids = gelesen();
    return (await laden()).filter((a) => !ids.has(a.id)).length;
  } catch {
    return 0;
  }
}

const datum = (zeit) =>
  new Date(zeit).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

const kopfzeile = (a) => `${a.quelle ? `${maskieren(a.quelle)} · ` : ""}<time datetime="${a.zeit}">${datum(a.zeit)}</time>`;

// Absätze trennt eine Leerzeile
const absaetze = (text) =>
  text
    .split(/\n\s*\n/)
    .map((p) => `<p>${maskieren(p.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("");

const keineVerbindung = () =>
  unterseite(
    "news",
    ausgabe("tail -f meldungen.log", "fehler: keine verbindung zum source-net", "Prüfe deine Internetverbindung und öffne die Meldungen erneut.")
  );

export async function news({ id }) {
  let liste;
  try {
    liste = await laden();
  } catch {
    return keineVerbindung();
  }
  if (id) return artikelAnsicht(liste.find((a) => a.id === id), id);
  if (!liste.length) {
    return unterseite("news", ausgabe("tail -f meldungen.log", "keine meldungen", "Neue Meldungen erscheinen hier, sobald es etwas gibt."));
  }

  const ids = gelesen();
  const eintraege = liste
    .map(
      (a) => `
      <li>
        <a class="meldung stil-${a.stil}${ids.has(a.id) ? "" : " neu"}" href="#/news/${a.id}">
          ${a.bild ? `<img src="${maskieren(a.bild)}" alt="" loading="lazy">` : ""}
          <div>
            <p class="kopf">${kopfzeile(a)}</p>
            <h2>${maskieren(a.titel)}</h2>
            ${ids.has(a.id) ? "" : `<span class="marke">[ neu ]</span>`}
          </div>
        </a>
      </li>`
    )
    .join("");
  return unterseite("news", `<ul class="meldungen">${eintraege}</ul>`);
}

function artikelAnsicht(a, id) {
  if (!a) {
    return unterseite(
      "news",
      ausgabe(`cat ${maskieren(id)}`, "meldung nicht gefunden", "Vielleicht wurde sie gelöscht. Vielleicht hat es sie nie gegeben.")
    );
  }
  alsGelesen(a.id);
  return unterseite(
    `news/${maskieren(a.id)}`,
    `<article class="artikel stil-${a.stil}">
      <p class="kopf">${kopfzeile(a)}</p>
      <h2>${maskieren(a.titel)}</h2>
      ${
        a.bild
          ? `<figure>
              <img src="${maskieren(a.bild)}" alt="${maskieren(a.bildtext ?? "")}">
              ${a.bildtext ? `<figcaption>${maskieren(a.bildtext)}</figcaption>` : ""}
            </figure>`
          : ""
      }
      <div class="text">${absaetze(a.text)}</div>
    </article>
    <a class="zurueck" href="#/news">[ cd .. ] alle meldungen</a>`,
    "#/news"
  );
}
