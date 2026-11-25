// Theme toggle + list rendering for home, projects and publications pages.
(function () {
  const root = document.documentElement;
  const saved = localStorage.getItem("theme");
  if (saved) root.dataset.theme = saved;
  const btn = document.getElementById("theme");
  const isDark = () => getComputedStyle(root).getPropertyValue("color-scheme").trim() === "dark";
  const label = () => { if (btn) btn.textContent = isDark() ? "Light" : "Dark"; };
  label();
  btn?.addEventListener("click", () => {
    root.dataset.theme = isDark() ? "light" : "dark";
    localStorage.setItem("theme", root.dataset.theme);
    label();
    window.dispatchEvent(new Event("themechange"));
  });
})();

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
const KIND = { article: "Journal article", conference: "Conference paper", abstract: "Conference abstract", talk: "Talk", thesis: "Thesis", report: "Project report", course: "Course", data: "Dataset", other: "Other" };
const FIELD_VAR = { cell: "--f-cell", viz: "--f-viz", ai: "--f-ai" };

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

const FIELD_LABEL = { cell: "cell biology", viz: "data visualization", ai: "AI" };
function pubItem(m, background) {
  const f = background ? nearestField(m, background) : null;
  const dot = f ? `<span class="dot" style="background:var(${FIELD_VAR[f]})" title="Nearest field on the map: ${FIELD_LABEL[f]}"></span>` : "";
  const links = [
    m.doi ? `<a href="https://doi.org/${esc(m.doi)}" target="_blank" rel="noopener">DOI</a>` : "",
    m.url ? `<a href="${esc(m.url)}" target="_blank" rel="noopener">Link</a>` : "",
  ].filter(Boolean).join("");
  return `<div class="item" id="${esc(m.id)}">
    <div class="when">${m.year}</div>
    <div><h3>${dot}${esc(m.title)}</h3>
      <div class="meta">${boldMe(m.authors)}</div>
      <div class="meta"><span class="tag">${KIND[m.kind] || m.kind}</span>${esc(m.venue)}</div>
      ${links ? `<div class="acts">${links}</div>` : ""}
    </div></div>`;
}

function projItem(p) {
  return `<div class="item">
    <div class="when">${esc(p.when)}</div>
    <div><h3>${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.name)}</a>` : esc(p.name)}</h3>
      <div class="meta"><span class="tag">${esc(p.funder)}</span>${esc(p.role || "")}</div>
      <p class="meta" style="margin:6px 0 0">${esc(p.summary)}</p>
    </div></div>`;
}

function teachItem(t, full) {
  const dot = FIELD_VAR[t.topic] ? `<span class="dot" style="background:var(${FIELD_VAR[t.topic]})"></span>` : "";
  const title = t.url ? `<a href="${esc(t.url)}" target="_blank" rel="noopener">${esc(t.title)}</a>` : esc(t.title);
  const editions = full && t.editions ? `<ul class="eds">${t.editions.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>` : "";
  const links = full && t.links ? `<ul class="eds">${t.links.map((l) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a></li>`).join("")}</ul>` : "";
  return `<div class="item">
    <div class="when">${esc(t.when)}</div>
    <div><h3>${dot}${title}</h3>
      ${full && t.original ? `<div class="meta" style="font-style:italic">${esc(t.original)}</div>` : ""}
      <div class="meta"><em>${esc(t.where)}</em></div>
      <div class="meta"><span class="tag">${esc(t.role)}</span>${full ? esc(t.format) : ""}</div>
      ${full ? `<p class="meta" style="margin:6px 0 0">${esc(t.summary)}</p>${editions}${links}` : ""}
    </div></div>`;
}

// homepage buttons: live counts from the data files
async function renderGates() {
  const gp = document.getElementById("g-projects");
  if (!gp) return;
  const get = (f) => fetch(`data/${f}.json`, { cache: "no-cache" }).then((r) => r.json());
  const [proj, map, teach] = await Promise.all([get("projects"), get("map"), get("teaching")]);
  const papers = map.mine.filter((m) => m.kind === "article" || m.kind === "conference").length;
  gp.textContent = `${proj.filter((p) => p.active).length} current · ${proj.filter((p) => !p.active).length} past`;
  document.getElementById("g-pubs").textContent = `${papers} journal and conference papers`;
  document.getElementById("g-teach").textContent = `${teach.length} courses and trainings`;
}
renderGates();

async function renderLists() {
  const teach = document.getElementById("teaching");
  const teachAll = document.getElementById("all-teaching");
  if (teach || teachAll) {
    fetch("data/teaching.json", { cache: "no-cache" }).then((r) => r.json()).then((t) => {
      if (teach) teach.innerHTML = t.map((x) => teachItem(x, false)).join("");
      if (teachAll) teachAll.innerHTML = t.map((x) => teachItem(x, true)).join("");
    });
  }
  const latest = document.getElementById("latest-pubs");
  const all = document.getElementById("all-pubs");
  const projs = document.getElementById("projects");
  const projsAll = document.getElementById("all-projects");

  if (latest || all) {
    const map = await fetch("data/map.json", { cache: "no-cache" }).then((r) => r.json());
    const pubs = [...map.mine].sort((a, b) => b.year - a.year);
    if (latest) latest.innerHTML = pubs.filter((m) => m.kind === "article").slice(0, 4).map((m) => pubItem(m, map.background)).join("");
    if (all) {
      // the publications page lists papers only: journal articles and conference papers
      all.innerHTML = pubs.filter((m) => m.kind === "article" || m.kind === "conference").map((m) => pubItem(m, map.background)).join("");
      if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
    }
  }
  if (projs || projsAll) {
    const p = await fetch("data/projects.json", { cache: "no-cache" }).then((r) => r.json());
    if (projs) projs.innerHTML = p.filter((x) => x.active).map(projItem).join("");
    if (projsAll) projsAll.innerHTML =
      `<h3 class="sub">Current</h3>${p.filter((x) => x.active).map(projItem).join("")}` +
      `<h3 class="sub">Past</h3>${p.filter((x) => !x.active).map(projItem).join("")}`;
  }
}
renderLists();
