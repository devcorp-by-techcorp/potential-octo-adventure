const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = process.argv[2], shots = process.argv[3];
const mime = { '.html':'text/html', '.js':'application/javascript', '.png':'image/png', '.ttf':'font/ttf', '.json':'application/json', '.ico':'image/x-icon' };
const srv = http.createServer((q, r) => {
  let p = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  r.writeHead(200, { 'content-type': mime[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
}).listen(0);
const base = 'http://localhost:' + srv.address().port;
const sizes = [['phone',390,844],['phone-land',844,390],['tablet',820,1180],['tablet-land',1180,820],['narrow',320,640]];
const routes = { client:['home','gallery','inbox','documents','prints','intake','profile'], admin:['dashboard','bookings','inquiries','tracker','illuminate-kids','contacts','staff','documents','finance','content'] };
(async () => {
  const b = await chromium.launch(); const out = [];
  for (const [sn,w,h] of sizes) {
    const ctx = await b.newContext({ viewport:{width:w,height:h} }); const pg = await ctx.newPage();
    let cur = 'boot'; const errs = [];
    pg.on('pageerror', e => errs.push([cur,'pageerror',String(e).slice(0,300)]));
    pg.on('console', m => { if (m.type()==='error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push([cur,'console',m.text().slice(0,300)]); });
    const check = async (name) => {
      cur = name; await pg.waitForTimeout(700);
      const r = await pg.evaluate(() => ({ ov: document.documentElement.scrollWidth - window.innerWidth, txt: document.body.innerText.length, path: location.pathname, bad: /Unmatched Route|Something went wrong|undefined|NaN/.exec(document.body.innerText)?.[0] || '' }));
      out.push([sn,name,r.path,r.txt,r.ov,r.bad].join(' | '));
      if (shots) await pg.screenshot({ path: `${shots}/${sn}-${name.replace(/\W+/g,'_')}.png` });
    };
    await pg.goto(base + '/'); await check('marketing');
    for (const k of ['/kids','/kids/register','/kids/org']) { await pg.goto(base + k); await check('public:' + k); }
    for (const role of ['client','admin']) {
      await pg.goto(base + '/sign-in'); await check('sign-in');
      if (role==='admin') await pg.getByText(/^(studio|admin)/i).first().click().catch(e=>errs.push(['sign-in','toggle',String(e).slice(0,120)]));
      await pg.getByText(/^Enter .* portal$/i).click(); await check(role+':landing');
      for (const rt of routes[role]) {
        await pg.evaluate(p => { history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')); }, '/' + rt);
        await check(role + ':' + rt);
      }
    }
    out.push(...errs.map(e => `ERR ${sn} | ` + e.join(' | ')));
    await ctx.close();
  }
  const bad = out.filter(l => l.startsWith('ERR') || !/\| 0 \| $/.test(l));
  console.log(out.join('\n')); console.log(`\n${out.length - bad.length} clean, ${bad.length} with findings`);
  await b.close(); srv.close(); process.exit(bad.length ? 1 : 0);
})();
