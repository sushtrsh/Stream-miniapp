const tg = window.Telegram && Telegram.WebApp;
if (tg) {
  tg.ready(); tg.expand();
  try { tg.setHeaderColor("#0c0b10"); tg.setBackgroundColor("#0c0b10"); tg.disableVerticalSwipes(); } catch {}
}
const app = document.getElementById("app");
const stack = [];
let acts = {};

const I = {
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M8 5.2v13.6a.8.8 0 0 0 1.2.7l11-6.8a.8.8 0 0 0 0-1.4L9.2 4.5A.8.8 0 0 0 8 5.2z"/></svg>',
  ext: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  check: '<svg class="ck" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="M12 3.4l2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.2 5.9-.8z"/></svg>',
  warn: '<svg viewBox="0 0 24 24"><path d="M12 8v5M12 16.5v.01M10.3 4.4L2.8 17.5A2 2 0 0 0 4.5 20.5h15a2 2 0 0 0 1.7-3L13.7 4.4a2 2 0 0 0-3.4 0z"/></svg>',
};
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const last = (s) => String(s).split("/").filter(Boolean).pop();
const tap = () => { try { tg.HapticFeedback.impactOccurred("light"); } catch {} };
const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const img = (src) => src ? `<img src="${esc(src)}" referrerpolicy="no-referrer" decoding="async" alt="" onerror="this.remove()">` : "";
const posterOf = (a) => a.poster || store.get("poster:" + a.slug, "");

/* ---------- pembaca data (tahan terhadap bentuk JSON yang beda) ---------- */
function findEpisodes(o, d = 0) {
  if (!o || typeof o !== "object" || d > 4) return null;
  for (const [k, v] of Object.entries(o))
    if (/episode/i.test(k) && Array.isArray(v) && v.length && typeof v[0] === "object") return v;
  for (const v of Object.values(o)) { const r = findEpisodes(v, d + 1); if (r) return r; }
  return null;
}
function collectLinks(o, path = "", out = []) {
  if (typeof o === "string") {
    if (/^https?:\/\//.test(o) && /stream|embed|iframe|player|server/i.test(path) && !/download|dl|batch/i.test(path)) out.push(o);
  } else if (o && typeof o === "object") {
    for (const [k, v] of Object.entries(o)) collectLinks(v, path ? path + "." + k : k, out);
  }
  return out;
}
function collectServers(o, out = [], q = "") {
  if (Array.isArray(o)) o.forEach((x) => collectServers(x, out, q));
  else if (o && typeof o === "object") {
    const id = o.serverId ?? o.server_id ?? o.serverID;
    if (typeof id === "string" || typeof id === "number") {
      const name = String(o.name || o.server || o.title || o.quality || "").trim();
      out.push({ id: String(id), q, name, label: [q, name].filter(Boolean).join(" ") });
    }
    const nq = Array.isArray(o.serverList) ? String(o.title || "").trim() : q;
    Object.values(o).forEach((v) => collectServers(v, out, nq));
  }
  return out;
}
function pickUrl(o, d = 0) {
  if (typeof o === "string") return /^https?:\/\//.test(o) ? o : "";
  if (!o || typeof o !== "object" || d > 5) return "";
  for (const [k, v] of Object.entries(o))
    if (/url|embed|src|iframe|link/i.test(k)) { const r = pickUrl(v, d + 1); if (r) return r; }
  for (const v of Object.values(o)) { const r = pickUrl(v, d + 1); if (r) return r; }
  return "";
}

/* ---------- navigasi ---------- */
function go(fn) { stack.push(fn); render(); }
function swap(fn) { stack[stack.length - 1] = fn; render(); }
function back() { if (stack.length > 1) { stack.pop(); render(); } }
function render() {
  window.scrollTo(0, 0);
  stack[stack.length - 1]();
  if (tg) stack.length > 1 ? tg.BackButton.show() : tg.BackButton.hide();
}
if (tg) tg.BackButton.onClick(back);
app.addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]");
  if (!b || !acts[b.dataset.act]) return;
  tap();
  acts[b.dataset.act](b);
});
const bar = () => (!tg && stack.length > 1 ? `<div class="nb"><button class="rb" data-act="back" aria-label="Kembali">${I.back}</button></div>` : "");
function show(html, o = {}) {
  app.innerHTML = `<div class="page${o.still ? " still" : ""}${o.cta ? " hascta" : ""}">${html}</div>${o.cta || ""}`;
}
function showError(e) {
  show(`${bar()}<div class="err"><div class="eic">${I.warn}</div><h1>Gagal memuat</h1><p>${esc(e.message)}. Server sumber kadang error atau kena batas request.</p><button class="btn pri" data-act="retry">Coba lagi</button></div>`);
  acts = { back, retry: () => render() };
}

