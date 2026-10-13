// Navbar bawah + halaman Koleksi. Dimuat SEBELUM app.js.
let tab = "home";
const TABS = [
  { id: "home", label: "Beranda", ic: '<svg viewBox="0 0 24 24"><path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/></svg>' },
  { id: "search", label: "Cari", ic: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>' },
  { id: "koleksi", label: "Koleksi", ic: '<svg viewBox="0 0 24 24"><path d="M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1z"/></svg>' },
];
document.body.insertAdjacentHTML("beforeend",
  `<nav class="nav" id="nav"><div class="in">${TABS.map((t) => `<button data-t="${t.id}" aria-label="${t.label}"><span class="ic">${t.ic}</span>${t.label}</button>`).join("")}</div></nav>`);
document.getElementById("nav").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-t]");
  if (!b) return;
  tap();
  goTab(b.dataset.t);
});
// sembunyikan navbar saat keyboard terbuka
document.addEventListener("focusin", (e) => { if (e.target.matches && e.target.matches("input")) document.body.classList.add("kb"); });
document.addEventListener("focusout", () => document.body.classList.remove("kb"));

function goTab(t) {
  if (t === tab && stack.length === 1) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
  tab = t; editing = false;
  stack.length = 0;
  stack.push(t === "search" ? search : t === "koleksi" ? koleksi : home);
  render();
}
// dipanggil oleh render() di app.js
function updateNav() {
  document.body.classList.toggle("hasnav", stack.length === 1);
  document.querySelectorAll("#nav button").forEach((b) => b.classList.toggle("on", b.dataset.t === tab));
}

function koleksi() {
  const items = coll(), lw = store.get("last", {});
  let html = `<header class="pg"><h1>Koleksi<span>${items.length}</span></h1>${items.length ? `<button class="link" data-act="edit">${editing ? "Selesai" : "Edit"}</button>` : ""}</header>`;
  if (!items.length) {
    html += `<div class="empty"><p>Koleksi masih kosong.</p><button class="btn pri" data-act="search">${I.search}Cari anime</button></div>`;
  } else {
    html += '<div class="grid">' + items.map((a, i) => {
      const l = lw[a.slug], p = posterOf(a);
      return `<div class="card" style="--d:${i * 40}ms"><button class="cb" data-act="open" data-i="${i}"><div class="im" data-pslug="${esc(a.slug)}">${p ? img(p) : `<div class="ph">${esc(a.title.charAt(0))}</div>`}${l ? `<span class="badge">${I.play}${esc(l.label)}</span>` : ""}</div><p>${esc(a.title)}</p></button>${editing ? `<button class="rm" data-act="del" data-i="${i}" aria-label="Hapus dari koleksi">${I.x}</button>` : ""}</div>`;
    }).join("") + "</div>";
  }
  show(html, { still: editing });
  acts = {
    search: () => goTab("search"),
    edit: () => { editing = !editing; redraw(); },
    open: (b) => go(() => detail(items[b.dataset.i])),
    del: (b) => { delColl(items[b.dataset.i].slug); redraw(); },
  };
  loadMeta();
}
