// Scroll story on one fixed canvas.
// Background: ~4,400 papers as glowing field clouds + fine grain. Foreground: my outputs as dots.
// Each step of the story sets a camera (which part of the map to show) and a layout for my dots:
//   map (UMAP position)  ->  timeline (by year)  ->  list (they become the bullets of the latest papers).
(async function () {
  const stageEl = document.getElementById("stage");
  if (!stageEl) return;
  const canvas = stageEl.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  const tip = document.getElementById("tip");
  const data = await fetch("data/map.json", { cache: "no-cache" }).then((r) => r.json());
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const FIELDS = ["cell", "viz", "ai"];
  const FIELD_VAR = { cell: "--f-cell", viz: "--f-viz", ai: "--f-ai" };
  const tr = (...a) => window.I18N.t(...a);
  const FIELD_NAME = new Proxy({}, { get: (_, f) => tr("field." + String(f)) });
  const THEMES = {
    exocytosis: { label: "Exocytosis & fusion pores", field: "cell" },
    trustworthy: { label: "Trustworthy AI & bias", field: "ai" },
    social: { label: "Social media & AI agents", field: "ai" },
    water: { label: "AI for water management", field: "ai" },
    dataviz: { label: "Dataviz & science communication", field: "viz" },
    health: { label: "Health & rare-disease data", field: "viz" },
  };
  for (const k of Object.keys(THEMES)) Object.defineProperty(THEMES[k], "label", { get: () => tr("theme." + k) });
  const PAPERS = new Set(["article", "conference"]);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const isDark = () => css("color-scheme") === "dark";
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp01 = (t) => Math.max(0, Math.min(1, t));
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  // ---------- data prep ----------
  const bg = data.background; // [x, y, field, cluster]
  const mine = data.mine.map((m, i) => ({ ...m, i }));
  const xs = bg.map((p) => p[0]), ys = bg.map((p) => p[1]);
  const ext = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  // field of each of my outputs = majority among its 15 nearest background papers
  for (const m of mine) {
    const near = bg.map((p) => [(p[0] - m.x) ** 2 + (p[1] - m.y) ** 2, p[2]]).sort((a, b) => a[0] - b[0]).slice(0, 15);
    const v = {};
    for (const [, f] of near) v[f] = (v[f] || 0) + 1;
    m.field = Object.keys(v).sort((a, b) => v[b] - v[a])[0];
  }
  // camera targets: the bounding box of a set of points, in data units
  const box = (pts) => {
    const a = pts.map((p) => p[0]), b = pts.map((p) => p[1]);
    const q = (arr, t) => { const s = [...arr].sort((u, w) => u - w); return s[Math.floor(t * (s.length - 1))]; };
    return { x0: q(a, 0.03), x1: q(a, 0.97), y0: q(b, 0.03), y1: q(b, 0.97) };
  };
  const fieldBox = (f) => box(bg.filter((p) => p[2] === f));
  const themeBox = (keys, f) => box(bg.filter((p) => p[2] === f).concat(mine.filter((m) => keys.includes(m.theme)).map((m) => [m.x, m.y])));

  // ---------- story steps ----------
  const STEPS = {
    hero: { cam: { box: ext, ox: 0.69, fill: 0.95 }, layout: "map", bg: 1, focus: null, dots: 0.85 },
    cell: { cam: { box: themeBox(["exocytosis"], "cell"), ox: 0.66, fill: 0.75 }, layout: "map", bg: 1, focus: ["exocytosis"], dots: 1 },
    viz: { cam: { box: themeBox(["dataviz", "health"], "viz"), ox: 0.66, fill: 0.8 }, layout: "map", bg: 1, focus: ["dataviz", "health"], dots: 1 },
    ai: { cam: { box: themeBox(["trustworthy", "social", "water"], "ai"), ox: 0.66, fill: 0.8 }, layout: "map", bg: 1, focus: ["trustworthy", "social", "water"], dots: 1 },
    all: { cam: { box: ext, ox: 0.66, fill: 0.95 }, layout: "map", bg: 1, focus: null, dots: 1, callouts: true },
    timeline: { cam: { box: ext, ox: 0.6, fill: 0.9 }, layout: "timeline", bg: 0.22, focus: null, dots: 1 },
    list: { cam: { box: ext, ox: 0.6, fill: 0.9 }, layout: "list", bg: 0.1, focus: null, dots: 1 },
  };

  // ---------- canvas geometry ----------
  let W = 0, H = 0, dpr = 1, narrow = false;
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    narrow = W < 760;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    buildClouds();
    callouts = null;
  }
  // camera = {cx, cy, k}: data point (cx, cy) is drawn at (W*ox, H/2), k pixels per data unit
  function camFor(step) {
    const c = STEPS[step].cam, b = c.box;
    const ox = narrow ? 0.5 : c.ox;
    const availW = narrow ? W * 0.94 : W * (1 - ox) * 2 * 0.98;
    const availH = narrow ? H * 0.55 : H * 0.86;
    const k = Math.min(availW / (b.x1 - b.x0), availH / (b.y1 - b.y0)) * c.fill;
    return { cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2, k, ox, oy: narrow ? 0.36 : 0.5 };
  }
  const project = (cam, x, y) => [W * cam.ox + (x - cam.cx) * cam.k, H * cam.oy - (y - cam.cy) * cam.k];

  // ---------- pre-rendered glowing clouds (in data space, drawn with the camera transform) ----------
  let clouds = null, cloudRes = 0;
  function buildClouds() {
    cloudRes = Math.min(1600, Math.max(W, H) * 1.2) / Math.max(ext.x1 - ext.x0, ext.y1 - ext.y0);
    const pad = 0.08;
    const cw = Math.ceil((ext.x1 - ext.x0 + 2 * pad) * cloudRes), ch = Math.ceil((ext.y1 - ext.y0 + 2 * pad) * cloudRes);
    clouds = document.createElement("canvas");
    clouds.width = cw; clouds.height = ch;
    clouds.pad = pad;
    const c = clouds.getContext("2d");
    const dark = isDark();
    c.globalCompositeOperation = dark ? "lighter" : "source-over";
    for (const f of FIELDS) {
      const off = document.createElement("canvas");
      off.width = cw; off.height = ch;
      const o = off.getContext("2d");
      o.fillStyle = css(FIELD_VAR[f]);
      o.globalAlpha = dark ? 0.35 : 0.5;
      for (const p of bg) {
        if (p[2] !== f) continue;
        o.beginPath();
        o.arc((p[0] - ext.x0 + pad) * cloudRes, (ext.y1 - p[1] + pad) * cloudRes, 5, 0, 6.283);
        o.fill();
      }
      c.filter = `blur(${Math.round(cloudRes * 0.012)}px)`;
      c.globalAlpha = dark ? 0.9 : 0.5;
      c.drawImage(off, 0, 0);
    }
    c.filter = "none";
    fieldColors = Object.fromEntries(FIELDS.map((f) => [f, css(FIELD_VAR[f])]));
  }
  let fieldColors = {};

  // ---------- my dots: relaxed so stacked outputs stay visible ----------
  // offsets are computed once at overview scale, in data units
  const R = 3.6;
  function relaxOffsets() {
    const cam = camFor("all");
    const pos = mine.map((m) => project(cam, m.x, m.y));
    const base = pos.map((p) => [...p]);
    const min = 2 * R + 1.6;
    for (let it = 0; it < 160; it++) {
      for (let i = 0; i < pos.length; i++) for (let j = i + 1; j < pos.length; j++) {
        let dx = pos[j][0] - pos[i][0], dy = pos[j][1] - pos[i][1], d = Math.hypot(dx, dy);
        if (d >= min) continue;
        if (d < 1e-3) { dx = Math.cos(i + j); dy = Math.sin(i + j); d = 1; }
        const push = (min - d) / 2;
        pos[i][0] -= (dx / d) * push; pos[i][1] -= (dy / d) * push;
        pos[j][0] += (dx / d) * push; pos[j][1] += (dy / d) * push;
      }
      for (let i = 0; i < pos.length; i++) { pos[i][0] += (base[i][0] - pos[i][0]) * 0.03; pos[i][1] += (base[i][1] - pos[i][1]) * 0.03; }
    }
    // offsets in screen pixels: a stack of outputs stays a compact cluster at every zoom level
    mine.forEach((m, i) => { m.dx = pos[i][0] - base[i][0]; m.dy = pos[i][1] - base[i][1]; });
  }

  // ---------- target layouts ----------
  function mapTarget(m, cam) { const [x, y] = project(cam, m.x, m.y); return [x + m.dx, y + m.dy]; }

  let timeline = null;
  function buildTimeline() {
    const years = mine.map((m) => m.year);
    const y0 = Math.min(...years), y1 = Math.max(...years);
    const left = narrow ? W * 0.08 : W * 0.42, right = W * 0.95;
    const base = narrow ? H * 0.52 : H * 0.8; // on phones the chapter card docks at the bottom
    const step = (right - left) / (y1 - y0);
    const gap = Math.min(11, Math.max(7, step * 0.55));
    const order = { cell: 0, viz: 1, ai: 2 };
    const pos = {};
    for (let y = y0; y <= y1; y++) {
      mine.filter((m) => m.year === y).sort((a, b) => order[a.field] - order[b.field]).forEach((m, k) => {
        pos[m.i] = [left + (y - y0) * step, base - gap / 2 - k * gap];
      });
    }
    timeline = { pos, y0, y1, left, step, base };
  }

  // list: listed papers fly to their bullet; everything else flies into the "all papers" link
  const listed = mine.filter((m) => PAPERS.has(m.kind)).sort((a, b) => b.year - a.year || a.i - b.i).slice(0, 6);
  function listTarget(m) {
    const b = document.querySelector(`.bullet[data-i="${m.i}"]`) || document.getElementById("all-papers");
    if (!b) return [W / 2, H / 2];
    const r = b.getBoundingClientRect();
    return b.classList.contains("bullet") ? [r.left + r.width / 2, r.top + r.height / 2] : [r.left + 14, r.top + r.height / 2];
  }

  // ---------- theme callouts (overview only) ----------
  let callouts = null;
  function buildCallouts() {
    const cam = camFor("all");
    const pts = bg.map((p) => project(cam, p[0], p[1])[0]);
    // widest near-empty vertical band in the background holds the labels
    const B = 60, minx = Math.min(...pts), maxx = Math.max(...pts), hist = new Array(B).fill(0);
    for (const x of pts) hist[Math.min(B - 1, Math.floor(((x - minx) / (maxx - minx)) * B))]++;
    let bs = 0, be = -1, cs = null;
    for (let i = 0; i <= B; i++) {
      if (i < B && hist[i] <= bg.length * 0.002) { if (cs === null) cs = i; }
      else if (cs !== null) { if (i - cs > be - bs + 1) { bs = cs; be = i - 1; } cs = null; }
    }
    const gx = (b) => minx + (b / B) * (maxx - minx);
    const colL = gx(bs) + 10, colR = gx(be + 1) - 10;
    const items = [];
    for (const [key, th] of Object.entries(THEMES)) {
      const ms = mine.filter((m) => m.theme === key);
      if (!ms.length) continue;
      const P = ms.map((m) => mapTarget(m, cam));
      const near = (i) => P.filter((q) => Math.hypot(q[0] - P[i][0], q[1] - P[i][1]) < 30).length;
      let med = 0;
      P.forEach((_, i) => { if (near(i) > near(med)) med = i; });
      const side = P[med][0] < (colL + colR) / 2 ? "L" : "R";
      const core = P.filter((q) => Math.hypot(q[0] - P[med][0], q[1] - P[med][1]) < 30);
      const yrs = ms.map((m) => m.year);
      items.push({ key, th, side, core, y: P[med][1], cy: P[med][1], n: ms.length, span: `${Math.min(...yrs)}–${String(Math.max(...yrs)).slice(-2)}` });
    }
    const col = [...items].sort((a, b) => a.cy - b.cy);
    for (let i = 1; i < col.length; i++) col[i].y = Math.max(col[i].y, col[i - 1].y + 36);
    const over = col.length ? col[col.length - 1].y - (H - 30) : 0;
    if (over > 0) col.forEach((t) => (t.y -= over));
    for (const t of items) {
      t.lx = t.side === "L" ? colL : colR;
      let best = t.core[0], bd = Infinity;
      for (const q of t.core) { const d = Math.abs(q[0] - t.lx) + Math.abs(q[1] - t.y) * 0.3; if (d < bd) { bd = d; best = q; } }
      t.anchor = best;
    }
    callouts = narrow ? [] : items;
  }

  // ---------- animation state ----------
  let current = "hero", from = null, t0 = 0, DUR = reduce ? 1 : 1100;
  let camFrom = null, camTo = camFor("hero");
  let filter = "all", hoverTheme = null, hoverDot = null;
  const cur = mine.map(() => [0, 0]);  // drawn positions
  const start = mine.map(() => [0, 0]); // positions when the current transition started
  const alpha = mine.map(() => 1), alphaFrom = mine.map(() => 1);
  let bgA = 1, bgFrom = 1, coA = 0, coFrom = 0, tlA = 0, tlFrom = 0;

  function go(step) {
    if (!STEPS[step] || step === current) return;
    from = current; current = step;
    t0 = performance.now();
    camFrom = { ...camNow() };
    camTo = camFor(step);
    for (let i = 0; i < mine.length; i++) { start[i] = [...cur[i]]; alphaFrom[i] = alpha[i]; }
    bgFrom = bgA; coFrom = coA; tlFrom = tlA;
    document.body.dataset.step = step;
    document.body.classList.toggle("listed", false);
  }
  let camState = null;
  const camNow = () => camState || camTo;

  function targetFor(m, cam) {
    const L = STEPS[current].layout;
    if (L === "timeline") return timeline.pos[m.i];
    if (L === "list") return listTarget(m);
    return mapTarget(m, cam);
  }
  function targetAlpha(m) {
    const s = STEPS[current];
    if (s.layout === "list") return listed.includes(m) ? 1 : 0;
    if (filter === "papers" && !PAPERS.has(m.kind) && s.layout === "map") return 0.12;
    const focus = hoverTheme ? [hoverTheme] : s.focus;
    if (focus && !focus.includes(m.theme)) return 0.22;
    return s.dots;
  }

  // ---------- draw loop ----------
  function frame(now) {
    const p = from === null ? 1 : clamp01((now - t0) / DUR);
    const e = ease(p);
    // camera
    camState = camFrom ? { cx: lerp(camFrom.cx, camTo.cx, e), cy: lerp(camFrom.cy, camTo.cy, e), k: lerp(camFrom.k, camTo.k, e), ox: lerp(camFrom.ox, camTo.ox, e), oy: lerp(camFrom.oy, camTo.oy, e) } : camTo;
    const cam = camState;
    const S = STEPS[current];
    bgA = lerp(bgFrom, S.bg, e);
    coA = lerp(coFrom, S.callouts ? 1 : 0, clamp01((p - 0.5) * 2));
    tlA = lerp(tlFrom, S.layout === "timeline" ? 1 : 0, e);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const dark = isDark();

    // clouds
    if (clouds && bgA > 0.01) {
      const [sx, sy] = project(cam, ext.x0 - clouds.pad, ext.y1 + clouds.pad);
      const sc = cam.k / cloudRes;
      ctx.globalAlpha = bgA;
      ctx.drawImage(clouds, sx, sy, clouds.width * sc, clouds.height * sc);
      // grain, gently twinkling
      const tw = now / 1400;
      for (let i = 0; i < bg.length; i++) {
        const q = bg[i];
        const [x, y] = project(cam, q[0], q[1]);
        if (x < -4 || y < -4 || x > W + 4 || y > H + 4) continue;
        ctx.globalAlpha = bgA * (dark ? 0.55 + 0.35 * Math.sin(tw + i * 1.7) : 0.45);
        ctx.fillStyle = fieldColors[q[2]];
        const s = dark ? 1.3 : 1.5;
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
      }
    }

    // timeline axis
    if (tlA > 0.01 && timeline) {
      ctx.globalAlpha = tlA;
      ctx.strokeStyle = css("--hair");
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(timeline.left - 10, timeline.base + 4); ctx.lineTo(timeline.left + timeline.step * (timeline.y1 - timeline.y0) + 10, timeline.base + 4);
      ctx.stroke();
      ctx.fillStyle = css("--muted");
      ctx.font = `11px ${css("--mono")}`;
      ctx.textAlign = "center";
      for (let y = timeline.y0; y <= timeline.y1; y++) {
        if (narrow && (y - timeline.y0) % 3) continue;
        ctx.fillText(String(y), timeline.left + (y - timeline.y0) * timeline.step, timeline.base + 20);
      }
    }

    // callouts
    if (coA > 0.01 && callouts) {
      for (const t of callouts) {
        const on = hoverTheme === t.key, off = hoverTheme && !on;
        ctx.globalAlpha = coA * (off ? 0.35 : 1);
        const dir = t.side === "L" ? 1 : -1;
        ctx.strokeStyle = on ? css("--ink") : css("--muted");
        ctx.lineWidth = on ? 1.4 : 1;
        ctx.beginPath();
        const [ax, ay] = t.anchor;
        ctx.moveTo(ax + dir * (R + 3), ay);
        ctx.bezierCurveTo((ax + t.lx) / 2, ay, (ax + t.lx) / 2, t.y - 4, t.lx - dir * 4, t.y - 4);
        ctx.stroke();
        ctx.fillStyle = fieldColors[t.th.field];
        ctx.beginPath(); ctx.arc(t.lx + dir * 4, t.y - 8, 4, 0, 6.283); ctx.fill();
        ctx.textAlign = t.side === "L" ? "left" : "right";
        ctx.font = `600 13px ${css("--sans")}`;
        ctx.fillStyle = css("--ink");
        ctx.fillText(t.th.label, t.lx + dir * 13, t.y - 4);
        ctx.font = `11px ${css("--mono")}`;
        ctx.fillStyle = css("--ink-2");
        ctx.fillText(`${t.span} · ${tr("outputs", t.n)}`, t.lx + dir * 13, t.y + 11);
        const w = Math.max(ctx.measureText(t.th.label).width * 1.15, 150);
        t.hit = t.side === "L" ? [t.lx, t.y - 20, w + 20, 38] : [t.lx - w - 20, t.y - 20, w + 20, 38];
      }
    }

    // my dots (staggered flight between layouts)
    const done = p >= 1;
    for (const m of mine) {
      const i = m.i;
      const tgt = targetFor(m, cam);
      const delay = (S.layout !== STEPS[from || current].layout) ? (m.year - 2011) / 15 * 0.35 : 0;
      const q = ease(clamp01((p - delay) / (1 - 0.35 * (delay > 0))));
      cur[i] = [lerp(start[i][0], tgt[0], q), lerp(start[i][1], tgt[1], q)];
      alpha[i] = lerp(alphaFrom[i], targetAlpha(m), q);
    }
    const listDone = current === "list" && done;
    document.body.classList.toggle("listed", listDone);
    if (!listDone) {
      const fieldMix = tlA;
      for (const m of mine) {
        const a = alpha[m.i];
        if (a < 0.02) continue;
        const [x, y] = cur[m.i];
        if (x < -10 || y < -10 || x > W + 10 || y > H + 10) continue;
        ctx.globalAlpha = a;
        const hot = hoverDot === m;
        const col = fieldMix > 0.5 || current === "list" ? fieldColors[m.field] : dark ? "#ffffff" : css("--ink");
        if (dark) { ctx.shadowColor = fieldColors[m.field]; ctx.shadowBlur = hot ? 16 : 8; }
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(x, y, hot ? R + 1.5 : R, 0, 6.283); ctx.fill();
        ctx.shadowBlur = 0;
        if (!dark) { ctx.strokeStyle = css("--surface"); ctx.lineWidth = 1.2; ctx.stroke(); }
      }
    }
    ctx.globalAlpha = 1;
    if (done && from !== null) { from = null; camFrom = null; }
    requestAnimationFrame(frame);
  }

  // ---------- latest papers list (bullets the dots land on) ----------
  const latest = document.getElementById("latest-pubs");
  if (latest) {
    latest.innerHTML = listed.map((m) => `
      <a class="lp" href="${m.doi ? `https://doi.org/${esc(m.doi)}` : `publications.html#${esc(m.id)}`}" ${m.doi ? 'target="_blank" rel="noopener"' : ""}>
        <span class="bullet" data-i="${m.i}" style="background:var(${FIELD_VAR[m.field]})"></span>
        <span class="lp-y mono">${m.year}</span>
        <span class="lp-t">${esc(m.title)}</span>
        <span class="lp-v">${esc(m.venue)}</span>
      </a>`).join("");
  }
  const method = document.getElementById("method");
  const setMethod = () => { if (method) method.textContent = tr("method", mine.length, bg.length.toLocaleString(window.I18N.lang === "sl" ? "sl-SI" : "en-GB"), data.model.split("/").pop(), data.generated); };
  setMethod();
  addEventListener("langchange", setMethod);

  // ---------- step detection ----------
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) go(en.target.dataset.step);
  }, { rootMargin: "-45% 0px -45% 0px" });
  document.querySelectorAll(".step").forEach((s) => io.observe(s));

  // ---------- pointer: tooltips, theme hover, click ----------
  function showTip(html, x, y) {
    tip.innerHTML = html;
    tip.classList.add("show");
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let left = x + 16, top = y + 16;
    if (left + tw > W - 8) left = x - tw - 16;
    if (top + th > H - 8) top = y - th - 16;
    tip.style.left = Math.max(8, left) + "px"; tip.style.top = Math.max(8, top) + "px";
  }
  const hideTip = () => tip.classList.remove("show");
  function dotAt(x, y) {
    let best = null, bd = 100;
    for (const m of mine) {
      if (alpha[m.i] < 0.15) continue;
      const d = (cur[m.i][0] - x) ** 2 + (cur[m.i][1] - y) ** 2;
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  }
  addEventListener("mousemove", (e) => {
    if (e.target.closest && e.target.closest(".card, .nav, .after, footer, .tip")) { if (hoverDot || hoverTheme) { hoverDot = null; hoverTheme = null; hideTip(); } return; }
    if (current === "list" && document.body.classList.contains("listed")) return;
    const x = e.clientX, y = e.clientY;
    const d = dotAt(x, y);
    hoverDot = d;
    if (d) {
      const th = THEMES[d.theme];
      hoverTheme = STEPS[current].layout === "map" ? d.theme || null : null;
      document.body.style.cursor = "pointer";
      return showTip(`<div class="t">${esc(d.title)}</div><div class="m mono">${esc(d.venue)} · ${d.year}</div>${th ? `<div class="k"><i style="background:${fieldColors[th.field]}"></i>${esc(th.label)}</div>` : ""}`, x, y);
    }
    document.body.style.cursor = "";
    const co = coA > 0.5 && callouts && callouts.find((t) => t.hit && x >= t.hit[0] && x <= t.hit[0] + t.hit[2] && y >= t.hit[1] && y <= t.hit[1] + t.hit[3]);
    hoverTheme = co ? co.key : null;
    if (co) { document.body.style.cursor = "pointer"; return hideTip(); }
    if (STEPS[current].layout === "map" && bgA > 0.5) {
      const cam = camNow();
      let best = null, bd = 36;
      for (const q of bg) {
        const [px, py] = project(cam, q[0], q[1]);
        const dd = (px - x) ** 2 + (py - y) ** 2;
        if (dd < bd) { bd = dd; best = q; }
      }
      if (best) {
        const c = data.clusters.find((c) => c.id === best[3]);
        return showTip(`<div class="k"><i style="background:${fieldColors[best[2]]}"></i>${FIELD_NAME[best[2]]} · ${tr("literature")}</div>${c ? `<div class="m mono">${tr("topic")}: ${esc(c.label)}</div>` : ""}`, x, y);
      }
    }
    hideTip();
  });
  addEventListener("click", (e) => {
    if (e.target.closest && e.target.closest("a, button, .card, .nav, .after, footer")) return;
    const d = dotAt(e.clientX, e.clientY);
    if (!d) return;
    const url = d.doi ? `https://doi.org/${d.doi}` : d.url || (PAPERS.has(d.kind) ? `publications.html#${d.id}` : null);
    if (url) window.open(url, url.startsWith("http") ? "_blank" : "_self");
  });
  addEventListener("scroll", () => { hideTip(); hoverDot = null; }, { passive: true });

  document.querySelectorAll("[data-filter]").forEach((b) => b.addEventListener("click", () => {
    filter = b.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach((x) => x.setAttribute("aria-pressed", x === b));
    for (let i = 0; i < mine.length; i++) { start[i] = [...cur[i]]; alphaFrom[i] = alpha[i]; }
    from = current; t0 = performance.now() - DUR * 0.6;
  }));

  // ---------- boot ----------
  function relayout() {
    resize();
    relaxOffsets();
    buildTimeline();
    buildCallouts();
    camTo = camFor(current); camFrom = null; camState = null;
    for (const m of mine) { cur[m.i] = targetFor(m, camTo); alpha[m.i] = targetAlpha(m); }
  }
  relayout();
  let rt;
  addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(relayout, 150); });
  addEventListener("themechange", () => { buildClouds(); });
  requestAnimationFrame(frame);
})();
