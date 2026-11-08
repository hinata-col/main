// 管理後台：#admin。只有 Rules 裡 ADMIN_UID 那個 Google 帳號讀得到資料。
import { getApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getDatabase, ref, get, set, update } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';
const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
const B = 'min-h-[44px] rounded-xl px-4 font-bold text-sm ';
let chart;
const chartJs = () => window.Chart ? Promise.resolve() : new Promise((ok, no) => { const s = el('script'); s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js'; s.onload = ok; s.onerror = no; document.head.append(s); });

export function mountAdmin(root, ctx) {
  const auth = getAuth(getApp());
  root.replaceChildren(el('h2', 'text-xl font-black mb-3', '管理後台'));
  const b = el('button', B + 'bg-sky-500 text-white', 'Google 登入（管理員）');
  b.onclick = async () => { try { await signInWithPopup(auth, new GoogleAuthProvider()); panel(root, ctx); } catch { alert('登入失敗'); } };
  root.append(b);
}
async function panel(root, { songs, cats, year }) {
  const auth = getAuth(getApp()), db = getDatabase(getApp());
  root.replaceChildren(el('p', '', '載入中…'));
  let votes;
  try { votes = (await get(ref(db, `votes/${year}`))).val() || {}; }
  catch { root.replaceChildren(el('p', '', '沒有權限。請把 database.rules.json 裡的 ADMIN_UID 換成這個 uid 並重新發布：' + auth.currentUser?.uid)); return; }
  const mk = () => Object.fromEntries(cats.map(c => [c.id, {}]));
  const all = mk(), goog = mk(); let total = 0, totalG = 0;
  Object.values(votes).forEach(v => { total++; const g = v.via === 'google'; if (g) totalG++;
    Object.entries(v.choices || {}).forEach(([c, a]) => Object.values(a).forEach(id => { if (!all[c]) return; all[c][id] = (all[c][id] || 0) + 1; if (g) goog[c][id] = (goog[c][id] || 0) + 1; })); });
  // 候選名稱快照：之後改試算表，歷年結果頁也不會跟著變
  const titles = {}; cats.forEach(c => Object.keys(all[c.id] || {}).forEach(id => { titles[id] = songs[id]?.title || id; }));
  const catNames = Object.fromEntries(cats.map(c => [c.id, c.name]));
  const result = { year, total, totalGoogle: totalG, tally: all, tallyGoogle: goog, titles, catNames, settledAt: Date.now() };
  await chartJs().catch(() => {});
  root.replaceChildren(el('h2', 'text-xl font-black', `管理後台｜${year}｜共 ${total} 人（Google ${totalG}／匿名 ${total - totalG}）`));
  const sel = el('select', 'min-h-[44px] rounded-xl border border-slate-300 px-3'); cats.forEach(c => sel.append(new Option(c.name.zh, c.id)));
  const mode = el('select', 'min-h-[44px] rounded-xl border border-slate-300 px-3'); mode.append(new Option('全部票', 'all'), new Option('僅 Google', 'g'));
  const cv = el('canvas'), row = el('div', 'flex flex-wrap gap-2 my-3');
  const draw = () => { const t = (mode.value === 'g' ? goog : all)[sel.value], e = Object.entries(t).sort((a, b) => b[1] - a[1]).slice(0, 15);
    chart?.destroy(); if (!window.Chart) return;
    chart = new Chart(cv, { type: 'bar', data: { labels: e.map(x => songs[x[0]]?.title || x[0]), datasets: [{ label: '票數', data: e.map(x => x[1]), backgroundColor: '#7EC2E8' }] }, options: { indexAxis: 'y', plugins: { legend: { display: false } } } }); };
  sel.onchange = mode.onchange = draw;
  const btn = (txt, cls, fn) => { const b = el('button', B + cls, txt); b.onclick = fn; return b; };
  row.append(sel, mode,
    btn('重新整理', 'bg-slate-100', () => panel(root, { songs, cats, year })),
    btn('結算並公開', 'bg-sky-500 text-white', async () => { if (!confirm('把統計寫入 results/（截止後所有人可讀）？')) return;
      try { await set(ref(db, `results/${year}`), result); alert('已結算'); } catch { alert('寫入失敗'); } }),
    btn('匯出 JSON', 'bg-sky-100 text-sky-700', () => { const a = el('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })); a.download = `${year}.json`; a.click(); }),
    btn('刪除本屆原始投票', 'bg-rose-50 text-rose-700', async () => { if (prompt('此操作無法復原。請先「匯出 JSON」並結算。確定請輸入 DELETE') !== 'DELETE') return;
      try { await set(ref(db, `votes/${year}`), null); alert('已刪除'); panel(root, { songs, cats, year }); } catch { alert('失敗'); } }));
  root.append(row, cv, el('p', 'text-xs text-slate-500 mt-4', '匯出的 JSON 請放到 data/results/' + year + '.json，歷年結果頁會優先讀這份靜態檔。Google 登入者的 Email 在 Firebase Authentication 頁面，需另外清理。'));
  draw();
  await reasonsPanel(root, { db, songs, cats, year });
}
// ---- 留言總表：每個獎項、每首歌，大家寫了什麼 ----
async function reasonsPanel(root, { db, songs, cats, year }) {
  const box = el('div', 'mt-8'); root.append(box, el('div', 'h-8'));
  box.append(el('h3', 'text-lg font-black mb-2', '留言總表'));
  let data;
  try { data = (await get(ref(db, `songReasons/${year}`))).val() || {}; }
  catch { box.append(el('p', 'text-sm text-rose-700', '讀不到留言。請確認已發布最新的 database.rules.json（songReasons 要允許管理員讀取）。')); return; }
  const rows = []; // { cat, song, code, nick, text }
  Object.entries(data).forEach(([song, byCode]) => Object.entries(byCode || {}).forEach(([code, r]) => Object.entries(r?.c || {}).forEach(([cat, text]) => rows.push({ cat, song, code, nick: r.n || '', text: String(text), only: Object.keys(r.c).length === 1, id: r }))));
  const order = Object.fromEntries(cats.map((c, i) => [c.id, i])), cname = Object.fromEntries(cats.map(c => [c.id, c.name.zh]));
  rows.sort((x, y) => (order[x.cat] ?? 99) - (order[y.cat] ?? 99) || (songs[x.song]?.title || x.song).localeCompare(songs[y.song]?.title || y.song, 'ja'));
  const sel = el('select', 'min-h-[44px] rounded-xl border border-slate-300 px-3'); sel.append(new Option('全部獎項', ''));
  cats.forEach(c => { const n = rows.filter(r => r.cat === c.id).length; if (n) sel.append(new Option(`${c.name.zh}（${n}）`, c.id)); });
  const q = el('input', 'min-h-[44px] rounded-xl border border-slate-300 px-3 flex-1 min-w-[140px]'); q.placeholder = '搜尋歌名、暱稱、留言';
  const bar = el('div', 'flex flex-wrap gap-2 mb-3'), list = el('div', 'space-y-4'), cnt = el('p', 'text-xs text-slate-500 mb-2');
  const csv = el('button', B + 'bg-sky-100 text-sky-700', '匯出留言 CSV');
  csv.onclick = () => { const e = s => '"' + String(s).replace(/"/g, '""') + '"', body = ['獎項,歌名,暱稱,留言,分享代碼', ...rows.map(r => [cname[r.cat] || r.cat, songs[r.song]?.title || r.song, r.nick, r.text, r.code].map(e).join(','))].join('\n');
    const a = el('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + body], { type: 'text/csv' })); a.download = `reasons-${year}.csv`; a.click(); };
  bar.append(sel, q, csv); box.append(bar, cnt, list);
  const del = async r => { if (!confirm(`刪除「${r.nick || '匿名'}」在 ${songs[r.song]?.title || r.song} 的這則留言？`)) return;
    const up = { [`shares/${year}/${r.code}/reasons/${r.cat}/${r.song}`]: null };
    up[r.only ? `songReasons/${year}/${r.song}/${r.code}` : `songReasons/${year}/${r.song}/${r.code}/c/${r.cat}`] = null;
    try { await update(ref(db), up); rows.splice(rows.indexOf(r), 1); show(); } catch { alert('刪除失敗'); } };
  const show = () => { const k = q.value.trim().toLowerCase(), v = rows.filter(r => (!sel.value || r.cat === sel.value) && (!k || [songs[r.song]?.title || r.song, r.nick, r.text].some(s => s.toLowerCase().includes(k))));
    cnt.textContent = `共 ${v.length} 則留言`; list.replaceChildren();
    let lastCat = '', lastSong = '', blk;
    v.forEach(r => { if (r.cat !== lastCat) { list.append(el('h4', 'font-black text-sky-700 mt-4', cname[r.cat] || r.cat)); lastCat = r.cat; lastSong = ''; }
      if (r.song !== lastSong) { blk = el('div', 'bg-white rounded-xl p-3 shadow-sm'); blk.append(el('div', 'font-bold mb-1', songs[r.song]?.title || r.song)); list.append(blk); lastSong = r.song; }
      const line = el('div', 'flex items-start gap-2 text-sm py-1 border-t border-slate-100'), t = el('div', 'flex-1'); t.append(el('b', 'text-sky-700', (r.nick || '匿名') + ' '), document.createTextNode('☀️ ' + r.text));
      const x = el('button', 'text-xs text-rose-600 px-2 py-1', '刪除'); x.onclick = () => del(r); line.append(t, x); blk.append(line); }); };
  sel.onchange = show; q.oninput = show; show();
}
