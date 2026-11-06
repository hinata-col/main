// 管理後台：#admin。只有 Rules 裡 ADMIN_UID 那個 Google 帳號讀得到資料。
import { getApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getDatabase, ref, get, set } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';
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
}