/* ---------- detail ---------- */
async function detail(a) {
  show(`${bar()}<div class="sk" style="height:200px;margin-top:18px"></div><div class="sk" style="height:18px;margin-top:22px;width:70%"></div><div class="sk" style="height:18px;margin-top:10px"></div><div class="eps" style="margin-top:28px">${'<div class="sk" style="height:54px"></div>'.repeat(8)}</div>`, { still: true });
  acts = { back };
  try {
    const d = await api("detail/" + encodeURIComponent(a.slug) + "?s=" + a.source);
    const x = d.data || d;
    const eps = findEpisodes(d);
    if (!eps) throw new Error("daftar episode tidak ditemukan");
    const seen = new Set(store.get("seen:" + a.slug, []));
    const lw = store.get("last", {})[a.slug];
    const poster = a.poster || x.poster || x.image || x.thumbnail || posterOf(a);
    if (poster) store.set("poster:" + a.slug, poster);
    const syn = x.synopsis && Array.isArray(x.synopsis.paragraphs) ? x.synopsis.paragraphs.join(" ") : "";
    const mt = [x.status, x.type, x.episodes && x.episodes + " eps"].filter(Boolean).join(" · ");
    const meta = (x.score ? `<span class="sc">${I.star}${esc(x.score)}</span>` : "") + (mt ? `<span class="mt">${esc(mt)}</span>` : "");
    const gen = (x.genreList || []).slice(0, 4).map((g) => `<span class="chip">${esc(g.title)}</span>`).join("");
    const order = store.get("order", "new");
    const asc = eps.every((e) => typeof e.eps === "number") ? [...eps].sort((p, q) => p.eps - q.eps) : [...eps].reverse();
    const list = order === "old" ? asc : [...asc].reverse();
    const idOf = (ep) => last(ep.episodeId || ep.slug || ep.endpoint || ep.id || "");
    const lab = (ep, i) => (ep.eps != null ? "Ep " + ep.eps : String(ep.title || ep.episode || ep.name || "Ep " + (i + 1)).slice(0, 12));
    const first = asc[0];
    const cta = `<div class="cta"><button class="btn pri" data-act="play" data-id="${esc(lw ? lw.id : idOf(first))}" data-l="${esc(lw ? lw.label : lab(first, 0))}">${I.play.replace("<svg", '<svg class="pf"')}${lw ? "Lanjutkan " + esc(lw.label) : "Mulai " + esc(lab(first, 0))}</button></div>`;

    show(`<div class="bd">${img(poster)}</div>${bar()}
      <div class="top"><div class="pst">${img(poster)}</div>
        <div class="tt"><h1>${esc(a.title)}</h1><div class="meta">${meta}</div><div class="gen">${gen}</div><button class="btn ghost sm" onclick="toggleColl(this)" data-src="${esc(a.source)}" data-slug="${esc(a.slug)}" data-title="${esc(a.title)}" data-poster="${esc(poster)}">${collLabel(a)}</button></div></div>
      ${syn ? `<p class="syn" id="syn">${esc(syn)}</p><button class="link" data-act="more">Selengkapnya</button>` : ""}
      <div class="sh"><h2>Episode<span>${eps.length}</span></h2>
        <div class="seg"><button data-act="order" data-o="new" class="${order === "new" ? "on" : ""}">Terbaru</button><button data-act="order" data-o="old" class="${order === "old" ? "on" : ""}">Terlama</button></div></div>
      <div class="eps">${list.map((ep, i) => {
        const id = idOf(ep), l = lab(ep, i);
        return `<button class="ep${seen.has(id) ? " seen" : ""}${lw && lw.id === id ? " cur" : ""}" data-act="play" data-id="${esc(id)}" data-l="${esc(l)}">${esc(l)}${seen.has(id) && !(lw && lw.id === id) ? I.check : ""}</button>`;
      }).join("")}</div>`, { cta });
    acts = {
      back,
      more: (b) => { const s = document.getElementById("syn"); s.classList.toggle("open"); b.textContent = s.classList.contains("open") ? "Sembunyikan" : "Selengkapnya"; },
      order: (b) => { store.set("order", b.dataset.o); render(); },
      play: (b) => go(() => play(a, b.dataset.id, b.dataset.l)),
    };
  } catch (e) { showError(e); }
}

