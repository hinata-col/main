// 速報宣傳圖卡（後台下載用）：只畫名次，不含票數。畫法與投票分享圖卡、本命圖卡同一套（天空藍底、黃色筆刷標題、QR code）。
// 資料來源是「已發布的速報」(live/年份)，所以圖上的內容一定和前台速報一致。
import { steadyBold, drawQR, decoImgs } from './oshi.js?v=20261112a';

const NAVY = '#1F3552', BLUE = '#1F7FBF', W = 1080, H = 1350;
const F = '"VoteRound","Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
const DECO = ['cloud-big', 'cloud-light', 'cloud-sm', 'cloud-mass', 'cloud-r', 'cloud-sm2', 'brush-y', 'star-y', 'star-b', 'spark-1', 'spark-3'];
const COVER_PICK = ['title', 'mv', 'cover', 'composer', 'lyricist', 'live']; // 總覽封面優先放這些獎項的第 1 名

const TX = {
  zh: { ttl: '日向坂46 歌曲總選舉', round: n => `第 ${n} 回速報`, at: d => `截至 ${d}`, note: '粉絲自製・非官方　最終名次及票數將在投票截止後公布',
    tag: y => `#日向坂46　#日向坂46歌曲總選舉${y}`, top5: '前 5 名', first: '各獎項第 1 名', next: '各獎項前 5 名，請看後面的圖片 ▶', tie: n => `同率第 1 名還有 ${n} 首`, ask: '每一票，都是為自己的喜歡應援 ☀️' },
  ja: { ttl: '日向坂46 楽曲総選挙', round: n => `第${n}回速報`, at: d => `${d} 時点`, note: 'ファン有志による非公式企画　最終順位と票数は投票締切後に発表します',
    tag: y => `#日向坂46　#日向坂46楽曲総選挙${y}`, top5: 'トップ5', first: '各賞の第1位', next: '各賞のトップ5は、次の画像へ ▶', tie: n => `同率1位がほか${n}曲`, ask: 'その一票は、自分の「好き」へのエール ☀️' }
};

// 粉圓體沒有「櫸」這個字（資料裡有「櫸坂46」的寫法），畫圖卡時統一換成字型有的「欅」，字體才一致
const uni = s => String(s ?? '').replace(/櫸/g, '欅');
const nm = (c, lang) => c.name?.[lang] || c.name?.zh || '';
const stamp = ts => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(ts || Date.now()).map(x => [x.type, x.value]));
  return `${p.year}/${p.month}/${p.day} ${p.hour}:${p.minute}`; };

