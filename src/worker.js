// Worker: proxy + cache ke ApiSanka, hanya untuk anime pilihan.
// Rute: /api/list | /api/detail/:slug | /api/episode/:slug?s=SRC | /api/server/:id?s=SRC
// File statis (folder public/) dilayani otomatis oleh Workers assets.

const BASE = "https://www.sankavollerei.web.id";

// GANTI dengan anime pilihanmu (dua baris ini contoh dari dokumentasi).
const ANIME = [
  { source: "otakudesu", slug: "enen-shouboutai-season-3-p2-sub-indo", title: "Enen no Shouboutai S3 P2", poster: "" },
  { source: "animasu", slug: "one-piece-sub-indonesia", title: "One Piece", poster: "" },
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

// Batas ApiSanka 45 request/menit (3x peringatan lalu ban), jadi cache wajib.
const TTL = { detail: 3600, episode: 600, server: 300 }; // detik
const ERR_TTL = 60;

// Cache 1: memori isolate (cepat, hilang kalau Worker di-recycle).
// Cache 2: cache CDN Cloudflare lewat opsi cf di fetch().
const mem = new Map();

const reply = (body, status, ttl) =>
  new Response(body, {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${ttl}` },
  });
const json = (data, status = 200) => reply(JSON.stringify(data), status, 0);

export default {
  async fetch(request) {
    if (request.method !== "GET") return json({ error: "method tidak didukung" }, 405);
    const url = new URL(request.url);
    const [, root, kind, rawId] = url.pathname.split("/");
    if (root !== "api") return json({ error: "tidak ditemukan" }, 404);

    let id = "";
    try { id = decodeURIComponent(rawId || ""); } catch { return json({ error: "id tidak valid" }, 400); }

    if (kind === "list") return reply(JSON.stringify(ANIME), 200, 60);

    let target, ttl;
    if (kind === "detail" && id) {
      const item = ANIME.find((a) => a.slug === id);
      if (!item || !PATHS[item.source]) return json({ error: "anime tidak diizinkan" }, 403);
      target = BASE + PATHS[item.source].detail + encodeURIComponent(id);
      ttl = TTL.detail;
    } else if ((kind === "episode" || kind === "server") && id) {
      const src = url.searchParams.get("s");
      const p = PATHS[src];
      if (!p || !ANIME.some((a) => a.source === src)) return json({ error: "source tidak valid" }, 403);
      if (!p[kind]) return json({ error: kind + " tidak didukung untuk source ini" }, 404);
      target = BASE + p[kind] + encodeURIComponent(id);
      ttl = TTL[kind];
    } else {
      return json({ error: "tidak ditemukan" }, 404);
    }

    const hit = mem.get(target);
    if (hit && hit.exp > Date.now()) return reply(hit.body, hit.status, hit.ttl);

    const up = await fetch(target, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      cf: { cacheEverything: true, cacheTtlByStatus: { "200-299": ttl, "400-599": ERR_TTL } },
    });
    const ok = up.ok;
    const body = ok ? await up.text() : JSON.stringify({ error: "upstream gagal", status: up.status });
    const status = ok ? 200 : 502;
    const t = ok ? ttl : ERR_TTL;

    if (mem.size > 500) mem.clear();
    mem.set(target, { exp: Date.now() + t * 1000, status, body, ttl: t });
    return reply(body, status, t);
  },
};
