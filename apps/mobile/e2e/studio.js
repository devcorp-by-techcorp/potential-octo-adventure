// Studio: public enquiry → guarded studio transitions → confirmed booking everywhere; the three-tab directory.
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
    const T = (x) => `[${sn}] ${x}`;
    const n = (v) => parseInt(String(v).replace(/,/g, ''), 10);
    try {
      // ── Public: Begin an enquiry ──
      await pg.goto(base + '/marketing'); await pg.waitForTimeout(900);
      await pg.getByRole('button', { name: 'Begin an enquiry' }).first().click(); await pg.waitForTimeout(400);
      let t = await text();
      ok(T('enquiry sheet opens on the date step, no prices'), /Step 1 of 3/i.test(t) && /no date is reserved, held or confirmed/.test(t) && !/\$\s?\d|AUD/.test(t.slice(t.indexOf('STEP 1'))));
      await pg.getByRole('button', { name: 'Continue' }).click();
      ok(T('cannot continue without a date'), /Choose a preferred date/.test(await text()));
      await pg.getByRole('button', { name: /14 June 2026/ }).click();
      ok(T('a date with a confirmed booking is refused'), /14 June 2026 is unavailable/.test(await text()));
      await pg.getByRole('button', { name: /20 June 2026/ }).click();
      await pg.getByRole('button', { name: 'Editorial' }).click();
      await pg.getByRole('button', { name: 'Continue' }).click(); await pg.waitForTimeout(300);
      await pg.getByRole('button', { name: 'Send tentative request' }).click();
      ok(T('details need a name'), /A name is required/.test(await text()));
      await pg.getByLabel('Full name · required').fill('Quinn Tester');
      await pg.getByLabel('Email · required').fill('not-an-email');
      await pg.getByRole('button', { name: 'Send tentative request' }).click();
      ok(T('details need a valid email'), /A valid email is required/.test(await text()));
      await pg.getByLabel('Email · required').fill('quinn.tester@example.com');
      await pg.getByLabel('Phone').fill('+61 400 111 222');
      await pg.getByLabel('Venue or location').fill('Abbotsford Convent');
      await pg.getByRole('button', { name: 'Send tentative request' }).click(); await pg.waitForTimeout(400);
      t = await text();
      const ref = (t.match(/ENQ-\d{4}/) || [])[0];
      ok(T('submission gives a reference and promises nothing'), !!ref && /Nothing is reserved, held or confirmed until the studio confirms/.test(t), t.slice(-300));
      await pg.getByRole('button', { name: 'Close', exact: true }).last().click(); await pg.waitForTimeout(300);

      // ── Studio: guarded transitions ──
      await nav('/sign-in'); await pg.getByText(/^studio admin$/i).first().click(); await pg.getByText(/^Enter .* portal$/i).click(); await pg.waitForTimeout(700);
      t = await text();
      ok(T('dashboard counts the new tentative request (3) and 6 contacts'), /NEW INQUIRIES\s*3/i.test(t) && /CONTACTS\s*6/i.test(t), t.slice(0, 200));
      await nav('/finance'); const fin0 = n((((await text()).match(/INVOICED · FY 25.26\s*\$([\d,]+)/i)) || [])[1]);
      await nav('/inquiries');
      await pg.getByRole('button', { name: /Quinn Tester, Tentative request/ }).click(); await pg.waitForTimeout(300);
      t = await text();
      ok(T('enquiry carries its reference, venue and source'), t.includes(ref) && /Abbotsford Convent/.test(t) && /Studio site · Begin an enquiry/i.test(t));
      ok(T('only allowed transitions are offered'), /TAKE INTO REVIEW/i.test(t) && /FLAG FOR A HUMAN/i.test(t) && /CLOSE REQUEST/i.test(t) && !/CONFIRM BOOKING/i.test(t));
      await pg.getByRole('button', { name: /Take into review/i }).click(); await pg.waitForTimeout(300);
      await pg.getByRole('button', { name: /Confirm booking/i }).click(); await pg.waitForTimeout(300);
      t = await text();
      ok(T('confirm is blocked without a linked client'), /A linked client is required — add Quinn Tester to Contacts first/.test(t) && /AWAITING STUDIO/i.test(t));
      await pg.getByRole('button', { name: /Add to Contacts/i }).click(); await pg.waitForTimeout(300);
      await pg.getByRole('button', { name: /Confirm booking/i }).click(); await pg.waitForTimeout(400);
      t = await text();
      ok(T('confirm creates the booking and records the audit trail'), /Booking confirmed and added to Bookings/.test(t) && /Tentative request → Awaiting studio/.test(t) && /Awaiting studio → Confirmed/.test(t) && /Your booking is confirmed/.test(t), t.slice(-400));
      ok(T('a confirmed enquiry offers no further transitions'), !/CLOSE REQUEST|FLAG FOR A HUMAN/i.test(t));
      await nav('/bookings'); t = await text();
      ok(T('booking is on the schedule, surname-first, confirmed'), /Tester · Quinn/.test(t) && /Abbotsford Convent/.test(t));
      await nav('/dashboard'); t = await text();
      ok(T('dashboard: 2 awaiting review, 7 contacts, 6 active bookings'), /NEW INQUIRIES\s*2/i.test(t) && /CONTACTS\s*7/i.test(t) && /ACTIVE BOOKINGS\s*6/i.test(t), t.slice(0, 200));
      await nav('/finance'); const fin1 = n((((await text()).match(/INVOICED · FY 25.26\s*\$([\d,]+)/i)) || [])[1]);
      ok(T('the confirmed booking raises its 30% retainer in Finance'), fin1 - fin0 === 1740, `${fin0} -> ${fin1}`);
      await nav('/tracker'); ok(T('booking is on the shoot tracker'), /Tester · Quinn/.test(await text()));
      await nav('/inquiries'); await nav('/dashboard'); await nav('/inquiries');
      ok(T('enquiry state survives navigation'), (await pg.getByRole('button', { name: /Quinn Tester, Confirmed/ }).count()) === 1);
      await pg.getByRole('button', { name: /Nile Bashir, Tentative request/ }).click(); await pg.waitForTimeout(300);
      await pg.getByRole('button', { name: /Close request/i }).click(); await pg.waitForTimeout(300);
      await nav('/dashboard'); t = await text();
      ok(T('closing a request creates no booking'), /NEW INQUIRIES\s*1/i.test(t) && !/Bashir/.test(t));

      // ── Directory: three tabs ──
      await nav('/contacts'); t = await text();
      ok(T('directory opens on the Contacts tab with both groups'), /CLIENTS AND ENQUIRIES/i.test(t) && /PARTNERS AND SUPPLIERS/i.test(t));
      const search = pg.getByLabel('Search clients, enquiries, partners and suppliers');
      await search.fill('astrd lindq'); await pg.waitForTimeout(300); t = await text();
      ok(T('fuzzy search finds an enquiry-only client by a misspelt name'), /Astrid Lindqvist/.test(t) && !/Whitfield/.test(t));
      await search.fill('0412558'); await pg.waitForTimeout(300);
      ok(T('search matches a phone number ignoring spaces'), /Eleanor & James Whitfield/.test(await text()));
      await search.fill('61452907'); await pg.waitForTimeout(300);
      ok(T('search matches a partner by ABN digits'), /Hunter & Vale Print Atelier/.test(await text()));
      await search.fill('');
      await pg.getByRole('button', { name: 'Add contact' }).click();
      await pg.getByRole('button', { name: 'Add to contact book' }).click();
      ok(T('add contact needs a name'), /A name is required/.test(await text()));
      await pg.getByLabel('Contact full name').fill('Dana Okafor'); await pg.getByLabel('Contact email').fill('quinn.tester@example.com');
      await pg.getByRole('button', { name: 'Add to contact book' }).click();
      ok(T('add contact refuses a duplicate email'), /already in the contact book/.test(await text()));
      await pg.getByLabel('Contact email').fill('dana.okafor@example.com');
      await pg.getByRole('button', { name: 'Add to contact book' }).click(); await pg.waitForTimeout(300);
      ok(T('contact added'), /Dana Okafor added to the contact book/.test(await text()));
      await pg.getByRole('tab', { name: /^Clients,/ }).click(); await pg.waitForTimeout(300);
      await pg.getByRole('button', { name: 'Potential', exact: true }).click(); await pg.waitForTimeout(300); t = await text();
      ok(T('Clients tab filters by stage (Potential)'), /Dana Okafor/.test(t) && /Astrid Lindqvist/.test(t) && !/Eleanor & James Whitfield/.test(t));
      await pg.getByRole('button', { name: 'Past', exact: true }).click(); await pg.waitForTimeout(300); t = await text();
      ok(T('Clients tab includes past clients from settled invoices'), /Nguyen Family|Patel/.test(t) && !/Dana Okafor/.test(t));
      await pg.getByRole('button', { name: 'Everyone' }).click();
      await pg.getByRole('button', { name: 'W', exact: true }).click(); await pg.waitForTimeout(300); t = await text();
      ok(T('letter index is by surname'), /Eleanor & James Whitfield/.test(t) && !/Dana Okafor/.test(t));
      await pg.getByRole('button', { name: 'ALL', exact: true }).click();
      await pg.getByLabel('Type a first name, last name, phone or email').fill('dana.ok'); await pg.waitForTimeout(300);
      ok(T('client autocomplete shows which field matched'), /Email · dana\.okafor@example\.com/.test(await text()));
      await pg.getByRole('tab', { name: /^Partners,/ }).click(); await pg.waitForTimeout(300);
      await pg.getByLabel('Type a business name, ABN, ACN, phone or email').fill('61 452'); await pg.waitForTimeout(300);
      ok(T('partner autocomplete matches on ABN'), /ABN · 61 452 907 118/.test(await text()));
      await pg.getByLabel('Type a business name, ABN, ACN, phone or email').fill('');
      t = await text(); ok(T('Partners tab has a type-of-business filter'), /TYPE OF BUSINESS/i.test(t) && /All types/.test(t) && /Print & framing/.test(t));
      ok(T('directory no overflow'), (await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0);
      // Finance → Suppliers "Add partner" hands over to the directory
      await nav('/finance'); await pg.getByText(/^Suppliers$/i).first().click(); await pg.waitForTimeout(300);
      await pg.getByRole('button', { name: 'Add partner' }).click(); await pg.waitForTimeout(600);
      t = await text();
      ok(T('Finance "Add partner" opens the directory with the partner form'), (await pg.evaluate(() => location.pathname)) === '/contacts' && /New partner or supplier/.test(t));
      await pg.getByLabel('Business name').fill('Lumen Rentals'); await pg.getByLabel('ABN').fill('1234');
      await pg.getByRole('button', { name: 'Equipment hire' }).click(); await pg.getByRole('button', { name: 'Enquiry only' }).click();
      await pg.getByRole('button', { name: 'Add to register' }).click();
      ok(T('partner ABN length is validated'), /An ABN is 11 digits — 4 entered/.test(await text()));
      await pg.getByLabel('ABN').fill('51 824 753 556'); await pg.getByLabel('Partner phone').fill('03 9000 1234');
      await pg.getByRole('button', { name: 'Add to register' }).click(); await pg.waitForTimeout(300);
      await pg.getByRole('tab', { name: /^Partners,/ }).click(); await pg.waitForTimeout(300);
      await pg.getByRole('button', { name: 'Equipment hire' }).click(); await pg.waitForTimeout(300); t = await text();
      ok(T('new partner is indexed, filtered by type, shown as Potential'), /Lumen Rentals/.test(t) && !/Hunter & Vale/.test(t) && (await pg.getByRole('button', { name: 'Lumen Rentals, Potential' }).count()) === 1);
      await pg.getByRole('button', { name: 'Lumen Rentals, Potential' }).click(); await pg.waitForTimeout(600); t = await text();
      ok(T('a partner row opens its record in Finance → Suppliers'), (await pg.evaluate(() => location.pathname)) === '/finance' && /Lumen Rentals/.test(t) && !/Hunter & Vale/.test(t));

      // ── A confirmed date becomes unavailable to the public ──
      await nav('/marketing'); await pg.getByRole('button', { name: 'Begin an enquiry' }).first().click(); await pg.waitForTimeout(400);
      await pg.getByRole('button', { name: /20 June 2026/ }).click();
      ok(T('the date just confirmed is now refused on the public calendar'), /20 June 2026 is unavailable/.test(await text()));
    } catch (e) { res.push(`FAIL  [${sn}] ABORTED: ${String(e).split('\n').slice(0, 3).join(' | ').slice(0, 400)}`); }
    ok(`[${sn}] no runtime errors`, errs.length === 0, errs.slice(0, 3).join(' || '));
    await ctx.close();
  }
  console.log(res.join('\n')); const bad = res.filter((r) => r.startsWith('FAIL')).length;
  console.log(`\n${res.length - bad} passed, ${bad} failed`); await b.close(); srv.close(); process.exit(bad ? 1 : 0);
})();
