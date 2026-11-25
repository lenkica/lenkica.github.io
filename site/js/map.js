// Research map: three fields of literature as soft density clouds (canvas),
// my outputs as dots with named theme callouts (SVG), all on one UMAP layout.
(async function () {
  const stage = document.getElementById("map");
  if (!stage) return;
  const data = await fetch("data/map.json", { cache: "no-cache" }).then((r) => r.json());
  const canvas = stage.querySelector("canvas");
  const svg = stage.querySelector("svg");
  const tip = document.getElementById("tip");
  const NS = "http://www.w3.org/2000/svg";
  const FIELD_VAR = { cell: "--f-cell", viz: "--f-viz", ai: "--f-ai" };
  const FIELD_NAME = { cell: "Cell biology", viz: "Data visualization", ai: "Artificial intelligence" };
  const THEMES = {
    exocytosis: { label: "Exocytosis & fusion pores", field: "cell" },
    trustworthy: { label: "Trustworthy AI & bias", field: "ai" },
    social: { label: "Social media & AI agents", field: "ai" },
    water: { label: "AI for water management", field: "ai" },
    dataviz: { label: "Dataviz & science communication", field: "viz" },
    health: { label: "Health & rare-disease data", field: "viz" },
  };
  const PAPERS = new Set(["article", "conference"]);
  const R = 3.5; // dot radius
  let W, H, S, ox, oy;
  let filter = "all", shownUpTo = Infinity, playing = null, focus = null;

  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const isDark = () => css("color-scheme") === "dark";
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));

  // ---------- geometry ----------
  const xs = data.background.map((p) => p[0]).concat(data.mine.map((m) => m.x));
  const ys = data.background.map((p) => p[1]).concat(data.mine.map((m) => m.y));
  const ext = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  stage.style.aspectRatio = `${Math.min(2, Math.max(1.1, (ext.x1 - ext.x0) / (ext.y1 - ext.y0)))}`;
  const pct = (arr, q) => { const a = [...arr].sort((u, v) => u - v); return a[Math.floor(q * (a.length - 1))]; };

  function layout() {
    const r = stage.getBoundingClientRect();
    W = r.width; H = r.height;
    const pad = 18;
    S = Math.min((W - 2 * pad) / (ext.x1 - ext.x0), (H - 2 * pad) / (ext.y1 - ext.y0));
    ox = (W - S * (ext.x1 - ext.x0)) / 2 - S * ext.x0;
    oy = (H - S * (ext.y1 - ext.y0)) / 2 + S * ext.y1;
  }
  const X = (x) => ox + x * S;
  const Y = (y) => oy - y * S;

  // ---------- background: density clouds + fine grain ----------
  function drawBackground() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    const dark = isDark();
    const blur = Math.max(6, S * 0.012);
    for (const f of Object.keys(FIELD_VAR)) {
      const off = document.createElement("canvas");
      off.width = W * dpr; off.height = H * dpr;
      const o = off.getContext("2d");
      o.scale(dpr, dpr);
      o.fillStyle = css(FIELD_VAR[f]);
      o.globalAlpha = 0.5;
      for (const p of data.background) {
        if (p[2] !== f) continue;
        o.beginPath(); o.arc(X(p[0]), Y(p[1]), 4.5, 0, 6.283); o.fill();
      }
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.filter = `blur(${blur * dpr}px)`;
      ctx.globalAlpha = dark ? 0.55 : 0.45;
      ctx.drawImage(off, 0, 0);
      ctx.restore();
    }
    // grain: every paper as a tiny point
    ctx.globalAlpha = dark ? 0.5 : 0.4;
    for (const p of data.background) {
      ctx.fillStyle = css(FIELD_VAR[p[2]]);
      ctx.fillRect(X(p[0]) - 0.75, Y(p[1]) - 0.75, 1.5, 1.5);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- my dots: spread apart so stacked outputs stay visible ----------
  let pos = [];
  function relax() {
    pos = data.mine.map((m) => ({ x: X(m.x), y: Y(m.y), x0: X(m.x), y0: Y(m.y) }));
    const min = 2 * R + 1.5;
    for (let it = 0; it < 160; it++) {
      for (let i = 0; i < pos.length; i++) {
        for (let j = i + 1; j < pos.length; j++) {
          const a = pos[i], b = pos[j];
          let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
          if (d >= min) continue;
          if (d < 1e-3) { dx = Math.cos(i + j); dy = Math.sin(i + j); d = 1; }
          const push = (min - d) / 2;
          a.x -= (dx / d) * push; a.y -= (dy / d) * push;
          b.x += (dx / d) * push; b.y += (dy / d) * push;
        }
      }
      for (const p of pos) {
        p.x += (p.x0 - p.x) * 0.03; p.y += (p.y0 - p.y) * 0.03;
        p.x = Math.min(Math.max(p.x, R + 2), W - R - 2); p.y = Math.min(Math.max(p.y, R + 2), H - R - 2);
      }
    }
  }

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  // ---------- field labels, at the edge of each field facing away from the others ----------
  function fieldLabels(g) {
    const med = {};
    for (const f of Object.keys(FIELD_VAR)) {
      const pts = data.background.filter((p) => p[2] === f);
      med[f] = { x: pct(pts.map((p) => p[0]), 0.5), y: pct(pts.map((p) => p[1]), 0.5), top: pct(pts.map((p) => p[1]), 0.985), bot: pct(pts.map((p) => p[1]), 0.015) };
    }
    for (const f of Object.keys(FIELD_VAR)) {
      const m = med[f];
      // another field directly above (similar x, higher y)? then label goes below
      const blockedAbove = Object.keys(med).some((g2) => g2 !== f && Math.abs(med[g2].x - m.x) < 0.2 && med[g2].y > m.y);
      const y = blockedAbove ? Y(m.bot) + 22 : Y(m.top) - 12;
      const t = el("text", { class: "field", x: Math.min(Math.max(X(m.x), 70), W - 70), y: Math.min(Math.max(y, 16), H - 6), "text-anchor": "middle" }, g);
      t.textContent = FIELD_NAME[f].toUpperCase();
    }
  }

  // ---------- theme callouts in the empty band between the two continents ----------
  function themeCallouts(g) {
    // find the widest near-empty vertical band in the background: the callouts live there
    const B = 60, hist = new Array(B).fill(0);
    for (const p of data.background) hist[Math.min(B - 1, Math.max(0, Math.floor(((p[0] - ext.x0) / (ext.x1 - ext.x0)) * B)))]++;
    const thresh = data.background.length * 0.002;
    let bs = 0, be = -1, cs = null;
    for (let i = 0; i <= B; i++) {
      if (i < B && hist[i] <= thresh) { if (cs === null) cs = i; }
      else if (cs !== null) { if (i - cs > be - bs + 1) { bs = cs; be = i - 1; } cs = null; }
    }
    const gx = (b) => X(ext.x0 + (b / B) * (ext.x1 - ext.x0));
    const colL = be >= bs ? gx(bs) + 10 : W * 0.4, colR = be >= bs ? gx(be + 1) - 10 : W * 0.6;
    const items = [];
    for (const [key, th] of Object.entries(THEMES)) {
      const idx = data.mine.map((m, i) => (m.theme === key ? i : -1)).filter((i) => i >= 0);
      if (!idx.length) continue;
      const years = idx.map((i) => data.mine[i].year);
      // medoid = the theme's densest dot; the callout points at that part of the theme
      const near = (i) => idx.filter((j) => Math.hypot(pos[i].x - pos[j].x, pos[i].y - pos[j].y) < 30).length;
      const med = idx.reduce((b, i) => (near(i) > near(b) ? i : b), idx[0]);
      const side = pos[med].x < (colL + colR) / 2 ? "L" : "R";
      const core = idx.filter((j) => Math.hypot(pos[med].x - pos[j].x, pos[med].y - pos[j].y) < 30);
      items.push({ key, th, idx, core, cy: pos[med].y, side, y: pos[med].y, span: `${Math.min(...years)}–${String(Math.max(...years)).slice(-2)}`, n: idx.length });
    }
    // resolve vertical overlaps across both columns together: on narrow screens the two columns can touch
    {
      const col = [...items].sort((a, b) => a.cy - b.cy);
      const gap = 36;
      for (let i = 1; i < col.length; i++) col[i].y = Math.max(col[i].y, col[i - 1].y + gap);
      const over = col.length ? col[col.length - 1].y - (H - 24) : 0;
      if (over > 0) col.forEach((t) => (t.y -= over));
      for (let i = col.length - 2; i >= 0; i--) col[i].y = Math.min(col[i].y, col[i + 1].y - gap);
      col.forEach((t) => (t.y = Math.max(t.y, 20)));
    }
    for (const t of items) {
      const lx = t.side === "L" ? colL : colR;
      // anchor: the edge of the theme's core facing the label column
      let best = t.core[0], bd = Infinity;
      for (const i of t.core) { const d = Math.abs(pos[i].x - lx) + Math.abs(pos[i].y - t.y) * 0.3; if (d < bd) { bd = d; best = i; } }
      const a = pos[best];
      const grp = el("g", { class: "callout", "data-theme": t.key, tabindex: 0, role: "button", "aria-label": `${t.th.label}: ${t.n} outputs, ${t.span}` }, g);
      const dir = t.side === "L" ? 1 : -1;
      el("path", { class: "lead", d: `M${a.x + dir * (R + 3)},${a.y} C${(a.x + lx) / 2},${a.y} ${(a.x + lx) / 2},${t.y - 4} ${lx - dir * 4},${t.y - 4}` }, grp);
      const anchor = t.side === "L" ? "start" : "end";
      const sw = el("circle", { class: "sw", cx: lx + dir * 4, cy: t.y - 8, r: 4, style: `fill:var(${FIELD_VAR[t.th.field]})` }, grp);
      const name = el("text", { class: "cname", x: lx + dir * 13, y: t.y - 4, "text-anchor": anchor }, grp);
      name.textContent = t.th.label;
      const sub = el("text", { class: "csub", x: lx + dir * 13, y: t.y + 11, "text-anchor": anchor }, grp);
      sub.textContent = `${t.span} · ${t.n} outputs`;
      // generous invisible hit area
      const bb = grp.getBBox();
      el("rect", { class: "hit", x: bb.x - 6, y: bb.y - 4, width: bb.width + 12, height: bb.height + 8 }, grp).parentNode.insertBefore(grp.lastChild, grp.firstChild);
      grp.__key = t.key;
    }
  }

  let circles = [];
  function drawOverlay() {
    svg.innerHTML = "";
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    el("text", { class: "yr", id: "yr", x: W - 14, y: H - 14, "text-anchor": "end" }, svg);
    fieldLabels(el("g", {}, svg));
    relax();
    themeCallouts(el("g", {}, svg));
    const dots = el("g", {}, svg);
    circles = data.mine.map((m, i) => {
      const c = el("circle", { class: "me", cx: pos[i].x, cy: pos[i].y, r: R, tabindex: 0, role: "link", "aria-label": `${m.year}: ${m.title}` }, dots);
      c.__m = m;
      return c;
    });
    applyState();
  }

  function applyState() {
    for (const c of circles) {
      const m = c.__m;
      const visible = m.year <= shownUpTo;
      const ok = filter === "all" || PAPERS.has(m.kind);
      c.style.display = visible ? "" : "none";
      c.classList.toggle("dim", !ok || (focus && m.theme !== focus));
      c.classList.toggle("hot", !!focus && m.theme === focus && ok);
    }
    svg.querySelectorAll(".callout").forEach((g) => {
      const anyVisible = data.mine.some((m) => m.theme === g.__key && m.year <= shownUpTo);
      g.style.opacity = anyVisible ? "" : "0";
      g.classList.toggle("on", focus === g.__key);
      g.classList.toggle("off", !!focus && focus !== g.__key);
    });
    const yr = document.getElementById("yr");
    if (yr) yr.textContent = shownUpTo === Infinity ? "" : shownUpTo;
  }

  // ---------- tooltip ----------
  function showTip(html, x, y) {
    tip.innerHTML = html;
    tip.classList.add("show");
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let left = x + 14, top = y + 14;
    if (left + tw > W) left = x - tw - 14;
    if (top + th > H) top = y - th - 14;
    tip.style.left = Math.max(0, left) + "px"; tip.style.top = Math.max(0, top) + "px";
  }
  const hideTip = () => tip.classList.remove("show");
  function myTip(m) {
    const th = THEMES[m.theme];
    const k = th ? `<div class="k"><i style="background:var(${FIELD_VAR[th.field]})"></i>${esc(th.label)}</div>` : "";
    return `<div class="t">${esc(m.title)}</div><div class="m">${esc(m.venue)} · ${m.year}</div>${k}`;
  }
  const setFocus = (k) => { if (focus !== k) { focus = k; applyState(); } };

  stage.addEventListener("mousemove", (e) => {
    const r = stage.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const t = e.target;
    if (t.classList?.contains("me")) { setFocus(t.__m.theme || null); return showTip(myTip(t.__m), mx, my); }
    const co = t.closest?.(".callout");
    if (co) { setFocus(co.__key); return hideTip(); }
    setFocus(null);
    let best = null, bd = 49;
    for (const p of data.background) {
      const dx = X(p[0]) - mx, dy = Y(p[1]) - my, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = p; }
    }
    if (best) {
      const c = data.clusters.find((c) => c.id === best[3]);
      showTip(`<div class="k"><i style="background:var(${FIELD_VAR[best[2]]})"></i>${FIELD_NAME[best[2]]} literature</div>${c ? `<div class="m" style="margin-top:4px">Topic: ${esc(c.label)}</div>` : ""}`, mx, my);
    } else hideTip();
  });
  stage.addEventListener("mouseleave", () => { hideTip(); setFocus(null); });
  svg.addEventListener("click", (e) => {
    const co = e.target.closest?.(".callout");
    if (co) { setFocus(focus === co.__key ? null : co.__key); return; }
    const m = e.target.__m;
    if (!m) return;
    const url = m.doi ? `https://doi.org/${m.doi}` : m.url || (PAPERS.has(m.kind) ? `publications.html#${m.id}` : null);
    if (url) window.open(url, url.startsWith("http") ? "_blank" : "_self");
  });
  svg.addEventListener("keydown", (e) => { if (e.key === "Enter") e.target.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
  svg.addEventListener("focusin", (e) => {
    const co = e.target.closest?.(".callout");
    if (co) return setFocus(co.__key);
    if (!e.target.__m) return;
    setFocus(e.target.__m.theme || null);
    const r = stage.getBoundingClientRect(), b = e.target.getBoundingClientRect();
    showTip(myTip(e.target.__m), b.left - r.left, b.top - r.top);
  });
  svg.addEventListener("focusout", () => { hideTip(); setFocus(null); });

  // ---------- controls ----------
  document.querySelectorAll("[data-filter]").forEach((b) =>
    b.addEventListener("click", () => {
      filter = b.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((x) => x.setAttribute("aria-pressed", x === b));
      applyState();
    })
  );
  const playBtn = document.getElementById("play");
  const PLAY = "▶ Play 2011 → today";
  playBtn?.addEventListener("click", () => {
    if (playing) { clearInterval(playing); playing = null; shownUpTo = Infinity; applyState(); playBtn.textContent = PLAY; return; }
    const years = [...new Set(data.mine.map((m) => m.year))].sort();
    let i = 0;
    playBtn.textContent = "■ Stop";
    const step = () => {
      if (i >= years.length) { clearInterval(playing); playing = null; setTimeout(() => { shownUpTo = Infinity; applyState(); }, 1400); playBtn.textContent = PLAY; return; }
      shownUpTo = years[i++];
      applyState();
    };
    step();
    playing = setInterval(step, 650);
  });

  const foot = document.getElementById("map-foot");
  if (foot) foot.firstElementChild.textContent = `${data.mine.length} of my outputs among ${data.background.length.toLocaleString()} papers from OpenAlex · embedded with ${data.model.split("/").pop()} · UMAP · built ${data.generated}`;

  function render() { layout(); drawBackground(); drawOverlay(); }
  render();
  let raf;
  new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(render); }).observe(stage);
  window.addEventListener("themechange", drawBackground);
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", drawBackground);
})();
