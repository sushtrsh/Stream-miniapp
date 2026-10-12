// Menimpa play() di index.html: mendukung link langsung DAN serverId
// (embed diambil lewat /api/server/:id).
function collectServers(o, out = []) {
  if (Array.isArray(o)) o.forEach((x) => collectServers(x, out));
  else if (o && typeof o === "object") {
    const id = o.serverId ?? o.server_id ?? o.serverID;
    if (typeof id === "string" || typeof id === "number") {
      out.push({ id: String(id), label: o.name || o.server || o.title || o.quality || "" });
    }
    Object.values(o).forEach((v) => collectServers(v, out));
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

function mount(u) {
  document.getElementById("box").innerHTML = /\.(mp4|m3u8|webm)(\?|$)/i.test(u)
    ? `<video class="player" src="${esc(u)}" controls playsinline></video>`
    : `<iframe class="player" src="${esc(u)}" allowfullscreen allow="fullscreen; autoplay" referrerpolicy="no-referrer"></iframe>`;
}

async function play(a, slug, label) {
  root.innerHTML = backBtn() + `<h1>${esc(label)}</h1><p class="hint">Memuat…</p>`;
  try {
    const d = await api(`episode/${encodeURIComponent(slug)}?s=${encodeURIComponent(a.source)}`);
    const direct = [...new Set(collectLinks(d))].map((u) => ({ url: u }));
    const seen = new Set();
    const servers = collectServers(d).filter((s) => !seen.has(s.id) && seen.add(s.id));
    const opts = [...direct, ...servers];
    if (!opts.length) { root.innerHTML = backBtn() + `<h1>${esc(label)}</h1>` + raw(d); return; }
    root.innerHTML = backBtn() + `<h1>${esc(label)}</h1><div id="box"></div><div class="row">` +
      opts.map((o, i) => `<button class="alt" data-i="${i}">Server ${i + 1}${o.label ? " (" + esc(o.label) + ")" : ""}</button>`).join("") + "</div>";
    const btns = root.querySelectorAll(".row button");
    const choose = async (i) => {
      btns.forEach((b, j) => b.classList.toggle("on", j === i));
      const o = opts[i];
      try {
        let u = o.url;
        if (!u) {
          document.getElementById("box").innerHTML = '<p class="hint">Memuat server…</p>';
          const s = await api(`server/${encodeURIComponent(o.id)}?s=${encodeURIComponent(a.source)}`);
          u = pickUrl(s);
          if (!u) { document.getElementById("box").innerHTML = raw(s); return; }
        }
        mount(u);
      } catch (e) { document.getElementById("box").innerHTML = fail(e); }
    };
    btns.forEach((b) => (b.onclick = () => choose(+b.dataset.i)));
    choose(0);
  } catch (e) { root.innerHTML = backBtn() + fail(e); }
}
