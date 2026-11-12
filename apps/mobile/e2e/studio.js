// Studio records: accepting an inquiry must create a booking every admin screen can see.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = process.argv[2];
const mime = { '.html':'text/html', '.js':'application/javascript', '.png':'image/png', '.ttf':'font/ttf', '.json':'application/json' };
const srv = http.createServer((q, r) => { let p = path.join(root, decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html'); r.writeHead(200, { 'content-type': mime[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); }).listen(0);
const base = 'http://localhost:' + srv.address().port;
const res = []; const ok = (n, c, x = '') => res.push(`${c ? 'PASS' : 'FAIL'}  ${n}${c ? '' : '  ' + x}`);
(async () => {
  const b = await chromium.launch();
  for (const [sn, w, h] of [['phone', 390, 844], ['tablet-land', 1180, 820]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } }); const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
    const errs = []; pg.on('pageerror', (e) => errs.push(String(e).slice(0, 200))); pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push(m.text().slice(0, 200)); });
    const nav = async (p) => { await pg.evaluate((p) => { history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')); }, p); await pg.waitForTimeout(600); };
    const text = () => pg.evaluate(() => document.body.innerText);
    const T = (n) => `[${sn}] ${n}`;
    try {
      await pg.goto(base + '/sign-in'); await pg.waitForTimeout(800);
      await pg.getByText(/^studio admin$/i).first().click(); await pg.getByText(/^Enter .* portal$/i).click(); await pg.waitForTimeout(700);
      let t = await text();
      ok(T('dashboard starts with 2 new inquiries and 6 contacts'), /NEW INQUIRIES\s*2/i.test(t) && /CONTACTS\s*6/i.test(t), t.slice(0, 200));
      await nav('/inquiries');
      await pg.getByText('Astrid Lindqvist').first().click(); await pg.waitForTimeout(300);
      await pg.getByText(/Accept & create booking/i).click(); await pg.waitForTimeout(800);
      t = await text();
      ok(T('accept opens the new booking'), /Lindqvist · Astrid/.test(t) && /To be confirmed/.test(t) && (await pg.evaluate(() => location.pathname)) === '/bookings', t.slice(0, 200));
      ok(T('booking carries the collection fee, pending'), /\$5,800/.test(t) && /PENDING/i.test(t));
      await nav('/inquiries'); t = await text();
      ok(T('accepted inquiry has left the list'), !/Astrid Lindqvist/.test(t) && /1 new of 2/i.test(t), t.slice(0, 160));
      await nav('/dashboard'); await nav('/inquiries'); t = await text();
      ok(T('it stays gone after navigating away and back'), !/Astrid Lindqvist/.test(t));
      await nav('/dashboard'); t = await text();
      ok(T('dashboard reflects it: 1 new inquiry, 7 contacts'), /NEW INQUIRIES\s*1/i.test(t) && /CONTACTS\s*7/i.test(t), t.slice(0, 200));
      await nav('/contacts'); ok(T('client added to the contact book'), /Astrid Lindqvist/.test(await text()));
      await nav('/finance'); t = await text();
      const before = (t.match(/INVOICED · FY 25.26\s*\$([\d,]+)/i) || [])[1];
      await nav('/tracker'); t = await text();
      ok(T('new booking is on the shoot tracker'), /Lindqvist · Astrid/.test(t));
      const card = pg.locator('div', { hasText: 'Lindqvist · Astrid' }).filter({ has: pg.getByLabel('Deposit Pending') }).last();
      await card.getByLabel('Deposit Pending').first().click(); await pg.waitForTimeout(300);
      await nav('/finance'); t = await text();
      const after = (t.match(/INVOICED · FY 25.26\s*\$([\d,]+)/i) || [])[1];
      const n = (s) => parseInt(String(s).replace(/,/g, ''), 10);
      ok(T('moving it to Deposit Pending raises the 30% retainer in Finance'), n(after) - n(before) === 1740, `${before} -> ${after}`);
      await nav('/inquiries');
      await pg.getByText('Nile Bashir').first().click(); await pg.waitForTimeout(300);
      await pg.getByText(/^Decline$/i).click(); await pg.waitForTimeout(300);
      await nav('/dashboard'); t = await text();
      ok(T('declining creates no booking and clears the new count'), /NEW INQUIRIES\s*0/i.test(t) && !/Bashir/.test(t));
    } catch (e) { res.push(`FAIL  [${sn}] ABORTED: ${String(e).split('\n').slice(0, 3).join(' | ').slice(0, 400)}`); }
    ok(`[${sn}] no runtime errors`, errs.length === 0, errs.slice(0, 3).join(' || '));
    await ctx.close();
  }
  console.log(res.join('\n')); const bad = res.filter((r) => r.startsWith('FAIL')).length;
  console.log(`\n${res.length - bad} passed, ${bad} failed`); await b.close(); srv.close(); process.exit(bad ? 1 : 0);
})();