/* ---------- player ---------- */
async function play(a, id, label) {
  show(`${bar()}<div class="stick"><div class="pl"><div class="spin"></div></div></div><div class="sk" style="height:20px;width:60%"></div>`, { still: true });
  acts = { back };
  try {
    const d = await api(`episode/${encodeURIComponent(id)}?s=${encodeURIComponent(a.source)}`);
    const x = d.data || d;

    const no = String(x.title || "").match(/Episode\s*(\d+)/i);
    const lbl = no ? "Ep " + no[1] : label;
    const lw = store.get("last", {}); lw[a.slug] = { id, label: lbl, t: Date.now() }; store.set("last", lw);
    const sn = new Set(store.get("seen:" + a.slug, [])); sn.add(id); store.set("seen:" + a.slug, [...sn]);

    const opts = [], su = new Set(), ss = new Set();
    const addUrl = (u, l) => { if (u && !su.has(u)) { su.add(u); opts.push({ url: u, label: l, q: "", name: l }); } };
    addUrl(x.defaultStreamingUrl, "Utama");
    collectLinks(d).forEach((u) => addUrl(u, "Server"));
    collectServers(d).forEach((s) => { if (!ss.has(s.id)) { ss.add(s.id); opts.push(s); } });
    if (!opts.length) throw new Error("link nonton tidak ditemukan");

    const gk = [], groups = {};
    opts.forEach((o, i) => { const k = o.q || ""; if (!groups[k]) { groups[k] = []; gk.push(k); } groups[k].push([o, i]); });
    gk.sort((p, q) => (p === "" ? -1 : q === "" ? 1 : 0));

    const pv = x.prevEpisode && x.prevEpisode.episodeId, nx = x.nextEpisode && x.nextEpisode.episodeId;
    show(`${bar()}<div class="stick"><div class="pl" id="pl"><div class="spin"></div></div></div>
      <div class="pi"><div class="pt"><small>${esc(a.title)}</small><h1>${esc(x.title || label)}</h1></div>
        <button class="rb" data-act="ext" aria-label="Buka di browser">${I.ext}</button></div>
      ${pv || nx ? `<div class="nv">${pv ? `<button class="btn ghost" data-act="nav" data-id="${esc(pv)}">${I.back}Sebelumnya</button>` : ""}${nx ? `<button class="btn ghost" data-act="nav" data-id="${esc(nx)}">Berikutnya${I.next}</button>` : ""}</div>` : ""}
      <div class="tabs" id="tabs"></div><div class="pills" id="pills"></div>
      <p class="note">Layar kosong atau ikon sedih? Coba server lain, atau buka di browser lewat tombol di kanan atas judul.</p>`);

    let cur = -1, activeG = "", curUrl = "";
    const drawSrv = () => {
      document.getElementById("tabs").innerHTML = gk.map((k) => `<button class="tab${k === activeG ? " on" : ""}" data-act="tab" data-g="${esc(k)}">${esc(k || "Utama")}</button>`).join("");
      document.getElementById("pills").innerHTML = groups[activeG].map(([o, i]) => `<button class="pill${i === cur ? " on" : ""}" data-act="srv" data-i="${i}">${esc(activeG ? o.name || o.label : o.label)}</button>`).join("");
    };
    const choose = async (i) => {
      cur = i; activeG = opts[i].q || ""; drawSrv();
      const o = opts[i], pl = document.getElementById("pl");
      store.set("pref", o.label);
      pl.innerHTML = '<div class="spin"></div>';
      try {
        let u = o.url;
        if (!u) {
          const s = await api(`server/${encodeURIComponent(o.id)}?s=${encodeURIComponent(a.source)}`);
          u = pickUrl(s);
          if (!u) throw new Error("link server tidak ditemukan");
        }
        if (cur !== i) return;
        curUrl = u;
        pl.innerHTML = /\.(mp4|m3u8|webm)(\?|$)/i.test(u)
          ? `<video src="${esc(u)}" controls playsinline></video>`
          : `<iframe src="${esc(u)}" allowfullscreen allow="fullscreen; autoplay" referrerpolicy="no-referrer"></iframe>`;
      } catch (e) { if (cur === i) pl.textContent = "Server ini gagal: " + e.message; }
    };
    acts = {
      back,
      tab: (b) => { activeG = b.dataset.g; drawSrv(); if (groups[activeG].length === 1) choose(groups[activeG][0][1]); },
      srv: (b) => choose(+b.dataset.i),
      nav: (b) => swap(() => play(a, b.dataset.id, "Episode")),
      ext: () => { if (curUrl) tg ? tg.openLink(curUrl) : window.open(curUrl, "_blank"); },
    };
    const pref = store.get("pref", "");
    const qn = (o) => parseInt(o.q) || 0;
    let best = 0, bs = -1;
    opts.forEach((o, i) => { const s = (o.label === pref ? 100 : 0) + (/vidhide/i.test(o.name) ? 10 + qn(o) / 100 : 0); if (s > bs) { bs = s; best = i; } });
    choose(best);
  } catch (e) { showError(e); }
}


