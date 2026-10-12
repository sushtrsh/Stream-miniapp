// Proxy + cache ke ApiSanka, hanya untuk anime pilihan.
// Rute: /api/list | /api/detail/:slug | /api/episode/:slug?s=SRC | /api/server/:id?s=SRC

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

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export async function onRequestGet(context) {
  const { request, params } = context;
  const [kind, id] = params.path || [];
  const url = new URL(request.url);

  if (kind === "list") return json(ANIME);

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

  const cache = caches.default;
  const key = new Request(url.toString(), { method: "GET" });
  const hit = await cache.match(key);
  if (hit) return hit;

  const up = await fetch(target, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
  });

  // Error juga di-cache 60 detik supaya tidak menembak ulang ke ApiSanka.
  const res = new Response(
    up.ok ? up.body : JSON.stringify({ error: "upstream gagal", status: up.status }),
    {
      status: up.ok ? 200 : 502,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${up.ok ? ttl : 60}`,
      },
    }
  );
  context.waitUntil(cache.put(key, res.clone()));
  return res;
}
