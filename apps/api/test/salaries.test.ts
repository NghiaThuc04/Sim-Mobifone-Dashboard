import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { SalaryHistory } from '@sim-dashboard/shared';
import { HttpFixture } from './helpers/http-fixture';
import { SalariesRepository } from '../src/salaries/salaries.repository';
import { AUDIT_ACTIONS } from '../src/audit/audit.service';

const f = new HttpFixture();
const path = () => `/admin/employees/${f.staffId}/salary`;
test('P16 ADMIN records exact salary, current and audit; STAFF cannot read or write salaries', async () => {
  assert.equal((await (await f.get(path())).json() as SalaryHistory).current, null);
  const amount = '12345678.123456789012345678901234567891';
  const result = await f.write(path(), { amount }, 'PUT'); assert.equal(result.status, 200);
  assert.equal((await result.json() as { amount: string }).amount, amount);
  assert.equal((await (await f.get(path())).json() as SalaryHistory).current?.amount, amount);
  const event = await f.db.auditLog.findFirstOrThrow({ where: { targetId: f.staffId, action: AUDIT_ACTIONS.EMPLOYEE_SALARY_CHANGED } });
  assert.equal(event.actorId, f.adminId);
  for (const cookie of [f.staffCookie, f.otherCookie]) {
    assert.equal((await f.get(path(), cookie)).status, 403);
    assert.equal((await f.write(path(), { amount: '1' }, 'PUT', cookie)).status, 403);
  }
  assert.equal((await f.get(path(), '')).status, 401);
});
test('P16 month boundaries and time lookup preserve earlier salary; no prorate or payroll is computed', async () => {
  for (const [effectiveFrom, amount] of [['2026-01-15T00:00:00+07:00', '5000000'], ['2026-02-01T00:00:00+07:00', '6000000'], ['2026-02-15T00:00:00+07:00', '6500000'], ['2035-01-01T00:00:00Z', '9000000']]) {
    assert.equal((await f.write(path(), { amount, effectiveFrom }, 'PUT')).status, 200);
  }
  const lookup = f.app.get(SalariesRepository);
  assert.equal((await lookup.lookupAt(f.staffId, new Date('2026-01-31T16:59:59.999Z')))?.amount, '5000000');
  assert.equal((await lookup.lookupAt(f.staffId, new Date('2026-01-31T17:00:00.000Z')))?.amount, '6000000');
  const feb = await (await f.get(path() + '?month=2026-02&pageSize=1')).json() as SalaryHistory;
  assert.equal(feb.opening?.amount, '5000000'); assert.equal(feb.total, 2); assert.equal(feb.totalPages, 2);
  assert.equal(feb.current?.amount, '6500000');
  assert.equal((await (await f.get(path() + '?month=2026-03')).json() as SalaryHistory).total, 0);
  assert.equal((await f.get(`/admin/employees/${f.staffId}/payroll`)).status, 404);
});
test('P16 rejects negative/invalid amount, bad month, unknown target, Origin; concurrent identical time has one winner', async () => {
  for (const input of [{ amount: '-1' }, { amount: 100 }, { amount: 'NaN' }, { amount: '1.' + '1'.repeat(31) }, { amount: '1', bonus: '10' }]) assert.equal((await f.write(path(), input, 'PUT')).status, 400);
  for (const query of ['?month=2026-13', '?month=2026-01&month=2026-02', '?page=0']) assert.equal((await f.get(path() + query)).status, 400);
  assert.equal((await f.write(`/admin/employees/${randomUUID()}/salary`, { amount: '1' }, 'PUT')).status, 404);
  assert.equal((await f.write(path(), { amount: '1' }, 'PUT', f.adminCookie, '')).status, 403);
  const body = { amount: '0', effectiveFrom: '2026-03-01T00:00:00Z' };
  assert.deepEqual((await Promise.all([f.write(path(), body, 'PUT'), f.write(path(), body, 'PUT')])).map((r) => r.status).sort(), [200,409]);
  const salary = await f.db.employeeSalary.findFirstOrThrow({ where: { employeeId: f.staffId } });
  await assert.rejects(f.db.employeeSalary.update({ where: { id: salary.id }, data: { amount: '9' } }));
  await assert.rejects(f.db.employeeSalary.delete({ where: { id: salary.id } }));
});
test('P16 audit failure rolls salary back and leaves history intact', async () => {
  await f.db.$executeRaw`CREATE FUNCTION reject_salary_audit() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'EMPLOYEE_SALARY_CHANGED' THEN RAISE EXCEPTION 'test audit failure'; END IF; RETURN NEW; END; $$`;
  await f.db.$executeRaw`CREATE TRIGGER reject_salary_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_salary_audit()`;
  try { assert.equal((await f.write(path(), { amount: '123' }, 'PUT')).status, 503); }
  finally { await f.db.$executeRaw`DROP TRIGGER reject_salary_audit ON audit_logs`; await f.db.$executeRaw`DROP FUNCTION reject_salary_audit()`; }
  assert.equal(await f.db.employeeSalary.count({ where: { employeeId: f.staffId } }), 0);
});
