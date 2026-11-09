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
  // 已經用 Google 登入（例如重新整理後）就直接進後台，不用再按一次登入；沒權限時 panel 會顯示提示
  if (auth.currentUser && !auth.currentUser.isAnonymous) panel(root, ctx);
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
    // 依隱私說明：匿名投票（含分享頁與推薦理由）在結果公布 3 個月後刪除；Google 登入的投票保留
    btn('刪除匿名投票（含分享頁與理由）', 'bg-rose-50 text-rose-700', async () => {
      const anon = Object.entries(votes).filter(([, v]) => v.via !== 'google'), codes = new Set(anon.map(([, v]) => v.share).filter(Boolean));
      if (prompt(`將刪除 ${anon.length} 筆匿名投票與 ${codes.size} 個分享頁（含推薦理由），無法復原。請先「結算並公開」與「匯出 JSON」。確定請輸入 DELETE`) !== 'DELETE') return;
      try { let sr = {}; try { sr = (await get(ref(db, `songReasons/${year}`))).val() || {}; } catch {}
        const up = {}; anon.forEach(([u]) => { up[`votes/${year}/${u}`] = null; }); codes.forEach(c => { up[`shares/${year}/${c}`] = null; });
        Object.entries(sr).forEach(([sid, m]) => Object.keys(m || {}).forEach(c => { if (codes.has(c)) up[`songReasons/${year}/${sid}/${c}`] = null; }));
        if (Object.keys(up).length) await update(ref(db), up); alert(`已刪除 ${anon.length} 筆匿名投票`); panel(root, { songs, cats, year }); } catch { alert('失敗'); } }));
  root.append(row, cv, el('p', 'text-xs text-slate-500 mt-4', '結算流程：截止 → 結算並公開 → 匯出 JSON 放到 data/results/' + year + '.json（歷年結果頁會優先讀這份）→ 結果公布 3 個月後按「刪除匿名投票」。Google 登入的投票依隱私說明保留到本人刪除。'));
  await analyticsPanel(root, { db, cats, songs, year, votes });
  await livePanel(root, { db, cats, songs, year, all, refresh: () => panel(root, { songs, cats, year }) });
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

// ---- 速報：前台只顯示名次（不含票數）。同票同名次；每個獎項最多存 8 筆（前 5 名含同名次） ----
async function livePanel(root, { db, cats, songs, year, all, refresh }) {
  const rankOf = t => { const out = []; let prev = null, r = 0; Object.entries(t || {}).sort((a, b) => b[1] - a[1]).forEach(([id, n], k) => { if (n !== prev) { r = k + 1; prev = n; } if (r <= 5 && out.length < 8) out.push({ i: id, r, n }); }); return out; };
  const top = cats.map(c => [c, rankOf(all[c.id])]).filter(([, v]) => v.length);
  let cur = null; try { cur = (await get(ref(db, `live/${year}`))).val(); } catch {}
  const box = el('div', 'mt-8 p-4 rounded-2xl bg-amber-50 border border-amber-200');
  box.append(el('h3', 'text-lg font-black', '速報（前台只顯示名次）'),
    el('p', 'text-sm text-slate-600 my-1', cur ? `目前公開：第 ${cur.round} 回（${new Date(cur.t).toLocaleString('zh-TW', { hour12: false })}）` : '目前沒有公開的速報'));
  const pv = el('details', 'my-2'); pv.append(el('summary', 'cursor-pointer font-bold text-sm', '預覽這次要發布的內容（括號是票數，只有你看得到）'));
  top.forEach(([c, v]) => { const d = el('div', 'text-sm mt-2'); d.append(el('b', '', c.name.zh + '：')); d.append(document.createTextNode(v.map(x => `${x.r}. ${songs[x.i]?.title || x.i}（${x.n}）`).join('　'))); pv.append(d); });
  const row = el('div', 'flex flex-wrap gap-2');
  const b1 = el('button', B + 'bg-amber-400 text-slate-900', `發布第 ${(cur?.round || 0) + 1} 回速報`);
  b1.onclick = async () => { if (!top.length) return alert('還沒有票'); if (!confirm('以目前票數發布速報？前台會顯示各獎項前 5 名（只有名次）。')) return;
    try { await set(ref(db, `live/${year}`), { round: (cur?.round || 0) + 1, t: Date.now(), cats: Object.fromEntries(top.map(([c, v]) => [c.id, v.map(({ i, r }) => ({ i, r }))])) }); alert('已發布'); refresh(); } catch { alert('發布失敗：請確認資料庫規則已加入 live'); } };
  const b2 = el('button', B + 'bg-white text-rose-700 border border-rose-200', '撤下速報');
  b2.onclick = async () => { if (!cur || !confirm('撤下後前台不再顯示速報。確定？')) return; try { await set(ref(db, `live/${year}`), null); alert('已撤下'); refresh(); } catch { alert('失敗'); } };
  row.append(b1, b2); box.append(pv, row); root.append(box);
}

