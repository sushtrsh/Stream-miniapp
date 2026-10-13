// Beranda NimeX: lanjut menonton, koleksi (geser), dan update terbaru.
// Dimuat SEBELUM app.js (fungsi baru dipanggil saat app.js memanggil go(home)).

function parseDate(s) {
  const m = String(s || "").match(/(\d{1,2})\s+([A-Za-z]+)\s*,?\s*(\d{4})/);
  if (!m) return 0;
  const k = m[2].slice(0, 3).toLowerCase();
  let mon = ["jan", "feb", "mar", "apr", "mei", "jun", "jul", "agu", "sep", "okt", "nov", "des"].indexOf(k);
  if (mon < 0) mon = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(k);
  return mon < 0 ? 0 : new Date(+m[3], mon, +m[1]).getTime();
}
function ago(t) {
  const d = Math.max(0, Math.floor((Date.now() - t) / 864e5));
  return d === 0 ? "hari ini" : d === 1 ? "kemarin" : d + " hari lalu";
}

function home() {
  const items = coll();
  const lw = store.get("last", {});
  const recent = items.filter((a) => lw[a.slug]).sort((x, y) => (lw[y.slug].t || 0) - (lw[x.slug].t || 0))[0];
  let html = `<header class="hd"><div class="brand"><span class="logo">N</span><span>Nime<b class="x">X</b></span></div></header>
    <button class="sbar" data-act="search">${I.search}Cari anime untuk ditambahkan</button>`;
  if (recent) {
    const l = lw[recent.slug], p = posterOf(recent);
    html += `<h2 class="sec">Lanjut menonton</h2>
      <button class="resume" data-act="resume" data-slug="${esc(recent.slug)}">
        <div class="rbg" data-pslug="${esc(recent.slug)}">${img(p)}</div>
        <div class="rth" data-pslug="${esc(recent.slug)}">${img(p)}</div>
        <div class="rtx"><span class="tag">${esc(l.label)}</span><strong>${esc(recent.title)}</strong><small>Lanjutkan menonton</small></div>
        <span class="fab">${I.play}</span></button>`;
  }
  html += `<div class="sec-row"><h2 class="sec">Koleksi <span>${items.length}</span></h2>${items.length ? `<button class="link" data-act="edit">${editing ? "Selesai" : "Edit"}</button>` : ""}</div>`;
  if (!items.length) {
    html += `<div class="empty"><p>Koleksi masih kosong.</p><button class="btn pri" data-act="search">${I.search}Cari anime</button></div>`;
  } else {
    html += '<div class="rail">' + items.map((a, i) => {
      const l = lw[a.slug], p = posterOf(a);
      return `<div class="card"><button class="cb" data-act="open" data-i="${i}"><div class="im" data-pslug="${esc(a.slug)}">${p ? img(p) : `<div class="ph">${esc(a.title.charAt(0))}</div>`}${l ? `<span class="badge">${I.play}${esc(l.label)}</span>` : ""}</div><p>${esc(a.title)}</p></button>${editing ? `<button class="rm" data-act="del" data-i="${i}" aria-label="Hapus dari koleksi">${I.x}</button>` : ""}</div>`;
    }).join("") + "</div>";
  }
  html += '<div id="upd"></div>';
  show(html, { still: editing });
  acts = {
    search: () => goTab("search"),
    edit: () => { editing = !editing; redraw(); },
    open: (b) => go(() => detail(items[b.dataset.i])),
    del: (b) => { delColl(items[b.dataset.i].slug); redraw(); },
    resume: (b) => { const a = items.find((x) => x.slug === b.dataset.slug), l = lw[a.slug]; go(() => play(a, l.id, l.label)); },
    upplay: (b) => { const a = coll().find((x) => x.slug === b.dataset.slug); if (a) go(() => play(a, b.dataset.id, b.dataset.l)); },
  };
  drawUpdates();
  loadMeta();
}

function setPoster(slug, url) {
  document.querySelectorAll(`[data-pslug="${slug}"]`).forEach((el) => {
    if (el.querySelector("img")) return;
    const ph = el.querySelector(".ph"); if (ph) ph.remove();
    el.insertAdjacentHTML("afterbegin", img(url));
  });
}

// Update terbaru: episode terbaru koleksi yang tayang dalam 14 hari terakhir.
function drawUpdates() {
  const el = document.getElementById("upd");
  if (!el) return;
  const lat = store.get("latest", {}), now = Date.now();
  const rows = coll().map((a) => ({ a, i: lat[a.slug] }))
    .filter((r) => r.i && r.i.t && r.i.id && now - r.i.t <= 14 * 864e5)
    .sort((x, y) => y.i.t - x.i.t).slice(0, 6);
  if (!rows.length) { el.innerHTML = ""; return; }
  el.innerHTML = '<h2 class="sec">Update terbaru</h2><div class="up">' + rows.map(({ a, i }) => {
    const seen = store.get("seen:" + a.slug, []).includes(i.id), p = posterOf(a);
    return `<button class="upb" data-act="upplay" data-slug="${esc(a.slug)}" data-id="${esc(i.id)}" data-l="${esc(i.label)}"><div class="th" data-pslug="${esc(a.slug)}">${img(p)}</div><div class="ut"><strong>${esc(a.title)}</strong><span>${esc(i.label)} · ${ago(i.t)}</span></div>${seen ? "" : '<span class="nw">BARU</span>'}<span class="pp">${I.play}</span></button>`;
  }).join("") + "</div>";
}

// Ambil poster dan episode terbaru tiap anime di koleksi (maks. sekali per 30 menit per anime).
async function loadMeta() {
  for (const a of coll()) {
    const cur = store.get("latest", {})[a.slug];
    if (posterOf(a) && cur && Date.now() - (cur.f || 0) < 30 * 60 * 1000) continue;
    try {
      const d = await api("detail/" + encodeURIComponent(a.slug) + "?s=" + a.source);
      const x = d.data || d, eps = findEpisodes(d);
      const p = x.poster || x.image || x.thumbnail;
      if (p) { store.set("poster:" + a.slug, p); setPoster(a.slug, p); }
      if (eps && eps.length) {
        const nums = eps.every((e) => typeof e.eps === "number");
        const e0 = nums ? eps.reduce((m, e) => (e.eps > m.eps ? e : m), eps[0]) : eps[0];
        const all = store.get("latest", {});
        all[a.slug] = { id: last(e0.episodeId || e0.slug || e0.endpoint || e0.id || ""), label: e0.eps != null ? "Ep " + e0.eps : "Terbaru", t: parseDate(e0.date), f: Date.now() };
        store.set("latest", all);
        drawUpdates();
      }
    } catch { break; }
  }
}
