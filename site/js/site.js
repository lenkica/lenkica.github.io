// Theme toggle + list rendering for the homepage buttons and the projects, publications and teaching pages.
// Text comes from i18n.js (I18N.t for interface text, I18N.L for the _sl fields in the data files).
const t = (...a) => window.I18N.t(...a);
const L = (o, f) => window.I18N.L(o, f);

(function () {
  const root = document.documentElement;
  // dark ("observatory") is the default; a visitor's own choice is remembered
  let saved = null;
  try { saved = localStorage.getItem("theme"); } catch (e) {}
  root.dataset.theme = saved || "dark";
  const btn = document.getElementById("theme");
  const isDark = () => getComputedStyle(root).getPropertyValue("color-scheme").trim() === "dark";
  const label = () => { if (btn) btn.textContent = isDark() ? t("theme.light") : t("theme.dark"); };
  label();
  window.addEventListener("langchange", label);
  btn?.addEventListener("click", () => {
    root.dataset.theme = isDark() ? "light" : "dark";
    try { localStorage.setItem("theme", root.dataset.theme); } catch (e) {}
    label();
    window.dispatchEvent(new Event("themechange"));
  });
})();

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
const FIELD_VAR = { cell: "--f-cell", viz: "--f-viz", ai: "--f-ai" };
const nowWord = (s) => String(s ?? "").replace(/\bnow\b/, t("now"));

function boldMe(authors) {
  return esc(authors).replace(/Guček A/g, "<em>Guček A</em>");
}

// field of an output = majority field among its 15 nearest background papers on the map
function nearestField(m, background) {
  const near = background
    .map((p) => [(p[0] - m.x) ** 2 + (p[1] - m.y) ** 2, p[2]])
    .sort((a, b) => a[0] - b[0])
    .slice(0, 15);
  const votes = {};
  for (const [, f] of near) votes[f] = (votes[f] || 0) + 1;
  return Object.keys(votes).sort((a, b) => votes[b] - votes[a])[0];
}

function pubItem(m, background) {
  const f = background ? nearestField(m, background) : null;
  const dot = f ? `<span class="dot" style="background:var(${FIELD_VAR[f]})" title="${esc(t("dot.title"))}: ${esc(t(`field.${f}.l`))}"></span>` : "";
  const links = [
    m.doi ? `<a href="https://doi.org/${esc(m.doi)}" target="_blank" rel="noopener">DOI</a>` : "",
    m.url ? `<a href="${esc(m.url)}" target="_blank" rel="noopener">Link</a>` : "",
  ].filter(Boolean).join("");
  return `<div class="item" id="${esc(m.id)}">
    <div class="when">${m.year}</div>
    <div><h3>${dot}${esc(m.title)}</h3>
      <div class="meta">${boldMe(m.authors)}</div>
      <div class="meta"><span class="tag">${esc(t(`kind.${m.kind}`))}</span>${esc(m.venue)}</div>
      ${links ? `<div class="acts">${links}</div>` : ""}
    </div></div>`;
}

function projItem(p) {
  const name = L(p, "name");
  return `<div class="item">
    <div class="when">${esc(nowWord(L(p, "when")))}</div>
    <div><h3>${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(name)}</a>` : esc(name)}</h3>
      <div class="meta"><span class="tag">${esc(L(p, "funder"))}</span></div>
      <p class="meta" style="margin:6px 0 0">${esc(L(p, "summary"))}</p>
    </div></div>`;
}

function teachItem(x) {
  const dot = FIELD_VAR[x.topic] ? `<span class="dot" style="background:var(${FIELD_VAR[x.topic]})"></span>` : "";
  const title = x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(L(x, "title"))}</a>` : esc(L(x, "title"));
  const badge = x.badge ? `<div class="badge mono"><i></i>${esc(t("teach.ongoing"))} · ${esc(L(x, "badge"))}</div>` : "";
  const modules = x.modules ? `<ol class="mods">${x.modules.map((mo) => `<li>${esc(L(mo, "title"))}</li>`).join("")}</ol>` : "";
  const links = x.links ? `<ul class="eds">${x.links.map((l) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(L(l, "label"))}</a></li>`).join("")}</ul>` : "";
  const original = window.I18N.lang === "en" && x.original ? `<div class="meta" style="font-style:italic">${esc(x.original)}</div>` : "";
  return `<div class="item">
    <div class="when">${esc(nowWord(L(x, "when")))}</div>
    <div><h3>${dot}${title}</h3>
      ${original}
      <div class="meta"><em>${esc(L(x, "where"))}</em></div>
      <div class="meta"><span class="tag">${esc(L(x, "role"))}</span>${esc(L(x, "format"))}</div>
      ${badge}
      <p class="meta" style="margin:6px 0 0">${esc(L(x, "summary"))}</p>${modules}${links}
    </div></div>`;
}

// ---------- data, loaded once; everything re-renders when the language changes ----------
const getJSON = (f) => fetch(`data/${f}.json`, { cache: "no-cache" }).then((r) => r.json());
const need = {
  projects: document.getElementById("g-projects") || document.getElementById("all-projects"),
  map: document.getElementById("g-pubs") || document.getElementById("all-pubs"),
  teaching: document.getElementById("g-teach") || document.getElementById("all-teaching"),
};
const DATA = {};
const ready = Promise.all(Object.keys(need).filter((k) => need[k]).map((k) => getJSON(k).then((d) => (DATA[k] = d))));

function render() {
  const $ = (id) => document.getElementById(id);
  // homepage buttons: live counts
  if ($("g-projects") && DATA.projects) $("g-projects").textContent = t("gate.projects.n", DATA.projects.filter((p) => p.active).length, DATA.projects.filter((p) => !p.active).length);
  if ($("g-pubs") && DATA.map) $("g-pubs").textContent = t("gate.pubs.n", DATA.map.mine.filter((m) => m.kind === "article" || m.kind === "conference").length);
  if ($("g-teach") && DATA.teaching) $("g-teach").textContent = t("gate.teach.n", DATA.teaching.length);
  // full lists
  if ($("all-projects") && DATA.projects) {
    const p = DATA.projects;
    $("all-projects").innerHTML =
      `<h3 class="sub">${esc(t("proj.current"))}</h3>${p.filter((x) => x.active).map(projItem).join("")}` +
      `<h3 class="sub">${esc(t("proj.past"))}</h3>${p.filter((x) => !x.active).map(projItem).join("")}`;
  }
  if ($("all-pubs") && DATA.map) {
    // the publications page lists papers only: journal articles and conference papers
    const pubs = [...DATA.map.mine].sort((a, b) => b.year - a.year).filter((m) => m.kind === "article" || m.kind === "conference");
    $("all-pubs").innerHTML = pubs.map((m) => pubItem(m, DATA.map.background)).join("");
  }
  if ($("all-teaching") && DATA.teaching) $("all-teaching").innerHTML = DATA.teaching.map(teachItem).join("");
}
ready.then(() => {
  render();
  if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
});
window.addEventListener("langchange", render);
