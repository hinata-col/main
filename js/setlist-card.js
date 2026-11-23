// LIVE試聽歌單的分享圖卡（歌單頁的「下載圖卡」按鈕用）：深綠×米金，與歌單頁同一套風格。
// 只畫「場次、日期、場地、曲順」，另外附投票網址的 QR code，方便在社群轉發。
import { steadyBold, drawQR } from './oshi.js?v=20261123b';

const W = 1080, H = 1350, GREEN = '#2A6B43', DARK = '#1F3D2B', BEIGE = '#CDBB93', CREAM = '#EFE6CB';
const F = '"VoteRound","Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
const TX = {
  zh: { sub: 'LIVE 試聽歌單', tour: '日向坂46 ARENA TOUR「ひなくり2026」', ask: '你最喜歡的日向坂歌曲是哪一首？', go: '左：聽歌單　右：投票', note: '粉絲自製・非官方', qa: '聽歌單', qb: '投票', more: n => `…還有 ${n} 首`,
    tag: y => `#日向坂46　#日向坂46歌曲總選舉${y}　#ひなくり2026`, t1: '#日向坂46　#ひなくり2026', t2: y => `#日向坂46歌曲總選舉${y}` },
  ja: { sub: 'LIVE 試聴セトリ', tour: '日向坂46 ARENA TOUR「ひなくり2026」', ask: 'あなたの一番好きな日向坂の曲は？', go: '左：セトリ　右：投票', note: 'ファン有志による非公式企画', qa: 'セトリ', qb: '投票', more: n => `…ほか${n}曲`,
    tag: y => `#日向坂46　#日向坂46楽曲総選挙${y}　#ひなくり2026`, t1: '#日向坂46　#ひなくり2026', t2: y => `#日向坂46楽曲総選挙${y}` }
};
const QR_SL = '1fce9ba7f,1043f9141,17579cc5d,17555345d,1757a4e5d,105b71841,1fd55557f,001f64d00,17cfe827c,129d07a6d,1f5835c14,1b00539dd,19df049bb,000b792eb,1364c6dca,1b3b17ccc,1fe18a7b9,171cdb26d,1e7238536,02a6ef2fe,0dce53fb9,1b34e4a4d,12cdb1162,16bd20c0d,1577a85f3,001e16915,1fc4e4b56,105e51f1e,1756469f8,1757b1799,17590e468,104f17e9c,1fdd8e7aa'.split(','), QR_SL_N = 33; // 歌單頁網址（…/vote#setlist）的 QR code
const drawMatrix = (g, x, y, size, rows, n, col) => { const c = size / n; g.save(); g.fillStyle = '#fff'; g.fillRect(x, y, size, size); g.fillStyle = col; rows.forEach((h, r) => { const bits = parseInt(h, 16).toString(2).padStart(n, '0'); for (let i = 0; i < n; i++) if (bits[i] === '1') g.fillRect(x + i * c, y + r * c, Math.ceil(c), Math.ceil(c)); }); g.restore(); };
// 粉圓體沒有「櫸」，統一換成字型有的「欅」
const uni = s => String(s ?? '').replace(/櫸/g, '欅');
const spaced = (g, s, cx, y, gap) => { const cs = [...s], ws = cs.map(c => g.measureText(c).width), tot = ws.reduce((a, b) => a + b, 0) + gap * (cs.length - 1); let x = cx - tot / 2; g.textAlign = 'left'; cs.forEach((c, i) => { g.fillText(c, x, y); x += ws[i] + gap; }); };