// ---- 圖片：先用本站快取（GitHub Actions 每天更新），沒有就用原網址，再不行透過 weserv 轉一手 ----
const loadImg = u => new Promise(r => { if (!u) return r(null); const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => r(i); i.onerror = () => r(null); i.src = u; setTimeout(() => r(null), 6000); });
let idxP; const cacheIdx = () => idxP ||= fetch(new URL('../img/cache/index.json', import.meta.url), { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).catch(() => null);
async function imgOf(id, it) {
  if (!it) return null; const ix = await cacheIdx(), f = ix?.items?.[id]?.f;
  const viaProxy = u => u && /^https?:/.test(u) ? loadImg('https://images.weserv.nl/?w=480&url=' + encodeURIComponent(u.replace(/^https?:\/\//, ''))) : Promise.resolve(null);
  return (f && await loadImg(new URL(`../img/cache/${f}?t=${ix.t}`, import.meta.url).href)) || await loadImg(it.img) || await viaProxy(it.img) || (it.fallback ? await loadImg(it.fallback) : null);
}

// 貼紙風太陽（與投票圖卡相同）
function sticker(g, cx, cy, r) {
  g.save(); g.translate(cx, cy); g.lineJoin = g.lineCap = 'round';
  const rays = (ext, wid, col, lw) => { g.beginPath(); for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5 - Math.PI / 2, a1 = a - wid, a2 = a + wid;
      g.moveTo(Math.cos(a1) * r * 1.02, Math.sin(a1) * r * 1.02); g.lineTo(Math.cos(a) * r * ext, Math.sin(a) * r * ext); g.lineTo(Math.cos(a2) * r * 1.02, Math.sin(a2) * r * 1.02); g.closePath(); }
    if (lw) { g.lineWidth = lw; g.strokeStyle = col; g.stroke(); } else { g.fillStyle = col; g.fill(); } };
  g.shadowColor = 'rgba(31,53,82,.18)'; g.shadowBlur = r * .3; g.shadowOffsetY = r * .08;
  rays(1.62, .2, '#fff', r * .32); g.beginPath(); g.arc(0, 0, r * 1.06, 0, 7); g.fillStyle = '#fff'; g.fill(); g.shadowColor = 'transparent';
  rays(1.5, .17, '#F5C400'); const gr = g.createRadialGradient(-r * .3, -r * .35, r * .1, 0, 0, r); gr.addColorStop(0, '#FFE680'); gr.addColorStop(1, '#F5C400');
  g.beginPath(); g.arc(0, 0, r * .9, 0, 7); g.fillStyle = gr; g.fill();
  g.fillStyle = NAVY; [-1, 1].forEach(d => { g.beginPath(); g.ellipse(d * r * .3, -r * .1, r * .07, r * .11, 0, 0, 7); g.fill(); });
  g.lineWidth = r * .08; g.strokeStyle = NAVY; g.beginPath(); g.arc(0, r * .12, r * .22, .2 * Math.PI, .8 * Math.PI); g.stroke();
  g.fillStyle = 'rgba(255,143,163,.55)'; [-1, 1].forEach(d => { g.beginPath(); g.ellipse(d * r * .52, r * .2, r * .13, r * .08, 0, 0, 7); g.fill(); });
  g.restore();
}

/**
 * o = { lang:'zh'|'ja', year, live:{round,t,cats:{catId:[{i,r}]}}, cats:[分類], items:{id:歌曲}, only:'cover' | 分類 id }
 * 回傳 1080×1350 的 canvas
 */
export async function makeLiveCard(o) {
  const { lang, year, live, cats, items } = o, T = TX[lang], only = o.only || 'cover';
  const have = c => (live.cats?.[c.id] || []).filter(x => items[x.i]);
  const avail = cats.filter(c => have(c).length);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = steadyBold(cv.getContext('2d'));
  // 先決定要畫的資料與圖片
  let cat = null, rows = [], cells = [];
  if (only === 'cover') {
    const pick = [...COVER_PICK.map(id => avail.find(c => c.id === id)).filter(Boolean)]; avail.forEach(c => { if (pick.length < 6 && !pick.includes(c)) pick.push(c); });
    cells = pick.slice(0, 6).map(c => { const f = have(c).filter(x => x.r === 1); return { c, id: f[0]?.i || have(c)[0].i, tie: Math.max(0, f.length - 1) }; });
  } else { cat = cats.find(c => c.id === only); rows = have(cat).slice(0, 6); }
  const ids = only === 'cover' ? cells.map(x => x.id) : rows.map(x => x.i);
  const [ims, dz] = await Promise.all([Promise.all(ids.map(id => imgOf(id, items[id]))), decoImgs(DECO)]);
  const A = Object.fromEntries(DECO.map((n, i) => [n, dz[i]]));
  const shortT = id => { const it = items[id], tt = uni(it?.title || id); return it?.kind === 'release' ? (/《(.+)》/.exec(tt)?.[1] || tt) : tt; };
  const sub = id => { const it = items[id]; return it?.kind === 'release' ? '' : uni(it?.single); };
  try { await document.fonts.load('40px VoteRound', Object.values(T).filter(v => typeof v === 'string').join('') + T.tag(year) + T.round(88) + '0123456789/: ' + cats.map(c => nm(c, lang)).join('') + ids.map(id => shortT(id) + sub(id)).join('') + location.host + location.pathname); } catch {}
  const put = (k, cx, cy, w, rot = 0, al = 1, sy = 1) => { const im = A[k]; if (!im) return; const h = w * im.height / im.width; g.save(); g.globalAlpha = al; g.translate(cx, cy); g.rotate(rot * Math.PI / 180); g.scale(1, sy); g.drawImage(im, -w / 2, -h / 2, w, h); g.restore(); };
  const fit = (s, w, size, weight) => { let z = size; g.font = `${weight} ${z}px ${F}`; while (z > 14 && g.measureText(s).width > w) { z -= 2; g.font = `${weight} ${z}px ${F}`; } return z; };
  const ctext = (s, cx, y, w, size, weight, col = NAVY) => { fit(s, w, size, weight); g.fillStyle = col; g.textAlign = 'center'; g.fillText(s, cx, y); g.textAlign = 'left'; };
  const clip1 = (s, w) => { while (g.measureText(s).width > w && s.length > 3) s = s.slice(0, -2) + '…'; return s; };
  const wrap = (s, w, n) => { const out = []; let cur = ''; for (const ch of s) { if (g.measureText(cur + ch).width > w && cur) { out.push(cur); cur = ch; if (out.length === n) break; } else cur += ch; }
    if (out.length < n && cur) out.push(cur); else if (out.length === n && cur) out[n - 1] = clip1(out[n - 1] + '…', w); return out.slice(0, n); };
  const card1 = (x, y, w, h, r) => { g.save(); g.shadowColor = 'rgba(31,53,82,.14)'; g.shadowBlur = 20; g.shadowOffsetY = 6; g.fillStyle = '#fff'; g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); g.restore(); };
  const draw = (im, x, y, w, h, r) => { g.save(); g.beginPath(); g.roundRect(x, y, w, h, r); g.clip();
    if (im) { const k = Math.max(w / im.width, h / im.height), dw = im.width * k, dh = im.height * k; g.drawImage(im, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); } else { g.fillStyle = '#BFE3F5'; g.fillRect(x, y, w, h); } g.restore(); };
  // ---- 背景、標題
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#CFE8F9'); bg.addColorStop(1, '#EAF6FD'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  put('cloud-big', 92, 58, 200, 0, .95); put('cloud-light', 965, 196, 150, 0, .9); put('cloud-sm', 62, 196, 96, 0, .8);
  put('star-b', 40, 128, 30, -10); put('star-y', 870, 36, 36, 8); put('spark-3', 1030, 150, 40, 0, .9);
  put('brush-y', 540, 84, 720, 4.5, .95, .6); ctext(T.ttl, 540, 110, 780, 72, 900); sticker(g, 990, 74, 44);
  ctext(`${year}　${T.round(live.round || 1)}　${T.at(stamp(live.t))}`, 540, 170, 960, 32, 800);
  // ---- 內容
  const PY = 206;
  if (only === 'cover') {
    card1(40, PY, 1000, 880, 36);
    g.font = `900 46px ${F}`; const lb = T.first, lw = g.measureText(lb).width; g.fillStyle = 'rgba(245,224,80,.85)'; g.fillRect(74, PY + 50, lw + 12, 20); g.fillStyle = NAVY; g.fillText(lb, 80, PY + 64);
    cells.forEach((cl, k) => { const x = 70 + (k % 2) * 480, y = PY + 104 + Math.floor(k / 2) * 262, c = cl.c, it = items[cl.id], mv = c.view === 'mv', tw = mv ? 192 : 108, th = 108;
      g.fillStyle = BLUE; g.font = `900 28px ${F}`; g.fillText(clip1(nm(c, lang), 420), x, y + 26);
      draw(ims[k], x, y + 44, mv ? tw : 150, mv ? 108 : 150, 18); const tx = x + (mv ? tw : 150) + 18, mw = 450 - (mv ? tw : 150) - 22;
      g.fillStyle = NAVY; g.font = `900 32px ${F}`; const ls = wrap(shortT(cl.id), mw, 3); ls.forEach((s, j) => g.fillText(s, tx, y + 86 + j * 40));
      let yy = y + 86 + ls.length * 40; if (sub(cl.id) && yy < y + 190) { g.fillStyle = '#5F7D99'; g.font = `700 22px ${F}`; g.fillText(clip1(sub(cl.id), mw), tx, yy - 6); yy += 28; }
      if (cl.tie && yy < y + 200) { g.fillStyle = BLUE; g.font = `800 22px ${F}`; g.fillText(clip1(T.tie(cl.tie), mw), tx, yy - 4); } });
    ctext(T.next, 540, PY + 880 + 56, 960, 36, 900, NAVY);
  } else {
    const n = rows.length, rh = n <= 3 ? 190 : n === 4 ? 176 : n === 5 ? 148 : 124, ph = 104 + n * rh + 18, mv = cat.view === 'mv';
    card1(40, PY, 1000, ph, 36);
    g.font = `900 50px ${F}`; const lb = nm(cat, lang), lw = g.measureText(lb).width; g.fillStyle = 'rgba(245,224,80,.85)'; g.fillRect(74, PY + 54, lw + 12, 22); g.fillStyle = NAVY; g.fillText(lb, 80, PY + 70);
    g.textAlign = 'right'; g.fillStyle = BLUE; g.font = `900 34px ${F}`; g.fillText(T.top5, 1004, PY + 66); g.textAlign = 'left';
    rows.forEach((x, k) => { const y = PY + 104 + k * rh, cy = y + rh / 2, th = rh - 28, tw = mv ? Math.round(th * 16 / 9) : th, first = x.r === 1;
      if (first) { g.fillStyle = 'rgba(245,224,80,.3)'; g.beginPath(); g.roundRect(56, y + 4, 968, rh - 8, 26); g.fill(); }
      else if (k) { g.fillStyle = '#E3EEF7'; g.fillRect(90, y, 900, 2); }
      const rr = first ? 40 : 34; g.beginPath(); g.arc(112, cy, rr, 0, 7); g.fillStyle = first ? '#F5C400' : x.r <= 3 ? '#BFE3F5' : '#EAF3FA'; g.fill();
      ctext(String(x.r), 112, cy + (first ? 17 : 14), rr * 1.5, first ? 52 : 44, 900, NAVY);
      draw(ims[k], 176, y + 14, tw, th, 16); const tx = 176 + tw + 24, mw = 1000 - tx - 26;
      g.fillStyle = NAVY; g.font = `900 38px ${F}`; const ls = wrap(shortT(x.i), mw, 2), s2 = sub(x.i), tot = ls.length * 46 + (s2 ? 30 : 0), y0 = cy - tot / 2 + 36;
      ls.forEach((s, j) => g.fillText(s, tx, y0 + j * 46));
      if (s2) { g.fillStyle = '#5F7D99'; g.font = `700 25px ${F}`; g.fillText(clip1(s2, mw), tx, y0 + ls.length * 46 - 6); } });
    const ny = PY + ph + 64; ctext(T.ask, 540, ny, 960, 36, 900, NAVY);
  }
  // ---- 頁尾：雲朵、QR code、hashtag 與網址、注意事項
  put('cloud-mass', 300, H - 26, 640); put('cloud-r', 950, H - 20, 320, 0, .95); put('cloud-sm2', 680, H - 2, 180, 0, .9); put('star-y', 1040, 1112, 30, 8);
  const qs = 145, qy = H - qs - 24;
  g.save(); g.shadowColor = 'rgba(31,53,82,.22)'; g.shadowBlur = 14; g.shadowOffsetY = 4; g.fillStyle = '#fff'; g.beginPath(); g.roundRect(50, qy - 10, qs + 20, qs + 20, 22); g.fill(); g.restore();
  drawQR(g, 60, qy, qs);
  const outl = (txt, x, y, size, col, maxW) => { let z = size; g.font = `800 ${z}px ${F}`; while (z > 16 && g.measureText(txt).width > maxW) { z -= 2; g.font = `800 ${z}px ${F}`; }
    g.lineJoin = 'round'; g.lineWidth = 8; g.strokeStyle = 'rgba(255,255,255,.95)'; g.strokeText(txt, x, y); g.fillStyle = col; g.fillText(txt, x, y); };
  const fx = 60 + qs + 40, fw = W - fx - 40;
  outl(T.note, fx, qy + 20, 24, '#35516F', fw); outl(T.tag(year), fx, qy + 74, 40, NAVY, fw); outl(location.host + location.pathname, fx, qy + 124, 28, '#35516F', fw);
  return cv;
}

export const liveCardLangs = [['zh', '中文'], ['ja', '日本語']];
export const canvasBlob = cv => new Promise(r => cv.toBlob(r, 'image/png'));
