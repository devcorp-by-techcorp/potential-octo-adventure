// Finance engine checks: cash flow must agree with the double-entry ledger.
// Transpiles the TypeScript engine on the fly; needs only `typescript`.
const ts = require('typescript'), fs = require('fs'), path = require('path'), os = require('os');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'fin-'));
for (const f of ['seed', 'finance']) {
  const src = fs.readFileSync(path.join(__dirname, '../src/data', f + '.ts'), 'utf8');
  fs.writeFileSync(path.join(out, f + '.js'), ts.transpileModule(src, { compilerOptions: { module: 'commonjs', target: 'es2020' } }).outputText);
}
const seed = require(path.join(out, 'seed.js')), fin = require(path.join(out, 'finance.js'));
const res = []; const ok = (n, c, x = '') => res.push(`${c ? 'PASS' : 'FAIL'}  ${n}${c ? '' : '  ' + x}`);
const r2 = fin.finR2, S = fin.FIN_SETTINGS_DEFAULT;
const invoices = fin.finInvoices(seed.BOOKINGS, S), expenses = fin.finSeedExpenses();
const ledger = fin.finLedger(invoices, expenses, S);
const bank = (to) => r2(ledger.filter((e) => e.date <= to).reduce((s, e) => s + e.lines.filter((l) => l.account === '1-100').reduce((a, l) => a + l.dr - l.cr, 0), 0));

for (const p of fin.FIN_PERIODS.all) {
  const cf = fin.finCashflow(p, invoices, expenses, S);
  const want = r2(S.openingBalance + bank(p.end));
  ok(`closing bank balance matches ledger · ${p.label}`, Math.abs(cf.closing - want) < 0.005, `cashflow ${cf.closing} vs ledger ${want}`);
}
ok('cash today matches ledger', Math.abs(fin.finCashToday(invoices, expenses, S) - r2(S.openingBalance + bank(fin.FIN_TODAY))) < 0.005);
const wage = { id: 'w', date: '2026-01-28', supplier: 'Payroll', desc: 'Wage', category: 'wages', gross: 2400, withheld: 312 };
ok('a $2,400 wage with $312 withheld pays $2,088 from the bank', fin.finCashPaid(wage) === 2088, String(fin.finCashPaid(wage)));
ok('non-wage expenses are paid in full', fin.finCashPaid({ ...wage, category: fin.FIN_EXPENSE_CATEGORIES.find((c) => !c.wages).key }) === 2400);
const fy = fin.finCashflow(fin.FIN_PERIODS.fy, invoices, expenses, S);
const liab = r2(ledger.filter((e) => e.date >= fin.FIN_PERIODS.fy.start && e.date <= fin.FIN_PERIODS.fy.end).reduce((s, e) => s + e.lines.filter((l) => l.account === '2-120').reduce((a, l) => a + l.cr - l.dr, 0), 0));
ok('withholding reported separately equals the PAYG liability', Math.abs(fy.withheld - liab) < 0.005 && fy.withheld > 0, `${fy.withheld} vs ${liab}`);
ok('every journal entry balances', ledger.every((e) => Math.abs(e.lines.reduce((s, l) => s + l.dr - l.cr, 0)) < 0.005));

console.log(res.join('\n')); const bad = res.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${res.length - bad} passed, ${bad} failed`); fs.rmSync(out, { recursive: true, force: true }); process.exit(bad ? 1 : 0);
