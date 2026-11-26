// English / Slovenian. Static text in the pages carries data-i18n (text) or data-i18n-html (markup) keys;
// scripts call I18N.t(key) and I18N.L(obj, field) (reads field_sl from the data files when in Slovenian).
// Choice order: ?lang= in the URL, then the visitor's saved choice, then the browser language.
window.I18N = (function () {
  const sl3 = (n, one, two, few, many) => { const m = n % 100; return m === 1 ? one : m === 2 ? two : m === 3 || m === 4 ? few : many; };
  const D = {
    en: {
      "nav.projects": "Projects", "nav.publications": "Publications", "nav.teaching": "Teaching",
      "theme.light": "Light", "theme.dark": "Dark", "lang.other": "SL", "lang.otherName": "Slovenščina",
      "hero.kicker": "cell biology × data visualization × AI",
      "hero.lede": 'I started out watching <span class="hl hl-cell">single vesicles fuse with the cell membrane</span>. Now I work on <span class="hl hl-ai">trustworthy AI</span> and <span class="hl hl-viz">data visualization</span> at the Department of Artificial Intelligence, Jožef Stefan Institute, and I am a guest lecturer at <b>Uppsala University</b>.',
      "email": "Email", "photo": "Photo: Jože Suhadolnik / Delo", "scroll": "scroll to explore the map ↓",
      "cell.kicker": "I · cell biology · 2011–2021", "cell.h": "Watching single vesicles fuse",
      "cell.p": "For my PhD at the University of Ljubljana and my postdoc at Uppsala University I recorded single vesicles fusing with the cell membrane. I measured fusion pores in astrocytes and insulin-secreting β-cells with electrophysiology and super-resolution microscopy.",
      "cell.note": "The bright dots are my 40 outputs from those years. The teal cloud is 1,500 cell-biology papers placed by what their abstracts say.",
      "viz.kicker": "II · data visualization · 2021–", "viz.h": "Making data speak",
      "viz.p": "Explaining very specialised results to other people pulled me towards data visualization. I design visual stories for health and rare-disease data, speak and write about effective scientific figures, and lead a PhD course on data visualization for life science at Uppsala University.",
      "ai.kicker": "III · artificial intelligence · 2021–", "ai.h": "Trustworthy AI",
      "ai.p": "At the Department of Artificial Intelligence of the Jožef Stefan Institute I work on trustworthy and unbiased AI for public governance, AI agents that simulate debates on social media, and AI analytics for water and health.",
      "all.kicker": "IV · the whole map", "all.h": "Where it all meets",
      "all.p": "About 4,400 papers from the three fields, with my work among them. Hover over a theme to light up its outputs, or over a dot to see what it is.",
      "filter.all": "All outputs", "filter.papers": "Papers only",
      "tl.kicker": "V · fifteen years", "tl.h": "One dot per output",
      "tl.p": "The same dots, now sorted by year and coloured by the field they sit closest to. Teal gives way to coral and violet.",
      "list.kicker": "VI · latest papers", "list.h": "Recent work", "list.all": "All journal and conference papers →",
      "gate.projects": "Projects", "gate.publications": "Publications", "gate.teaching": "Teaching",
      "gate.projects.n": (a, b) => `${a} current · ${b} past`,
      "gate.pubs.n": (n) => `${n} journal and conference papers`,
      "gate.teach.n": (n) => `${n} courses and trainings`,
      "method": (a, b, model, date) => `Map: ${a} of my outputs among ${b} OpenAlex papers · embedded with ${model} · UMAP · built ${date}`,
      "footer": "© 2026 Alenka Guček · Jožef Stefan Institute, Ljubljana",
      "back": "← back to the map",
      "field.cell": "Cell biology", "field.viz": "Data visualization", "field.ai": "Artificial intelligence",
      "field.cell.l": "cell biology", "field.viz.l": "data visualization", "field.ai.l": "artificial intelligence",
      "literature": "literature", "topic": "topic", "outputs": (n) => `${n} output${n === 1 ? "" : "s"}`,
      "theme.exocytosis": "Exocytosis & fusion pores", "theme.trustworthy": "Trustworthy AI & bias", "theme.social": "Social media & AI agents",
      "theme.water": "AI for water management", "theme.dataviz": "Dataviz & science communication", "theme.health": "Health & rare-disease data",
      "now": "now",
      "proj.kicker": "01 · research", "proj.h": "Projects", "proj.p": "European and national research projects I work on, and the ones that came before.",
      "proj.current": "Current", "proj.past": "Past",
      "pubs.kicker": "02 · papers", "pubs.h": "Publi­cations",
      "pubs.p": 'Journal articles and conference papers. Abstracts, talks, reports and courses are in the <a href="https://bib.cobiss.net/bibliographies/si/webBiblio/bib201_20261125_204723_34319.html" target="_blank" rel="noopener">full COBISS bibliography</a>.',
      "pubs.dotnote": "dot = nearest field on the map", "dot.title": "Nearest field on the map",
      "kind.article": "Journal article", "kind.conference": "Conference paper",
      "teach.kicker": "03 · teaching", "teach.h": "Teaching",
      "teach.p": "Teaching is one of my favourite parts of the work. I give lectures, seminars and hands-on workshops on data visualization and trustworthy AI for researchers, students and professionals, and I am always glad to bring them to new groups. At Uppsala University I have led a PhD course on data visualization since 2021.",
      "teach.ongoing": "ongoing",
    },
    sl: {
      "nav.projects": "Projekti", "nav.publications": "Objave", "nav.teaching": "Poučevanje",
      "theme.light": "Svetlo", "theme.dark": "Temno", "lang.other": "EN", "lang.otherName": "English",
      "hero.kicker": "celična biologija × vizualizacija podatkov × UI",
      "hero.lede": 'Začela sem z opazovanjem <span class="hl hl-cell">posameznih mešičkov, ki se zlivajo s celično membrano</span>. Danes se ukvarjam z <span class="hl hl-ai">zaupanja vredno umetno inteligenco</span> in <span class="hl hl-viz">vizualizacijo podatkov</span> na Odseku za umetno inteligenco Instituta »Jožef Stefan«, kot gostujoča predavateljica pa sodelujem z <b>Univerzo v Uppsali</b>.',
      "email": "E-pošta", "photo": "Foto: Jože Suhadolnik / Delo", "scroll": "podrsajte in raziščite zemljevid ↓",
      "cell.kicker": "I · celična biologija · 2011–2021", "cell.h": "Opazovanje zlivanja posameznih mešičkov",
      "cell.p": "Med doktoratom na Univerzi v Ljubljani in podoktorskim delom na Univerzi v Uppsali sem merila zlivanje posameznih mešičkov s celično membrano. Fuzijske pore v astrocitih in v celicah beta, ki izločajo inzulin, sem preučevala z elektrofiziologijo in mikroskopijo super ločljivosti.",
      "cell.note": "Svetle pike so mojih 40 del iz tega obdobja. Turkizni oblak je 1.500 člankov s področja celične biologije, razvrščenih glede na vsebino povzetkov.",
      "viz.kicker": "II · vizualizacija podatkov · 2021–", "viz.h": "Ko podatki spregovorijo",
      "viz.p": "Želja, da bi zelo specifične rezultate razložila tudi drugim, me je pripeljala do vizualizacije podatkov. Oblikujem vizualne zgodbe za podatke o zdravju in redkih boleznih, predavam in pišem o učinkovitih znanstvenih slikah ter na Univerzi v Uppsali vodim doktorski predmet o vizualizaciji podatkov v znanostih o življenju.",
      "ai.kicker": "III · umetna inteligenca · 2021–", "ai.h": "Zaupanja vredna UI",
      "ai.p": "Na Odseku za umetno inteligenco Instituta »Jožef Stefan« delam na zaupanja vredni in nepristranski UI za javno upravo, na agentih UI, ki simulirajo razprave na družbenih omrežjih, ter na analitiki UI za vode in zdravje.",
      "all.kicker": "IV · celoten zemljevid", "all.h": "Kjer se vse sreča",
      "all.p": "Približno 4.400 člankov s treh področij in med njimi moje delo. Z miško se postavite na temo, da osvetlite njena dela, ali na piko, da vidite, kaj predstavlja.",
      "filter.all": "Vsa dela", "filter.papers": "Samo članki",
      "tl.kicker": "V · petnajst let", "tl.h": "Ena pika za vsako delo",
      "tl.p": "Iste pike, zdaj razvrščene po letih in obarvane glede na področje, ki so mu najbližje. Turkizna se umakne koralni in vijolični.",
      "list.kicker": "VI · najnovejši članki", "list.h": "Nedavno delo", "list.all": "Vsi članki v revijah in na konferencah →",
      "gate.projects": "Projekti", "gate.publications": "Objave", "gate.teaching": "Poučevanje",
      "gate.projects.n": (a, b) => `${a} ${sl3(a, "tekoči", "tekoča", "tekoči", "tekočih")} · ${b} ${sl3(b, "pretekli", "pretekla", "pretekli", "preteklih")}`,
      "gate.pubs.n": (n) => `${n} ${sl3(n, "članek", "članka", "članki", "člankov")} v revijah in na konferencah`,
      "gate.teach.n": (n) => `${n} ${sl3(n, "predmet ali usposabljanje", "predmeta in usposabljanji", "predmeti in usposabljanja", "predmetov in usposabljanj")}`,
      "method": (a, b, model, date) => `Zemljevid: ${a} mojih del med ${b} članki iz OpenAlexa · vložitve ${model} · UMAP · izdelano ${date}`,
      "footer": "© 2026 Alenka Guček · Institut »Jožef Stefan«, Ljubljana",
      "back": "← nazaj na zemljevid",
      "field.cell": "Celična biologija", "field.viz": "Vizualizacija podatkov", "field.ai": "Umetna inteligenca",
      "field.cell.l": "celična biologija", "field.viz.l": "vizualizacija podatkov", "field.ai.l": "umetna inteligenca",
      "literature": "literatura", "topic": "tema", "outputs": (n) => `${n} ${sl3(n, "delo", "deli", "dela", "del")}`,
      "theme.exocytosis": "Eksocitoza in fuzijske pore", "theme.trustworthy": "Zaupanja vredna UI in pristranskost", "theme.social": "Družbena omrežja in agenti UI",
      "theme.water": "UI za upravljanje voda", "theme.dataviz": "Vizualizacija in komunikacija znanosti", "theme.health": "Podatki o zdravju in redkih boleznih",
      "now": "danes",
      "proj.kicker": "01 · raziskave", "proj.h": "Projekti", "proj.p": "Evropski in nacionalni raziskovalni projekti, pri katerih sodelujem, in tisti, ki so bili pred njimi.",
      "proj.current": "Tekoči", "proj.past": "Pretekli",
      "pubs.kicker": "02 · članki", "pubs.h": "Objave",
      "pubs.p": 'Članki v revijah in na konferencah. Povzetki, predavanja, poročila in tečaji so v <a href="https://bib.cobiss.net/bibliographies/si/webBiblio/bib201_20261125_204723_34319.html" target="_blank" rel="noopener">celotni bibliografiji COBISS</a>.',
      "pubs.dotnote": "pika = najbližje področje na zemljevidu", "dot.title": "Najbližje področje na zemljevidu",
      "kind.article": "Članek v reviji", "kind.conference": "Konferenčni članek",
      "teach.kicker": "03 · poučevanje", "teach.h": "Poučevanje",
      "teach.p": "Poučevanje je eden najljubših delov mojega dela. Predavanja, seminarje in praktične delavnice o vizualizaciji podatkov in zaupanja vredni UI pripravljam za raziskovalce, študente in strokovnjake, z veseljem pa jih pripeljem tudi k novim skupinam. Na Univerzi v Uppsali od leta 2021 vodim doktorski predmet o vizualizaciji podatkov.",
      "teach.ongoing": "poteka",
    },
  };

  let lang = "en";
  try {
    const q = new URLSearchParams(location.search).get("lang");
    const saved = localStorage.getItem("lang");
    lang = q === "sl" || q === "en" ? q : saved || ((navigator.language || "").toLowerCase().startsWith("sl") ? "sl" : "en");
  } catch (e) {}

  const t = (key, ...args) => {
    const v = D[lang][key] ?? D.en[key] ?? key;
    return typeof v === "function" ? v(...args) : v;
  };
  // pick a field from a data object: name_sl / summary_sl ... when in Slovenian, falling back to English
  const L = (obj, field) => (lang === "sl" && obj[field + "_sl"] != null ? obj[field + "_sl"] : obj[field]);

  function apply() {
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
    document.querySelectorAll("[data-i18n-html]").forEach((el) => (el.innerHTML = t(el.dataset.i18nHtml)));
    const b = document.getElementById("lang");
    if (b) { b.textContent = t("lang.other"); b.title = t("lang.otherName"); b.setAttribute("aria-label", t("lang.otherName")); }
    const title = document.querySelector("meta[name=i18n-title]");
    if (title) document.title = t(title.content);
  }
  function set(l) {
    lang = l;
    try { localStorage.setItem("lang", l); } catch (e) {}
    apply();
    window.dispatchEvent(new Event("langchange"));
  }
  document.addEventListener("DOMContentLoaded", () => {
    apply();
    document.getElementById("lang")?.addEventListener("click", () => set(lang === "en" ? "sl" : "en"));
  });
  return { t, L, get lang() { return lang; }, set, apply };
})();
