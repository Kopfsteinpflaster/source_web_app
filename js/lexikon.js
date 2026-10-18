// Lexikon: aufklappbare Einträge aus data/lexikon.json, mit grep-Suche und Querverweisen.

import { maskieren, unterseite, ausgabe } from "./hilfen.js";

let daten = null;

async function laden() {
  if (!daten) {
    const antwort = await fetch("data/lexikon.json");
    if (!antwort.ok) throw new Error(antwort.status);
    daten = await antwort.json();
  }
  return daten;
}

const bytes = (text) => new TextEncoder().encode(text).length;

function eintrag(e, titelVon) {
  const verweise = (e.verweise ?? [])
    .filter((id) => titelVon[id])
    .map((id) => `<a href="#/lexikon/${id}" title="${maskieren(titelVon[id])}">[${id}]</a>`)
    .join(" ");
  const suche = `${e.titel} ${e.text}`.toLowerCase();

  return `
    <details class="eintrag" id="eintrag-${e.id}" data-suche="${maskieren(suche)}">
      <summary>
        <span class="schalter" aria-hidden="true"></span>
        <span class="name">${maskieren(e.titel)}</span>
        <span class="groesse">${bytes(e.text)} B</span>
      </summary>
      <div class="inhalt">
        <p>${maskieren(e.text)}</p>
        ${verweise ? `<p class="verweise">-&gt; siehe: ${verweise}</p>` : ""}
      </div>
    </details>`;
}

export async function lexikon() {
  let d;
  try {
    d = await laden();
  } catch {
    return unterseite(
      "lexikon",
      ausgabe("cat lexikon.json", "fehler: keine verbindung zum source-net", "Prüfe deine Internetverbindung und öffne das Lexikon erneut.")
    );
  }

  const titelVon = Object.fromEntries(d.eintraege.map((e) => [e.id, e.titel]));
  const gruppen = d.kategorien
    .map((k) => {
      const liste = d.eintraege.filter((e) => e.kategorie === k.id);
      return `
        <section class="lex-gruppe">
          <h2>./${maskieren(k.titel)}/ <span>(${liste.length})</span></h2>
          ${liste.map((e) => eintrag(e, titelVon)).join("")}
        </section>`;
    })
    .join("");

  return unterseite(
    "lexikon",
    `
    <label class="grep">
      <span aria-hidden="true">$ grep -i</span>
      <input type="search" placeholder="suchbegriff" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Lexikon durchsuchen">
    </label>
    ${gruppen}
    <pre class="ausgabe keine-treffer" hidden></pre>`
  );
}

// Nach dem Einfügen: Suche verdrahten und ggf. den verlinkten Eintrag öffnen
lexikon.binden = (wurzel, { id }) => {
  const feld = wurzel.querySelector(".grep input");
  if (!feld) return;
  const eintraege = [...wurzel.querySelectorAll(".eintrag")];
  const gruppen = [...wurzel.querySelectorAll(".lex-gruppe")];
  const leer = wurzel.querySelector(".keine-treffer");

  feld.addEventListener("input", () => {
    const begriff = feld.value.trim().toLowerCase();
    let treffer = 0;
    for (const e of eintraege) {
      const passt = !begriff || e.dataset.suche.includes(begriff);
      e.hidden = !passt;
      if (passt) treffer++;
    }
    for (const g of gruppen) g.hidden = !g.querySelector(".eintrag:not([hidden])");
    leer.hidden = treffer > 0;
    if (!treffer) {
      leer.innerHTML = `<span class="fehler">grep: keine treffer für "${maskieren(begriff)}"</span>\n<span class="kommentar"># Versuch es mit einem anderen Suchbegriff.</span>`;
    }
  });

  const ziel = id && wurzel.querySelector(`#eintrag-${CSS.escape(id)}`);
  if (ziel) {
    ziel.open = true;
    ziel.scrollIntoView({ block: "start" });
    ziel.querySelector("summary").focus({ preventScroll: true });
  }
};