/** o = { lang, year, show:{name,date,venue,list:[{n,id,title}]}, items:{id:歌曲} }，回傳 1080×1350 的 canvas */
export async function makeSetlistCard(o) {
  const { lang, year, show, items } = o, T = TX[lang] || TX.zh;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = steadyBold(cv.getContext('2d'));
  const title = x => uni(items[x.id]?.title || x.title || x.id);
  const MAXN = 36, list = show.list.slice(0, MAXN), extra = show.list.length - list.length;
  const venue = String(show.venue || '').replace(/\s*[（(][^）)]+[）)]\s*$/, '');
  const m = show.name.match(/^(.*?)\s*(?:Day|DAY|day|日目)\s*(\d+)\s*$/), place = m ? m[1].trim() : show.name, day = m ? 'Day' + m[2] : '';
  const head = venue || place;
  try { await document.fonts.load('40px VoteRound', T.sub + T.tour + T.ask + T.go + T.note + T.tag(year) + head + show.date + list.map(title).join('') + '0123456789/:#…'); } catch {}
  // 背景
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#33724C'); bg.addColorStop(1, '#234F37'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.save(); g.globalAlpha = .05; g.strokeStyle = '#fff'; g.lineWidth = 2; for (let r = 60; r < 1700; r += 34) { g.beginPath(); g.arc(300, 520, r, 0, 7); g.stroke(); } g.restore();
  g.strokeStyle = BEIGE; g.lineWidth = 3; g.strokeRect(24, 24, W - 48, H - 48);
  // 標題
  g.textAlign = 'center'; g.fillStyle = BEIGE; g.font = 'italic 400 128px Georgia, "Times New Roman", serif'; g.fillText('Setlist', W / 2, 168);
  g.fillStyle = CREAM; g.font = `400 34px ${F}`; spaced(g, T.sub, W / 2, 232, 10);
  g.font = `400 32px ${F}`; g.textAlign = 'center'; g.fillText(T.tour, W / 2, 284);
  // 場次卡片
  const X = 60, CW = W - 120, CY = 320, BH = 170;
  g.fillStyle = '#fff'; g.fillRect(X, CY, CW, 760); g.strokeStyle = DARK; g.lineWidth = 2; g.strokeRect(X, CY, CW, 760);
  g.fillStyle = GREEN; g.fillRect(X, CY, CW, BH);
  if (day) { g.fillStyle = BEIGE; g.beginPath(); g.moveTo(X, CY); g.lineTo(X + 190, CY); g.lineTo(X + 160, CY + 54); g.lineTo(X, CY + 54); g.closePath(); g.fill(); g.fillStyle = '#fff'; g.font = `900 30px ${F}`; g.textAlign = 'left'; g.fillText(day, X + 22, CY + 38); }
  g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = `900 54px ${F}`; g.fillText(show.date || show.name, W / 2, CY + 100);
  g.fillStyle = '#E4EEDF'; g.font = `400 32px ${F}`; let hs = head; while (g.measureText(hs).width > CW - 60 && hs.length > 4) hs = hs.slice(0, -2) + '…'; g.fillText(hs, W / 2, CY + 146);
  // 曲目
  const AY = CY + BH + 26, AH = 760 - BH - 46, n = list.length, two = n > 12, rows = two ? Math.ceil(n / 2) : n, rh = Math.min(n <= 8 ? 100 : two ? 62 : 78, Math.floor(AH / Math.max(1, rows + (extra ? 1 : 0)))), fs = Math.max(20, Math.min(n <= 8 ? 44 : two ? 30 : 38, Math.round(rh * .56)));
  const colW = two ? (CW - 60) / 2 : CW - 100, mw = colW - 80 - (two ? 14 : 0), tx = two ? 56 : 66;
  // 歌名太長時換到第二行（最多兩行，還是放不下才用「…」）；整欄放不下時整體縮小
  const wrap = (txt, fsz) => { g.font = `900 ${fsz}px ${F}`; const cs = Array.from(txt), ls = []; let cur = '';
    for (const ch of cs) { if (cur && g.measureText(cur + ch).width > mw) { ls.push(cur); cur = ch; } else cur += ch; }
    if (cur) ls.push(cur);
    if (ls.length === 2) { // 兩行時改成盡量對稱，避免第二行只剩一兩個字；優先在空白或「？！」後面斷行
      const all = Array.from(ls.join('')), bad = '?!？！。、」』）ー…', best = { k: 0, sc: 1e9 };
      for (let k = 1; k < all.length; k++) { const a1 = all.slice(0, k).join(''), b1 = all.slice(k).join(''), w1 = g.measureText(a1).width, w2 = g.measureText(b1).width; if (w1 > mw || w2 > mw) continue;
        const sc = Math.abs(w1 - w2) + (bad.includes(all[k]) ? 600 : 0) + (/[\s?!？！]/.test(all[k - 1]) ? 0 : 220); if (sc < best.sc) { best.k = k; best.sc = sc; } }
      if (best.k) return [all.slice(0, best.k).join('').trim(), all.slice(best.k).join('').trim()];
    }
    if (ls.length > 2) { let l2 = ls.slice(1).join(''); while (g.measureText(l2 + '…').width > mw && l2.length > 1) l2 = l2.slice(0, -1); return [ls[0], l2 + '…']; }
    return ls; };
  let L = null;
  for (let sc = 1; sc >= .55; sc -= .05) {
    const rhS = rh * sc, fsS = Math.max(15, Math.round(fs * sc)), lh = fsS * 1.2;
    const items2 = list.map(x => { const ls = wrap(title(x), fsS); return { x, ls, h: ls.length > 1 ? rhS * .55 + lh * ls.length : rhS }; });
    const cols = two ? [items2.slice(0, rows), items2.slice(rows)] : [items2];
    const tot = Math.max(...cols.map(c => c.reduce((a, b) => a + b.h, 0)));
    L = { rhS, fsS, lh, cols }; if (tot <= AH - (extra ? rhS * .8 : 0)) break;
  }
  L.cols.forEach((col, ci) => { let y = AY; const cx = X + 30 + ci * colW;
    col.forEach(({ x, ls, h }, r) => { const cy = y + h / 2;
      if (r > 0) { g.fillStyle = '#C9D6CD'; for (let dx = 0; dx < colW - 10; dx += 8) g.fillRect(cx + dx, y, 3, 2); }
      g.textAlign = 'left'; g.fillStyle = GREEN; g.font = `italic 400 ${Math.round(L.fsS * 1.1)}px Georgia, serif`; g.fillText(String(x.n), cx + 4, cy + L.fsS * .36);
      g.fillStyle = DARK; g.font = `900 ${L.fsS}px ${F}`;
      ls.forEach((t, li) => g.fillText(t, cx + tx, cy + L.fsS * .34 + (li - (ls.length - 1) / 2) * L.lh));
      y += h; }); });
  if (extra) { g.fillStyle = GREEN; g.font = `800 ${Math.max(20, fs - 4)}px ${F}`; g.textAlign = 'right'; g.fillText(T.more(extra), X + CW - 30, CY + 760 - 20); }
  // 頁尾：兩個 QR code（左：歌單頁、右：投票頁）、邀請語、hashtag、網址
  const qs = 124, qy = 1122, q1 = 64, q2 = q1 + qs + 40;
  [[q1, 0, T.qa], [q2, 1, T.qb]].forEach(([x, k, lb]) => { g.fillStyle = '#fff'; g.beginPath(); g.roundRect(x - 8, qy - 8, qs + 16, qs + 16, 8); g.fill();
    if (k) drawQR(g, x, qy, qs, '#14263D'); else drawMatrix(g, x, qy, qs, QR_SL, QR_SL_N, '#14263D');
    g.textAlign = 'center'; g.fillStyle = CREAM; g.font = `800 24px ${F}`; g.fillText(lb, x + qs / 2, qy + qs + 38); });
  const fx = q2 + qs + 36, fw = W - fx - 44; g.textAlign = 'left';
  const line = (s, y, size, col, wt = 800) => { let z = size; g.font = `${wt} ${z}px ${F}`; while (z > 16 && g.measureText(s).width > fw) { z -= 2; g.font = `${wt} ${z}px ${F}`; } g.fillStyle = col; g.fillText(s, fx, y); };
  line(T.ask, qy + 40, 40, '#F0D98A', 900); line(T.t1, qy + 92, 30, BEIGE, 700); line(T.t2(year), qy + 130, 30, BEIGE, 700);
  g.textAlign = 'center'; g.fillStyle = 'rgba(239,230,203,.8)'; g.font = `700 22px ${F}`; g.fillText(T.note, W / 2, H - 34);
  return cv;
}
export const canvasBlob = cv => new Promise(r => cv.toBlob(r, 'image/png'));
