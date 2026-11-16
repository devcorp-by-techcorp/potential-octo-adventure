// Auth: the web build against a real backend (started by run.js). Needs APP_BASE_URL and APP_BACKEND_URL.
const { chromium } = require('playwright');
const base = process.env.APP_BASE_URL, backend = process.env.APP_BACKEND_URL;
if (!base || !backend) { console.error('auth.js needs APP_BASE_URL and APP_BACKEND_URL (run it through e2e/run.js)'); process.exit(2); }
const PASSWORD = 'app-test-password';
const STAFF = 'staff@example.test', CLIENT = 'client@example.test';
const res = []; const ok = (n, c, x = '') => res.push(`${c ? 'PASS' : 'FAIL'}  ${n}${c ? '' : '  ' + x}`);
const SESSION_URL = /\/api\/auth\/(client\/)?session$/;

(async () => {
  const b = await chromium.launch();
  for (const [sn, w, h] of [['phone', 390, 844], ['desktop', 1280, 800]]) {
    const T = (x) => `[${sn}] ${x}`;
    const fresh = async () => {
      const ctx = await b.newContext({ viewport: { width: w, height: h } }); const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
      pg.on('pageerror', (e) => ok(T('no page errors'), false, String(e).slice(0, 200)));
      return { ctx, pg };
    };
    const text = (pg) => pg.evaluate(() => document.body.innerText);
    const path = (pg) => pg.evaluate(() => location.pathname);
    const settle = async (pg, want) => { await pg.waitForFunction((p) => location.pathname === p, want).catch(() => {}); await pg.waitForTimeout(400); return path(pg); };
    const signIn = async (pg, role, email, password = PASSWORD) => {
      await pg.goto(base + '/sign-in');
      if (role === 'staff') await pg.getByText(/^studio$/i).first().click();
      await pg.getByLabel('Email').fill(email); await pg.getByLabel('Password').fill(password);
      await pg.getByText(/^Enter .* portal$/i).click(); await pg.waitForTimeout(700);
    };
    const signOut = async (pg) => {
      if (!(await pg.getByText('Sign out').first().isVisible().catch(() => false))) await pg.getByRole('button', { name: 'More studio surfaces' }).click().catch(() => {});
      await pg.getByText('Sign out').first().click(); await pg.waitForTimeout(700);
    };
    const expireSessions = async () => { const r = await fetch(backend + '/__test/expire-sessions', { method: 'POST' }); if (!r.ok) throw new Error('expire-sessions ' + r.status); };
    try {
      // Staff: sign in, land on the dashboard, survive a reload.
      { const { ctx, pg } = await fresh();
        await signIn(pg, 'staff', STAFF);
        ok(T('staff signs in and lands on /dashboard'), (await settle(pg, '/dashboard')) === '/dashboard', await path(pg));
        await pg.reload(); await pg.waitForTimeout(900);
        ok(T('staff session survives a reload'), (await path(pg)) === '/dashboard' && /NEW INQUIRIES/i.test(await text(pg)), await path(pg));
        await ctx.close(); }

      // Double submit: two rapid clicks create exactly one staff session.
      { const { ctx, pg } = await fresh();
        const count = async () => { const r = await fetch(backend + '/__test/session-count'); if (!r.ok) throw new Error('session-count ' + r.status); return r.json(); };
        const before = await count();
        await pg.goto(base + '/sign-in');
        await pg.getByText(/^studio$/i).first().click();
        await pg.getByLabel('Email').fill(STAFF); await pg.getByLabel('Password').fill(PASSWORD);
        await pg.getByText(/^Enter .* portal$/i).dblclick();
        const landed = await settle(pg, '/dashboard');
        const after = await count();
        ok(T('double-clicking sign-in creates exactly one staff session'), after.staff - before.staff === 1 && after.client === before.client, JSON.stringify({ before, after }));
        ok(T('double-click sign-in lands on /dashboard with no error alert'), landed === '/dashboard' && (await pg.getByRole('alert').count()) === 0, landed);
        await ctx.close(); }

      // Client: sign in, land on home, survive a reload; guarded from the studio.
      { const { ctx, pg } = await fresh();
        await signIn(pg, 'client', CLIENT);
        ok(T('client signs in and lands on /home'), (await settle(pg, '/home')) === '/home', await path(pg));
        await pg.reload(); await pg.waitForTimeout(900);
        ok(T('client session survives a reload'), (await path(pg)) === '/home', await path(pg));
        await pg.goto(base + '/dashboard'); await pg.waitForTimeout(900);
        ok(T('a signed-in client visiting /dashboard is redirected to /home'), (await path(pg)) === '/home', await path(pg));
        await ctx.close(); }

      // Staff guarded from the client portal.
      { const { ctx, pg } = await fresh();
        await signIn(pg, 'staff', STAFF); await settle(pg, '/dashboard');
        await pg.goto(base + '/home'); await pg.waitForTimeout(900);
        ok(T('a signed-in staff user visiting /home is redirected to /dashboard'), (await path(pg)) === '/dashboard', await path(pg));
        await ctx.close(); }

      // Wrong password.
      { const { ctx, pg } = await fresh();
        await signIn(pg, 'client', CLIENT, 'not-the-password');
        ok(T('a wrong password shows the backend message'), (await text(pg)).includes('Email or password is incorrect.'), (await text(pg)).slice(0, 200));
        ok(T('a wrong password stays on /sign-in'), (await path(pg)) === '/sign-in', await path(pg));
        await ctx.close(); }

      // Sign out.
      { const { ctx, pg } = await fresh();
        await signIn(pg, 'staff', STAFF); await settle(pg, '/dashboard');
        await signOut(pg);
        ok(T('sign-out returns to the marketing page'), (await path(pg)) === '/marketing', await path(pg));
        await pg.goto(base + '/dashboard'); await pg.waitForTimeout(900);
        ok(T('/dashboard then redirects to /sign-in'), (await path(pg)) === '/sign-in', await path(pg));
        await ctx.close(); }

      // Sign out then reload: stays signed out, with no expiry message.
      { const { ctx, pg } = await fresh();
        await signIn(pg, 'staff', STAFF); await settle(pg, '/dashboard');
        await signOut(pg);
        await pg.goto(base + '/sign-in'); await pg.waitForTimeout(900);
        const t = await text(pg);
        ok(T('after sign-out and reload the user is still signed out'), (await path(pg)) === '/sign-in', await path(pg));
        ok(T('after sign-out and reload there is no expiry message'), !t.includes('Your session has expired'), t.slice(0, 200));
        await pg.goto(base + '/dashboard'); await pg.waitForTimeout(900);
        ok(T('after sign-out and reload /dashboard redirects to /sign-in'), (await path(pg)) === '/sign-in', await path(pg));
        await ctx.close(); }

      // Portal switch then sign out: neither portal is restored on reload.
      { const { ctx, pg } = await fresh();
        await signIn(pg, 'staff', STAFF); await settle(pg, '/dashboard');
        await signIn(pg, 'client', CLIENT);
        ok(T('switching portals signs the client in'), (await settle(pg, '/home')) === '/home', await path(pg));
        await signOut(pg);
        await pg.goto(base + '/sign-in'); await pg.waitForTimeout(900);
        const t = await text(pg);
        ok(T('after a portal switch and sign-out the reload is signed out'), (await path(pg)) === '/sign-in' && !t.includes('Your session has expired'), await path(pg));
        await pg.goto(base + '/dashboard'); await pg.waitForTimeout(900);
        ok(T('the staff portal is not restored after sign-out'), (await path(pg)) === '/sign-in', await path(pg));
        await pg.goto(base + '/home'); await pg.waitForTimeout(900);
        ok(T('the client portal is not restored after sign-out'), (await path(pg)) === '/sign-in', await path(pg));
        await ctx.close(); }

      // Expired staff session preselects the Studio role.
      { const { ctx, pg } = await fresh();
        await pg.goto(base + '/dashboard'); await pg.waitForTimeout(900);
        ok(T('a signed-out visit to /dashboard preselects the Studio role'), (await path(pg)) === '/sign-in' && (await pg.getByText(/^Enter studio portal$/i).count()) === 1, await path(pg));
        await ctx.close(); }

      // Expired session, staff and client.
      for (const [role, email, home] of [['staff', STAFF, '/dashboard'], ['client', CLIENT, '/home']]) {
        const { ctx, pg } = await fresh();
        await signIn(pg, role, email); await settle(pg, home);
        await expireSessions();
        await pg.reload(); await pg.waitForTimeout(900);
        const t = await text(pg);
        ok(T(`an expired ${role} session lands on /sign-in`), (await path(pg)) === '/sign-in', await path(pg));
        ok(T(`an expired ${role} session says so`), t.includes('Your session has expired. Please sign in again.'), t.slice(0, 200));
        await ctx.close(); }

      // Restore never renders seeded studio data.
      { const { ctx, pg } = await fresh();
        await signIn(pg, 'staff', STAFF); await settle(pg, '/dashboard');
        let release; const gate = new Promise((r) => { release = r; });
        await pg.route(SESSION_URL, async (route) => { await gate; await route.continue(); });
        await pg.reload(); await pg.waitForTimeout(1200);
        const during = await text(pg);
        ok(T('restore renders no studio data before the session resolves'), !/NEW INQUIRIES|CONTACTS|ACTIVE BOOKINGS/i.test(during), during.slice(0, 200));
        release(); await pg.waitForTimeout(900);
        ok(T('restore completes into the dashboard'), (await path(pg)) === '/dashboard' && /NEW INQUIRIES/i.test(await text(pg)), await path(pg));
        await ctx.close(); }

      // Backend down during restore, then Retry.
      { const { ctx, pg } = await fresh();
        await signIn(pg, 'staff', STAFF); await settle(pg, '/dashboard');
        await pg.route(SESSION_URL, (route) => route.abort());
        await pg.reload(); await pg.waitForTimeout(1200);
        const t = await text(pg);
        ok(T('an unreachable backend shows the unavailable panel'), t.includes('The studio is temporarily unavailable. Please try again.') && !/NEW INQUIRIES/i.test(t), t.slice(0, 200));
        await pg.unroute(SESSION_URL);
        await pg.getByRole('button', { name: 'Try again' }).click(); await pg.waitForTimeout(900);
        ok(T('Try again restores the session'), (await path(pg)) === '/dashboard' && /NEW INQUIRIES/i.test(await text(pg)), await path(pg));
        await ctx.close(); }
    } catch (e) { ok(T('suite ran to completion'), false, String(e).slice(0, 300)); }
  }
  await b.close();
  console.log(res.join('\n')); const bad = res.filter((l) => l.startsWith('FAIL')).length;
  console.log(`\n${res.length - bad} passed, ${bad} failed`); process.exit(bad ? 1 : 0);
})();