/* ---------- koleksi (disimpan di perangkat) ---------- */
Object.assign(I, {
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
});
const coll = () => {
  let c = store.get("mine", null);
  if (!Array.isArray(c)) {
    c = ANIME.map((a) => ({ source: a.source, slug: a.slug, title: a.title, poster: a.poster || "" }));
    store.set("mine", c);
  }
  return c;
};
const inColl = (slug) => coll().some((a) => a.slug === slug);
const addColl = (a) => {
  const c = coll();
  if (!c.some((x) => x.slug === a.slug)) { c.unshift({ source: a.source, slug: a.slug, title: a.title, poster: a.poster || "" }); store.set("mine", c); }
};
const delColl = (slug) => store.set("mine", coll().filter((a) => a.slug !== slug));
const collLabel = (a) => (inColl(a.slug) ? I.check + "Di koleksi" : I.plus + "Tambah ke koleksi");
function toggleColl(b) {
  const a = { source: b.dataset.src, slug: b.dataset.slug, title: b.dataset.title, poster: b.dataset.poster };
  inColl(a.slug) ? delColl(a.slug) : addColl(a);
  b.innerHTML = collLabel(a);
  tap();
}
const redraw = () => stack[stack.length - 1]();
let editing = false, sq = "", sres = null, sraw = "";

/* ---------- pencarian ---------- */
function findAnimeList(o, d = 0) {
  if (!o || typeof o !== "object" || d > 4) return [];
  if (Array.isArray(o))
    return o.length && o.some((x) => x && typeof x === "object" && (x.animeId || x.slug) && x.title) ? o : [];
  for (const v of Object.values(o)) { const r = findAnimeList(v, d + 1); if (r.length) return r; }
  return [];
}
function resCard(a, i) {
  const on = inColl(a.slug);
  return `<div class="card"><button class="cb" data-act="view" data-i="${i}"><div class="im">${a.poster ? img(a.poster) : `<div class="ph">${esc(a.title.charAt(0))}</div>`}</div><p>${esc(a.title)}</p>${a.sub ? `<small class="sm">${esc(a.sub)}</small>` : ""}</button><button class="addb${on ? " on" : ""}" data-act="add" data-i="${i}" aria-label="Tambah ke koleksi">${on ? I.check : I.plus}</button></div>`;
}
function drawRes() {
  const el = document.getElementById("res");
  if (!el) return;
  if (!sres) el.innerHTML = '<div class="empty"><p>Ketik judul anime, lalu tekan Cari.</p></div>';
  else if (!sres.length) el.innerHTML = `<div class="empty"><p>Tidak ada hasil untuk “${esc(sq)}”.</p>${sraw ? `<details class="raw"><summary>Data mentah</summary><pre>${esc(sraw)}</pre></details>` : ""}</div>`;
  else el.innerHTML = `<div class="grid">${sres.map(resCard).join("")}</div>`;
}
async function doSearch() {
  const q = document.getElementById("q").value.trim();
  if (q.length < 2) return;
  sq = q; sres = null;
  const el = document.getElementById("res");
  el.innerHTML = `<div class="grid">${'<div><div class="sk" style="aspect-ratio:2/3"></div></div>'.repeat(4)}</div>`;
  try {
    const d = await api("search/" + encodeURIComponent(q) + "?s=otakudesu");
    sres = findAnimeList(d).map((x) => ({
      source: "otakudesu",
      slug: String(x.animeId || x.slug || last(x.href || "")),
      title: String(x.title || ""),
      poster: x.poster || x.image || x.thumbnail || "",
      sub: [x.status, x.score && "★ " + x.score].filter(Boolean).join(" · "),
    })).filter((x) => x.slug && x.title);
    sraw = sres.length ? "" : JSON.stringify(d, null, 1).slice(0, 1500);
    if (document.getElementById("res") === el) drawRes();
  } catch (e) {
    if (document.getElementById("res") === el) el.innerHTML = `<div class="empty"><p>Gagal mencari (${esc(e.message)}). Coba lagi sebentar lagi.</p></div>`;
  }
}
function search() {
  show(`${bar()}<div class="sb"><div class="sbw">${I.search}<input id="q" type="search" enterkeyhint="search" placeholder="Cari judul anime…" autocomplete="off" value="${esc(sq)}"></div><button class="btn pri sbtn" data-act="find">Cari</button></div><div id="res"></div>`, { still: true });
  document.getElementById("q").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); doSearch(); } });
  acts = {
    back,
    find: doSearch,
    view: (b) => go(() => detail(sres[b.dataset.i])),
    add: (b) => {
      const a = sres[b.dataset.i];
      inColl(a.slug) ? delColl(a.slug) : addColl(a);
      const on = inColl(a.slug);
      b.classList.toggle("on", on);
      b.innerHTML = on ? I.check : I.plus;
    },
  };
  drawRes();
  if (!sres) document.getElementById("q").focus();
}

go(home);
