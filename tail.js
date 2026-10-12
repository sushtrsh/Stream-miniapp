
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

/* ---------- beranda ---------- */
function home() {
  const items = coll();
  const lw = store.get("last", {});
  const recent = items.filter((a) => lw[a.slug]).sort((x, y) => (lw[y.slug].t || 0) - (lw[x.slug].t || 0))[0];
  let html = `<header class="hd"><div class="brand"><span class="logo">${I.play}</span>Stream</div></header>
    <button class="sbar" data-act="search">${I.search}Cari anime untuk ditambahkan</button>`;
  if (recent) {
    const l = lw[recent.slug];
    html += `<h2 class="sec">Lanjut menonton</h2>
      <button class="hero" data-act="resume" data-slug="${esc(recent.slug)}">
        <div class="bg" data-pslug="${esc(recent.slug)}">${img(posterOf(recent))}</div><div class="shade"></div>
        <div class="info"><span class="tag">${esc(l.label)}</span><strong>${esc(recent.title)}</strong></div>
        <span class="fab">${I.play}</span></button>`;
  }
  html += `<div class="sec-row"><h2 class="sec">Koleksi <span>${items.length}</span></h2>${items.length ? `<button class="link" data-act="edit">${editing ? "Selesai" : "Edit"}</button>` : ""}</div>`;
  if (!items.length) {
    html += `<div class="empty"><p>Koleksi masih kosong.</p><button class="btn pri" data-act="search">${I.search}Cari anime</button></div>`;
  } else {
    html += '<div class="grid">' + items.map((a, i) => {
      const l = lw[a.slug], p = posterOf(a);
      return `<div class="card" style="--d:${i * 45}ms"><button class="cb" data-act="open" data-i="${i}"><div class="im" data-pslug="${esc(a.slug)}">${p ? img(p) : `<div class="ph">${esc(a.title.charAt(0))}</div>`}${l ? `<span class="badge">${I.play}${esc(l.label)}</span>` : ""}</div><p>${esc(a.title)}</p></button>${editing ? `<button class="rm" data-act="del" data-i="${i}" aria-label="Hapus dari koleksi">${I.x}</button>` : ""}</div>`;
    }).join("") + "</div>";
  }
  show(html, { still: editing });
  acts = {
    search: () => go(search),
    edit: () => { editing = !editing; redraw(); },
    open: (b) => go(() => detail(items[b.dataset.i])),
    del: (b) => { delColl(items[b.dataset.i].slug); redraw(); },
    resume: (b) => { const a = items.find((x) => x.slug === b.dataset.slug), l = lw[a.slug]; go(() => play(a, l.id, l.label)); },
  };
  loadPosters();
}
function setPoster(slug, url) {
  document.querySelectorAll(`[data-pslug="${slug}"]`).forEach((el) => {
    if (el.querySelector("img")) return;
    const ph = el.querySelector(".ph"); if (ph) ph.remove();
    el.insertAdjacentHTML("afterbegin", img(url));
  });
}
async function loadPosters() {
  for (const a of coll()) {
    if (posterOf(a)) continue;
    try {
      const d = await api("detail/" + encodeURIComponent(a.slug) + "?s=" + a.source);
      const x = d.data || d, p = x.poster || x.image || x.thumbnail;
      if (p) { store.set("poster:" + a.slug, p); setPoster(a.slug, p); }
    } catch { break; }
  }
}

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
