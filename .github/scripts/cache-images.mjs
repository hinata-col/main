// 把圖卡會用到、但外站可能不允許畫進圖卡的圖片（MV 縮圖、封面賞的 Type A 封面）下載一份到本站 img/cache/。
// 在 GitHub Actions 上執行（那邊連得到 YouTube 與官網）。只有圖片換了或新增時才重新下載。
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import sharp from 'sharp';
const ROOT = process.cwd(), OUT = path.join(ROOT, 'img/cache'), IDX = path.join(OUT, 'index.json');
const libTmp = path.join(os.tmpdir(), 'vote-lib.mjs'); fs.copyFileSync(path.join(ROOT, 'js/vote-lib.js'), libTmp); // vote-lib.js 是 ES module 寫法，複製成 .mjs 才能匯入
const { buildData } = await import(libTmp);
const E = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/vote/editions.json'), 'utf8')), ed = E.editions[E.current];
const getText = async u => { if (process.env.LOCAL_CSV_DIR) { const k = /gid=5001/.test(u) ? 'mv' : /gid=5003/.test(u) ? 'releases' : 'songs'; return fs.readFileSync(path.join(process.env.LOCAL_CSV_DIR, k + '.csv'), 'utf8'); }
  const r = await fetch(u); if (!r.ok) throw new Error('讀不到試算表 ' + r.status); return r.text(); };
const { list } = buildData({ songs: await getText(ed.sources.songs), mv: await getText(ed.sources.mv), releases: await getText(ed.sources.releases) }, 'https://hinata-col.github.io/main/vote');
const targets = [];
for (const it of list) {
  if (it.kind === 'mv' && it.img) { const m = /i\.ytimg\.com\/vi\/([\w-]{11})\//.exec(it.img); targets.push({ id: it.id, dir: 'mv', src: it.img, tries: m ? ['maxresdefault', 'sddefault', 'hqdefault'].map(q => `https://i.ytimg.com/vi/${m[1]}/${q}.jpg`) : [it.img] }); }
  if (it.kind === 'release' && it.images?.[0]?.url) targets.push({ id: it.id, dir: 'rel', src: it.images[0].url, tries: [it.images[0].url] });
}
let idx = { t: 0, items: {} }; try { idx = JSON.parse(fs.readFileSync(IDX, 'utf8')); } catch {}
const fetchImg = async u => { for (let k = 0; k < 3; k++) { try { const r = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0 (hinata-col image cache)' } }); if (r.status === 404) return null; if (!r.ok) throw new Error(r.status);
  const b = Buffer.from(await r.arrayBuffer()); return b.length > 3000 ? b : null; } catch (e) { await new Promise(z => setTimeout(z, 1500 * (k + 1))); } } return null; };
let changed = 0; const fails = [], keep = new Set();
for (const t of targets) {
  keep.add(t.id); const f = `${t.dir}/${t.id}.jpg`, old = idx.items[t.id];
  if (old && old.src === t.src && fs.existsSync(path.join(OUT, f))) continue;
  let buf = null; for (const u of t.tries) { buf = await fetchImg(u); if (buf) break; }
  if (!buf) { fails.push(t.id + ' ' + t.src); continue; }
  const img = sharp(buf).rotate(), out = t.dir === 'mv' ? img.resize(640, 360, { fit: 'cover' }) : img.resize(600, 600, { fit: 'inside', withoutEnlargement: true });
  fs.mkdirSync(path.join(OUT, t.dir), { recursive: true }); await out.flatten({ background: '#ffffff' }).jpeg({ quality: 84, mozjpeg: true }).toFile(path.join(OUT, f));
  idx.items[t.id] = { src: t.src, f }; changed++;
}
for (const id of Object.keys(idx.items)) if (!keep.has(id)) { try { fs.unlinkSync(path.join(OUT, idx.items[id].f)); } catch {} delete idx.items[id]; changed++; }
if (changed) { idx.t = Date.now(); fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(IDX, JSON.stringify(idx, null, 1)); }
console.log(`目標 ${targets.length} 張，更新 ${changed} 張，失敗 ${fails.length} 張`); fails.forEach(x => console.log('  失敗：' + x));
