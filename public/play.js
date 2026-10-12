// Override untuk detail() dan play() di index.html (dimuat setelah script utama).

function collectServers(o, out = [], q = "") {
  if (Array.isArray(o)) o.forEach((x) => collectServers(x, out, q));
  else if (o && typeof o === "object") {
    const id = o.serverId ?? o.server_id ?? o.serverID;
    if (typeof id === "string" || typeof id === "number") {
      const name = String(o.name || o.server || o.title || o.quality || "").trim();
      out.push({ id: String(id), label: [q, name].filter(Boolean).join(" ") });
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

function mount(u) {
  document.getElementById("box").innerHTML =
    (/\.(mp4|m3u8|webm)(\?|$)/i.test(u)
      ? `<video class="player" src="${esc(u)}" controls playsinline></video>`
      : `<iframe class="player" src="${esc(u)}" allowfullscreen allow="fullscreen; autoplay" referrerpolicy="no-referrer"></iframe>`) +
    `<p class="hint"><a id="ext" href="${esc(u)}" target="_blank" rel="noopener">Tidak muncul? Buka di browser</a></p>`;
  if (tg) document.getElementById("ext").onclick = (e) => { e.preventDefault(); tg.openLink(u); };
}

function swap(fn) { stack[stack.length - 1] = fn; render(); }

async function play(a, slug, label) {
  root.innerHTML = backBtn() + `<h1>${esc(label)}</h1><p class="hint">Memuat…</p>`;
  try {
    const d = await api(`episode/${encodeURIComponent(slug)}?s=${encodeURIComponent(a.source)}`);
    const x = d.data || d;
    const opts = [], seenU = new Set(), seenS = new Set();
    const addUrl = (u, l) => { if (u && !seenU.has(u)) { seenU.add(u); opts.push({ url: u, label: l }); } };
    addUrl(x.defaultStreamingUrl, "Utama");
    collectLinks(d).forEach((u) => addUrl(u, ""));
    collectServers(d).forEach((s) => { if (!seenS.has(s.id)) { seenS.add(s.id); opts.push(s); } });
    const title = x.title || label;
    if (!opts.length) { root.innerHTML = backBtn() + `<h1>${esc(title)}</h1>` + raw(d); return; }

    const nav = [x.prevEpisode && ["Sebelumnya", x.prevEpisode], x.nextEpisode && ["Berikutnya", x.nextEpisode]]
      .filter((n) => n && n[1].episodeId);
    root.innerHTML = backBtn() + `<h1>${esc(title)}</h1><div id="box"></div><div class="row" id="srv">` +
      opts.map((o, i) => `<button class="alt" data-i="${i}">${esc(o.label || "Server " + (i + 1))}</button>`).join("") + "</div>" +
      (nav.length ? '<div class="row" id="nav">' + nav.map((n, i) => `<button data-n="${i}">${n[0]}</button>`).join("") + "</div>" : "");

    const btns = root.querySelectorAll("#srv button");
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
    root.querySelectorAll("#nav button").forEach((b) => (b.onclick = () => {
      const [, ep] = nav[+b.dataset.n];
      swap(() => play(a, ep.episodeId, a.title));
    }));
    choose(0);
  } catch (e) { root.innerHTML = backBtn() + fail(e); }
}

// Label episode pendek ("Ep 13") dan info ringkas.
async function detail(a) {
  root.innerHTML = backBtn() + `<h1>${esc(a.title)}</h1><p class="hint">Memuat…</p>`;
  try {
    const d = await api("detail/" + encodeURIComponent(a.slug));
    const eps = findEpisodes(d);
    if (!eps) { root.innerHTML = backBtn() + `<h1>${esc(a.title)}</h1>` + raw(d); return; }
    const x = d.data || d;
    const poster = a.poster || x.poster || findStr(d, /poster|image|thumb|cover/i);
    const syn = (x.synopsis && Array.isArray(x.synopsis.paragraphs) && x.synopsis.paragraphs.join(" ")) || findStr(d, /synopsis|sinopsis|description/i);
    const info = [x.status, x.score && "skor " + x.score, x.episodes && x.episodes + " episode"].filter(Boolean).join(", ");
    root.innerHTML = backBtn() + `<h1>${esc(a.title)}</h1>` +
      (poster ? `<img class="poster" src="${esc(poster)}" referrerpolicy="no-referrer" alt="">` : "") +
      (info ? `<p class="hint">${esc(info)}</p>` : "") +
      (syn ? `<p class="hint">${esc(syn.slice(0, 400))}</p>` : "") +
      '<div style="clear:both"></div><div class="eps">' + eps.map((ep, i) => {
        const label = ep.eps != null ? "Ep " + ep.eps : (ep.title || ep.episode || ep.name || "Ep " + (i + 1));
        return `<button data-i="${i}" title="${esc(ep.title || "")}">${esc(String(label).slice(0, 24))}</button>`;
      }).join("") + "</div>";
    root.querySelectorAll(".eps button").forEach((b) => b.onclick = () => {
      const ep = eps[b.dataset.i];
      const slug = last(ep.slug || ep.endpoint || ep.episodeId || ep.id || "");
      go(() => play(a, slug, a.title + " - " + b.textContent));
    });
  } catch (e) { root.innerHTML = backBtn() + fail(e); }
}
