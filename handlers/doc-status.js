import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

const FILE_PATH = path.join(process.cwd(), 'storage');
let LastReloadTime = 0;

// Simple in-memory cache to refresh daily
const statsCache = new Map(); // docId -> { date: 'YYYY-MM-DD', stats }

function ymd(date) {
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${da}`;
}

async function readLogForDoc(docId) {
    try {
        await fsp.access(FILE_PATH);
    } catch {
        return [];
    }

    const files = await fsp.readdir(FILE_PATH);
    // readLogName format: `${docName}_${docId}.${docType}.json`
    const candidates = files.filter(f => f.endsWith('.json') && f.includes(`_${docId}.`));
    console.log({ docId, files, candidates });

    if (candidates.length === 0) return [];

    // If multiple matches, pick the latest by mtime
    let target = candidates[0];
    console.log(candidates);
    if (candidates.length > 1) {
        let latestMtime = 0;
        for (const f of candidates) {
            const stat = await fsp.stat(path.join(FILE_PATH, f));
            if (stat.mtimeMs > latestMtime) {
                latestMtime = stat.mtimeMs;
                target = f;
            }
        }
    }

    try {
        const raw = await fsp.readFile(path.join(FILE_PATH, target), 'utf8');
        const arr = JSON.parse(raw);
        if (!Array.isArray(arr)) return [];
        return arr;
    } catch {
        return [];
    }
}

function aggregateDailyPvUv(reads) {
    // reads: [{ name, nickname, lastTs }]
    const byDay = new Map(); // day -> { pv, users:Set }
    let totalPv = 0;
    const globalUsers = new Set();

    for (const r of reads) {
        const ts = Number(r.lastTs || 0);
        if (!Number.isFinite(ts) || ts <= 0) continue;
        const day = ymd(ts);
        if (!byDay.has(day)) byDay.set(day, { pv: 0, users: new Set() });
        const bucket = byDay.get(day);
        bucket.pv += 1;
        const uid = r.name || r.nickname || 'unknown';
        bucket.users.add(uid);
        totalPv += 1;
        globalUsers.add(uid);
    }

    // Sort days ascending
    const days = Array.from(byDay.keys()).sort();
    const pvSeries = [];
    const uvSeries = [];
    for (const d of days) {
        const bucket = byDay.get(d);
        pvSeries.push(bucket.pv);
        uvSeries.push(bucket.users.size);
    }

    return {
        days,
        pvSeries,
        uvSeries,
        totalPv,
        totalUv: globalUsers.size,
    };
}

async function getStats(docId, forceRefresh = false) {
    const today = ymd(Date.now());
    const cache = statsCache.get(docId);
    if (!forceRefresh && cache && cache.date === today) return cache.stats;

    const reads = await readLogForDoc(docId);
    const stats = aggregateDailyPvUv(reads);
    statsCache.set(docId, { date: today, stats });
    return stats;
}

function renderHtml(docId, stats) {
    const title = `文档 ${docId} - PV/UV 统计`;
    // Inline data as script injection-safe JSON
    const dataJson = JSON.stringify(stats);
    return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
  <style>
    :root { --bg:#0b1220; --card:#121a2b; --text:#e6edf3; --muted:#9fb0c7; --accent:#6ea8fe; --pv:#6ea8fe; --uv:#7ee787; }
    *{box-sizing:border-box}
    body{margin:0; font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif; background:linear-gradient(180deg,#0b1220,#0e1526); color:var(--text)}
    header{padding:24px 20px 8px;}
    h1{margin:0;font-size:20px; font-weight:600}
    .sub{color:var(--muted); font-size:13px; margin-top:6px}
    .container{max-width:1080px; margin:0 auto; padding:8px 16px 32px}
    .cards{display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:14px; margin:16px 0 20px}
    .card{background:radial-gradient(1200px 1200px at -10% -10%,rgba(110,168,254,0.08),transparent),radial-gradient(1200px 1200px at 110% -10%,rgba(126,231,135,0.06),transparent),var(--card); border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:14px 16px}
    .card-title{color:var(--muted); font-size:12px; letter-spacing:.4px}
    .card-value{font-size:26px; font-weight:700; margin-top:6px}
    .chart-card{padding:0; overflow:hidden}
    #chart{width:100%; height:480px}
    footer{color:var(--muted); font-size:12px; text-align:center; padding:16px}
    .row{display:flex; gap:10px; align-items:center}
    button.refresh{background:#1b2338; color:var(--text); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:8px 12px; cursor:pointer}
    button.refresh:hover{background:#1f2942}
    .legend{display:flex; gap:16px; align-items:center; font-size:12px; color:var(--muted)}
    .dot{inline-size:10px; block-size:10px; border-radius:999px; display:inline-block}
    .d-pv{background:var(--pv)} .d-uv{background:var(--uv)}
  </style>
  <script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js" crossorigin="anonymous"></script>
</head>
<body>
  <header class="container">
    <div class="row" style="justify-content:space-between">
      <div>
        <h1>${title}</h1>
        <div class="sub">每日统计，自动每日刷新（可手动刷新）</div>
      </div>
      <div class="row">
        <div class="legend"><span class="dot d-pv"></span>PV <span class="dot d-uv"></span>UV</div>
        <button class="refresh" id="refreshBtn">刷新数据</button>
      </div>
    </div>
  </header>
  <main class="container">
    <section class="cards">
      <div class="card"><div class="card-title">累计 PV</div><div class="card-value" id="totalPv">-</div></div>
      <div class="card"><div class="card-title">累计 UV</div><div class="card-value" id="totalUv">-</div></div>
      <div class="card"><div class="card-title">最近一天 PV</div><div class="card-value" id="lastPv">-</div></div>
      <div class="card"><div class="card-title">最近一天 UV</div><div class="card-value" id="lastUv">-</div></div>
    </section>
    <section class="card chart-card">
      <div id="chart"></div>
    </section>
  </main>
  <footer>数据来源于上报日志 · 仅用于可视化统计</footer>
  <script>
    const docId = ${JSON.stringify(docId)};
    let bootstrap = ${dataJson};

    function updateSummary(s){
      const days = s.days || [];
      const pv = s.pvSeries || [];
      const uv = s.uvSeries || [];
      document.getElementById('totalPv').textContent = s.totalPv ?? 0;
      document.getElementById('totalUv').textContent = s.totalUv ?? 0;
      const lastPv = pv.length ? pv[pv.length - 1] : 0;
      const lastUv = uv.length ? uv[uv.length - 1] : 0;
      document.getElementById('lastPv').textContent = lastPv;
      document.getElementById('lastUv').textContent = lastUv;
    }

    function initChart(s){
      const el = document.getElementById('chart');
      const chart = echarts.init(el, null, { renderer: 'canvas' });
      const option = {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis' },
        legend: { data: ['PV','UV'], textStyle:{ color:'#c9d1d9' } },
        grid: { left: 40, right: 24, top: 40, bottom: 40 },
        xAxis: { type: 'category', boundaryGap: false, data: s.days, axisLabel:{ color:'#9fb0c7' }, axisLine:{ lineStyle:{ color:'#334155' } } },
        yAxis: { type: 'value', axisLabel:{ color:'#9fb0c7' }, splitLine:{ lineStyle:{ color:'rgba(148,163,184,0.15)' } } },
        series: [
          { name:'PV', type:'line', smooth:true, symbol:'circle', symbolSize:6, itemStyle:{ color:'#6ea8fe' }, areaStyle:{ color:'rgba(110,168,254,0.12)' }, data: s.pvSeries },
          { name:'UV', type:'line', smooth:true, symbol:'circle', symbolSize:6, itemStyle:{ color:'#7ee787' }, areaStyle:{ color:'rgba(126,231,135,0.10)' }, data: s.uvSeries }
        ]
      };
      chart.setOption(option);
      window.addEventListener('resize', () => chart.resize());
      return chart;
    }

    async function fetchStats(refresh){
      const url = new URL(window.location.href);
      url.searchParams.set('format','json');
      if (refresh) url.searchParams.set('refresh','1');
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error('网络错误');
      return res.json();
    }

    updateSummary(bootstrap);
    const chart = initChart(bootstrap);
    document.getElementById('refreshBtn').addEventListener('click', async () => {
      const btn = document.getElementById('refreshBtn');
      btn.disabled = true; btn.textContent = '刷新中…';
      try {
        const data = await fetchStats(true);
        bootstrap = data; updateSummary(data);
        chart.setOption({ xAxis: { data: data.days }, series: [{ data: data.pvSeries }, { data: data.uvSeries }] });
      } catch(e){ console.error(e); alert('刷新失败'); }
      finally { btn.disabled = false; btn.textContent = '刷新数据'; }
    });
  </script>
</body>
</html>`;
}

export async function handler(req, res) {
    const { docId } = req.params;
    const refresh = req.query.refresh === '1';
    // Allow embedding this route in iframes by removing X-Frame-Options and relaxing frame-ancestors
    res.removeHeader('X-Frame-Options');
    res.setHeader(
        'Content-Security-Policy',
        [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data:",
            "font-src 'self' data:",
            "connect-src 'self'",
            // Allow embedding from any http/https origin
            'frame-ancestors http: https:',
        ].join('; ')
    );
    let force = refresh;
    if (force && Date.now() - LastReloadTime < 30 * 60 * 1000) {
        force = false;
    }
    if (force) {
        LastReloadTime = Date.now();
    }

    const stats = await getStats(docId, force);
    // Support JSON response via query
    if ((req.query.format || '').toString().toLowerCase() === 'json') {
        return res.json(stats);
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(renderHtml(docId, stats));
}
