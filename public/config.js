// Konfigurasi + akses ApiSanka langsung dari browser pengguna (IP pengguna,
// bukan IP server). Dimuat SEBELUM script utama di index.html.
const BASE = "https://www.sankavollerei.web.id";

// GANTI dengan anime pilihanmu (dua baris ini contoh dari dokumentasi).
const ANIME = [
  { source: "otakudesu", slug: "enen-shouboutai-season-3-p2-sub-indo", title: "Enen no Shouboutai S3 P2", poster: "" },
  { source: "otakudesu", slug: "lv999-murabito-sub-indo", title: "Lv999 no Murabito", poster: "" },
];

// Path tiap source berbeda-beda (otakudesu tanpa awalan nama source).
const P = (detail, episode, server) => ({ detail, episode, server });
const PATHS = {
  otakudesu:   P("/anime/anime/", "/anime/episode/", "/anime/server/"),
  samehadaku:  P("/anime/samehadaku/anime/", "/anime/samehadaku/episode/", "/anime/samehadaku/server/"),
  animasu:     P("/anime/animasu/detail/", "/anime/animasu/episode/"),
  anoboy:      P("/anime/anoboy/anime/", "/anime/anoboy/episode/"),
  oploverz:    P("/anime/oploverz/anime/", "/anime/oploverz/episode/"),
  stream:      P("/anime/stream/anime/", "/anime/stream/episode/"),
  animekuindo: P("/anime/animekuindo/detail/", "/anime/animekuindo/episode/"),
  donghub:     P("/anime/donghub/detail/", "/anime/donghub/episode/"),
  donghua:     P("/anime/donghua/detail/", "/anime/donghua/episode/"),
  animekompi:  P("/anime/animekompi/detail/", "/anime/animekompi/episode/"),
};

// Batas ApiSanka 45 request/menit per IP (3x peringatan lalu ban), jadi hasil di-cache.
const TTL = { detail: 3600, episode: 600, server: 300 }; // detik

async function cached(url, ttl) {
  const k = "c:" + url;
  try {
    const c = JSON.parse(localStorage.getItem(k));
    if (c && c.exp > Date.now()) return c.data;
  } catch {}
  const r = await fetch(url);
  if (!r.ok) throw new Error("HTTP " + r.status);
  const data = await r.json();
  try { localStorage.setItem(k, JSON.stringify({ exp: Date.now() + ttl * 1000, data })); } catch {}
  return data;
}

// Dipanggil index.html: list | detail/:slug | episode/:slug?s=SRC | server/:id?s=SRC
async function api(path) {
  if (path === "list") return ANIME;
  const [route, query = ""] = path.split("?");
  const [kind, rawId] = route.split("/");
  const id = decodeURIComponent(rawId || "");
  let source = new URLSearchParams(query).get("s");
  if (kind === "detail") {
    const item = ANIME.find((a) => a.slug === id);
    if (!item) throw new Error("anime tidak ada di daftar");
    source = item.source;
  }
  const p = PATHS[source];
  if (!p || !p[kind]) throw new Error("source tidak didukung");
  return cached(BASE + p[kind] + encodeURIComponent(id), TTL[kind]);
}