// ---- 數據分析：每日新增、時段、獎項參與率、完整度、理由與分享、語言、可疑匿名票 ----
// 舊票沒有 createdAt（2026/11/9 之前投的），用 updatedAt 代替，數字會標示「估計」
const TZ = 'Asia/Taipei', dayOf = ts => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ts),
  hourOf = ts => +new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(ts), pct = (a, b) => b ? Math.round(a * 1000 / b) / 10 : 0;
const AN_CSS = `.an{margin-top:32px;padding:18px;border-radius:20px;background:#F4F9FD;border:1px solid #D6E8F5;color:#1F3552;font-family:inherit}
.an h3{font-size:20px;font-weight:900;margin:0 0 4px}.an .an-sub{font-size:13px;color:#4A6178;margin:0 0 14px}
.an .an-kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:16px}
.an .an-kpi{background:#fff;border-radius:14px;padding:12px 14px;box-shadow:0 2px 8px rgba(31,53,82,.08)}.an .an-kpi b{display:block;font-size:26px;font-weight:900;line-height:1.2}.an .an-kpi span{font-size:12px;color:#4A6178;font-weight:700}
.an .an-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px}
.an .an-card{background:#fff;border-radius:16px;padding:14px;box-shadow:0 2px 8px rgba(31,53,82,.08)}.an .an-card h4{margin:0 0 8px;font-size:15px;font-weight:900}.an .an-card p{margin:6px 0 0;font-size:12px;color:#4A6178}
.an .an-cv{position:relative;height:240px}.an .an-cv.tall{height:auto}
.an table{width:100%;border-collapse:collapse;font-size:13px}.an td,.an th{padding:6px 4px;border-top:1px solid #EEF3F8;text-align:left;vertical-align:top}.an th{font-size:12px;color:#4A6178}
.an .an-tag{display:inline-block;background:#FFE3EA;color:#C2335A;border-radius:99px;padding:0 8px;font-size:12px;font-weight:800}`;
async function analyticsPanel(root, { db, cats, songs, year, votes }) {
  if (!document.getElementById('an-css')) { const st = el('style'); st.id = 'an-css'; st.textContent = AN_CSS; document.head.append(st); }
  const V = Object.entries(votes).map(([uid, v]) => ({ uid, ...v, t0: v.createdAt || v.updatedAt || 0, est: !v.createdAt, ch: Object.fromEntries(Object.entries(v.choices || {}).map(([c, a]) => [c, Object.values(a || {})]).filter(([, a]) => a.length)) })).filter(v => v.t0);
  const n = V.length, nG = V.filter(v => v.via === 'google').length, nEst = V.filter(v => v.est).length;
  let sr = {}; try { sr = (await get(ref(db, `songReasons/${year}`))).val() || {}; } catch {}
  const why = {}, whyCodes = new Set(); Object.values(sr).forEach(m => Object.entries(m || {}).forEach(([code, r]) => { whyCodes.add(code); Object.keys(r?.c || {}).forEach(c => { why[c] = (why[c] || 0) + 1; }); }));
  const today = dayOf(Date.now()), days = [], byDay = {}, upDay = {};
  V.forEach(v => { const d = dayOf(v.t0); byDay[d] = (byDay[d] || 0) + 1; if (!v.est && v.updatedAt && v.updatedAt - v.createdAt > 60000) { const u = dayOf(v.updatedAt); upDay[u] = (upDay[u] || 0) + 1; } });
  if (n) { const start = Math.min(...V.map(v => v.t0)); for (let t = start; dayOf(t) <= today; t += 864e5) { const d = dayOf(t); if (days.at(-1) !== d) days.push(d); } if (days.at(-1) !== today) days.push(today); }
  let acc = 0; const cum = days.map(d => (acc += byDay[d] || 0)), last7 = days.slice(-7).reduce((s, d) => s + (byDay[d] || 0), 0);
  const hours = Array(24).fill(0); V.forEach(v => { hours[hourOf(v.t0)]++; });
  const filled = V.map(v => Object.keys(v.ch).length), maxF = Math.max(1, ...filled), hist = Array.from({ length: maxF }, (_, i) => filled.filter(f => f === i + 1).length);
  const withL = V.filter(v => v.l), nJa = withL.filter(v => v.l === 'ja').length, nShare = V.filter(v => v.share).length;
  const box = el('section', 'an'); root.append(box);
  box.append(el('h3', '', '數據分析'), el('p', 'an-sub', `時間以台灣時間計。${nEst ? `有 ${nEst} 張票是記錄「第一次投票時間」之前投的，以最後更新時間估計，每日數字僅供參考。` : ''}`));
  const kpis = el('div', 'an-kpis'); box.append(kpis);
  [[n, '投票人數'], [`${nG}／${n - nG}`, 'Google／匿名'], [byDay[today] || 0, '今天新增'], [last7, '近 7 天新增'],
   [n ? (filled.reduce((s, f) => s + f, 0) / n).toFixed(1) : 0, '平均投了幾個獎項'], [`${pct(whyCodes.size, n)}%`, `寫推薦理由（${whyCodes.size} 人）`],
   [`${pct(nShare, n)}%`, `公開分享頁（${nShare} 人）`], [withL.length ? `${pct(nJa, withL.length)}%` : '—', `日文介面（有紀錄的 ${withL.length} 人中）`]]
    .forEach(([v, l]) => { const k = el('div', 'an-kpi'); k.append(el('b', '', String(v)), el('span', '', l)); kpis.append(k); });
  const grid = el('div', 'an-grid'); box.append(grid);
  const card = (title, note, tall) => { const c = el('div', 'an-card'), w = el('div', 'an-cv' + (tall ? ' tall' : '')), cv = el('canvas'); w.append(cv); c.append(el('h4', '', title), w); if (note) c.append(el('p', '', note)); grid.append(c); return [cv, w]; };
  const charts = [];
  const mk = (cv, cfg) => { if (window.Chart) charts.push(new Chart(cv, { ...cfg, options: { maintainAspectRatio: false, plugins: { legend: { display: !!cfg.legend } }, ...(cfg.options || {}) } })); };
  const [c1] = card('每日新增投票人數與累計', '長條：當天新增（左軸）；折線：累計人數（右軸）');
  mk(c1, { type: 'bar', legend: true, data: { labels: days.map(d => d.slice(5)), datasets: [{ type: 'bar', label: '當天新增', data: days.map(d => byDay[d] || 0), backgroundColor: '#7EC2E8', yAxisID: 'y' }, { type: 'line', label: '累計', data: cum, borderColor: '#1F3552', backgroundColor: '#1F3552', pointRadius: 2, tension: .25, yAxisID: 'y1' }] },
    options: { scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, ticks: { precision: 0 } } } } });
  const [c2] = card('每天有改票的人數', '投票後又回來修改的人，依「最後一次改票」的日期計；只算有記錄第一次投票時間的票');
  mk(c2, { type: 'bar', data: { labels: days.map(d => d.slice(5)), datasets: [{ data: days.map(d => upDay[d] || 0), backgroundColor: '#F5E050' }] }, options: { scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } } });
  const [c3] = card('投票時段（幾點投的）', '可以參考這個決定發社群文的時間');
  mk(c3, { type: 'bar', data: { labels: hours.map((_, h) => `${h}`), datasets: [{ data: hours, backgroundColor: '#7EC2E8' }] }, options: { scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } } });
  const [c4] = card('每人投了幾個獎項', '橫軸是投了幾個獎項，縱軸是人數');
  mk(c4, { type: 'bar', data: { labels: hist.map((_, i) => `${i + 1}`), datasets: [{ data: hist, backgroundColor: '#1F3552' }] }, options: { scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } } });
  const part = cats.map(c => { const vs = V.filter(v => v.ch[c.id]); return { c, rate: pct(vs.length, n), avg: vs.length ? (vs.reduce((s, v) => s + v.ch[c.id].length, 0) / vs.length).toFixed(1) : '0', why: why[c.id] || 0 }; });
  const [c5, w5] = card('各獎項參與率', '有投這個獎項的人 ÷ 全部投票人數；括號是平均選幾首、寫了幾則理由', true); w5.style.height = (cats.length * 26 + 40) + 'px';
  mk(c5, { type: 'bar', data: { labels: part.map(p => `${p.c.name.zh}（${p.avg} 首・${p.why} 則）`), datasets: [{ data: part.map(p => p.rate), backgroundColor: part.map(p => p.rate >= 50 ? '#7EC2E8' : '#F5B7C5') }] },
    options: { indexAxis: 'y', scales: { x: { min: 0, max: 100, ticks: { callback: v => v + '%' } } } } });
  // 可疑匿名票：內容完全一樣、且至少投了 3 個獎項的匿名票
  const groups = {}; V.filter(v => v.via !== 'google' && Object.keys(v.ch).length >= 3).forEach(v => { const k = JSON.stringify(Object.keys(v.ch).sort().map(c => [c, [...v.ch[c]].sort()])); (groups[k] ||= []).push(v); });
  const sus = Object.values(groups).filter(g => g.length >= 2).sort((a, b) => Object.keys(b[0].ch).length - Object.keys(a[0].ch).length || b.length - a.length);
  const sc = el('div', 'an-card'); sc.style.marginTop = '12px'; sc.append(el('h4', '', `可疑匿名票（內容完全一樣、至少 3 個獎項）：${sus.length} 組`)); box.append(sc);
  if (!sus.length) sc.append(el('p', '', '目前沒有發現。'));
  else { const tb = el('table'); tb.innerHTML = '<tr><th>張數</th><th>獎項數</th><th>時間範圍</th><th>內容（前 3 個獎項）</th></tr>'; sus.slice(0, 30).forEach(g => { const tr = el('tr'), ts = g.map(v => v.t0), fmt = t => new Date(t).toLocaleString('zh-TW', { timeZone: TZ, hour12: false, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const td = (x, cls) => { const e = el('td'); if (cls) { const s = el('span', cls, x); e.append(s); } else e.textContent = x; return e; };
      tr.append(td(`${g.length} 張`, 'an-tag'), td(String(Object.keys(g[0].ch).length)), td(`${fmt(Math.min(...ts))} ～ ${fmt(Math.max(...ts))}`), td(Object.entries(g[0].ch).slice(0, 3).map(([c, a]) => `${cats.find(x => x.id === c)?.name.zh || c}：${a.map(i => songs[i]?.title || i).join('、')}`).join('／'))); tb.append(tr); });
    sc.append(tb, el('p', '', '內容一模一樣只是線索：大家都選熱門歌時也會巧合撞票，填的獎項越多越可疑。網站看不到 IP，無法確定是同一人。')); }
}
