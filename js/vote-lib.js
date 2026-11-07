// 純邏輯：CSV 解析、候選項目、篩選、分享連結、文字處理。
// 不依賴 DOM 與 Firebase，所以可以用 Node 單獨測試。

export const MAX = 3;

// ---------- CSV ----------
export function parseCSV(text) {
  text = String(text || '').replace(/^\uFEFF/, '');
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// 表頭寫成「中文名稱 (key)」，取最後一組半形括號裡的英文當欄位名；沒有括號就用整個表頭。
export const headerKey = h => { h = String(h || '').trim(); const m = h.match(/\(([^()]+)\)\s*$/); return m ? m[1].trim() : (/^[A-Za-z_][\w]*$/.test(h) ? h : ''); };

export function rowsToObjects(rows) {
  if (!rows.length) return [];
  const keys = rows[0].map(headerKey), out = [];
  for (const r of rows.slice(1)) {
    if (!r.some(x => String(x).trim())) continue;
    const o = {}; keys.forEach((k, i) => { if (k) o[k] = String(r[i] ?? '').trim(); });
    out.push(o);
  }
  return out;
}

// ---------- 基本轉換 ----------
export const truthy = v => /^(y|yes|1|true|是|v|✓|○|隱藏)$/i.test(String(v || '').trim());

export function genTags(v) {
  const out = [];
  String(v || '').split(/[,、，;；\s/]+/).forEach(tok => {
    let m = tok.match(/^gen\s*([1-5])$/i) || tok.match(/^([1-5])\s*期(?:生)?$/);
    if (m && !out.includes('gen' + m[1])) out.push('gen' + m[1]);
  });
  return out;
}

export const YT_RE = /(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/;
export const ytId = v => { v = String(v || '').trim(); if (/^[A-Za-z0-9_-]{11}$/.test(v)) return v; const m = v.match(YT_RE); return m ? m[1] : ''; };
export const ytThumb = id => id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '';
export const ytUrl = id => id ? `https://www.youtube.com/watch?v=${id}` : '';

// 相對路徑（例如 img/covers/r05-A.jpg）以頁面網址為基準；完整網址原樣使用。
export function resolveImg(u, base) {
  u = String(u || '').trim(); if (!u) return '';
  if (/^(https?:)?\/\//i.test(u) || /^data:image\//i.test(u)) return u;
  try { return new URL(u, base).href; } catch { return u; }
}

// ---------- 候選項目 ----------
export function normalizeSong(o, base) {
  if (!o.id || !o.title) return null;
  const tags = [];
  if (truthy(o.is_title)) tags.push('title');
  if (truthy(o.is_cw)) tags.push('cw');
  if (truthy(o.is_unit)) tags.push('unit');
  tags.push(...genTags(o.gen));
  return { kind: 'song', id: o.id, title: o.title, single: o.single || '', era: (o.era || '').toLowerCase(), tags,
    composer: o.composer || '', lyricist: o.lyricist || '', previewUrl: o.previewUrl || '', note: o.note || '',
    img: resolveImg(o.artworkOverride || o.artworkUrl, base), hidden: truthy(o.hidden) };
}

export function normalizeMV(o, items, base) {
  if (!o.id) return null;
  const song = items[o.songId], y = ytId(o.ytId), title = song ? song.title : (o.title || '');
  if (!title) return null;
  const sub = song && o.title && o.title !== song.title ? o.title : '';
  const img = resolveImg(o.thumbUrl, base) || ytThumb(y) || song?.img || '';
  return { kind: 'mv', id: o.id, songId: o.songId || '', title, sub, ytId: y, img, fallback: song?.img || '', single: song?.single || '',
    era: song?.era || '', tags: [], note: o.note || '', hidden: !!song?.hidden };
}

export const SLIDES = [['jacketA', 'Type A', 'A'], ['jacketB', 'Type B', 'B'], ['jacketC', 'Type C', 'C'], ['jacketD', 'Type D', 'D'], ['jacketN', '通常盤', '通常'], ['jacketX', '其他', '其他']];

export function normalizeRelease(o, items, base) {
  if (!o.id || !o.title) return null;
  let images = SLIDES.map(([k, label, short]) => ({ url: resolveImg(o[k], base), label, short })).filter(x => x.url);
  if (!images.length) {
    let u = resolveImg(o.artworkOverride, base) || resolveImg(o.artworkUrl, base);
    if (!u) { const s = Object.values(items).find(x => x.kind === 'song' && x.single === o.title && x.img); u = s?.img || ''; }
    if (u) images = [{ url: u, label: '', short: '' }];
  }
  return { kind: 'release', id: o.id, title: o.title, single: o.title, era: (o.era || '').toLowerCase(), rtype: o.rtype || 'single',
    tags: [], images, img: images[0]?.url || '', note: o.note || '', hidden: truthy(o.hidden) };
}

export function buildData({ songs, mv, releases }, base) {
  const items = {}, list = [], warn = [];
  const add = it => { if (!it) return; if (items[it.id]) { warn.push('重複的編號：' + it.id); return; } items[it.id] = it; list.push(it); };
  rowsToObjects(parseCSV(songs)).forEach(o => add(normalizeSong(o, base)));
  rowsToObjects(parseCSV(mv)).forEach(o => add(normalizeMV(o, items, base)));
  rowsToObjects(parseCSV(releases)).forEach(o => add(normalizeRelease(o, items, base)));
  return { items, list, warn };
}

// ---------- 獎項與篩選 ----------
export function match(c, s) {
  const f = c.filter || {};
  if (s.hidden) return false;
  if (f.kind) return s.kind === f.kind;
  if (s.kind !== 'song') return false;
  if (f.all) return true;
  if (f.tag) return s.tags.includes(f.tag);
  if (f.tagPrefix) return s.tags.some(x => x.startsWith(f.tagPrefix));
  if (f.era) return s.era === f.era;
  return false;
}

export function buildTabs(cats, groups = []) {
  const tabs = [], seen = {};
  cats.forEach(c => {
    if (c.group) {
      let t = seen[c.group];
      if (!t) { const g = groups.find(x => x.id === c.group) || {}; t = seen[c.group] = { id: c.group, name: g.name || c.name, cats: [] }; tabs.push(t); }
      t.cats.push(c);
    } else tabs.push({ id: c.id, name: c.name, cats: [c] });
  });
  return tabs;
}

// ---------- 文字 ----------
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const escBr = s => esc(s).replace(/\r?\n/g, '<br>');

// 備註：保留換行，http/https 網址變成可點的連結；其他內容一律當純文字。
export function linkify(text) {
  const t = String(text || ''), re = /https?:\/\/[^\s<>"'）)」』]+/g; let out = '', last = 0, m;
  while ((m = re.exec(t))) {
    let u = m[0]; const trail = u.match(/[.,;:!?、。，！？]+$/); if (trail) u = u.slice(0, -trail[0].length);
    out += escBr(t.slice(last, m.index)) + `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(u)}</a>`;
    last = m.index + u.length; re.lastIndex = last;
  }
  return out + escBr(t.slice(last));
}

// ---------- 分享連結 ----------
export function encodeShare(base, year, cats, sel, nick) {
  const body = cats.filter(c => sel[c.id]?.length).map(c => c.id + ':' + sel[c.id].join(',')).join(';');
  return base + '#r=' + year + '~' + body + (nick ? '&n=' + encodeURIComponent(nick) : '');
}

export function decodeShare(hash, cats, items) {
  const [main, nk] = String(hash).slice(3).split('&n='), [year, body] = main.split('~'), picks = {};
  let nick = ''; try { nick = decodeURIComponent(nk || '').slice(0, 20); } catch {}
  (body || '').split(';').forEach(p => {
    const [c, v] = p.split(':');
    if (v && cats.some(x => x.id === c)) { const ids = v.split(',').filter(i => items[i] && !items[i].hidden).slice(0, MAX); if (ids.length) picks[c] = ids; }
  });
  return { year, nick, picks };
}

// ---------- 日期 ----------
export function daysLeft(deadline, now = Date.now()) { const ms = deadline - now; return ms <= 0 ? 0 : Math.ceil(ms / 86400000); }

export function fmtDeadline(ts) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(ts)).map(x => [x.type, x.value]));
  return `${p.year}/${p.month}/${p.day} ${p.hour}:${p.minute}`;
}
