import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { LeaveMonth } from '@sim-dashboard/shared';
import { HttpFixture } from './helpers/http-fixture';
import { AUDIT_ACTIONS } from '../src/audit/audit.service';
const f = new HttpFixture();
const path = () => `/admin/employees/${f.staffId}/leaves`;
const single = () => ({ fromDate: '2026-10-01', toDate: '2026-10-02', days: '1.5', reason: 'Nghỉ kiểm thử', notes: 'notes-marker-not-for-audit', allocations: [{ month: '2026-10', days: '1.5' }] });

test('P17 records confirmed monthly allocations through a leap-year month boundary, with no inferred workday rule', async () => {
  const input = { ...single(), fromDate: '2028-02-28', toDate: '2028-03-02', days: '2.25', allocations: [{ month: '2028-02', days: '0.75' }, { month: '2028-03', days: '1.5' }] };
  const response = await f.write(path(), input); assert.equal(response.status, 201);
  const feb = await (await f.get(path() + '?month=2028-02')).json() as LeaveMonth;
  const mar = await (await f.get(path() + '?month=2028-03')).json() as LeaveMonth;
  assert.equal(feb.totalDays, '0.75'); assert.equal(mar.totalDays, '1.5'); assert.equal(feb.items[0].daysInMonth, '0.75');
  assert.equal((await (await f.get(path() + '?month=2028-01')).json() as LeaveMonth).totalDays, '0');
  const event = await f.db.auditLog.findFirstOrThrow({ where: { targetId: f.staffId, action: AUDIT_ACTIONS.EMPLOYEE_LEAVE_RECORDED } });
  assert.equal(event.actorId, f.adminId); assert(!JSON.stringify(event).includes(input.notes));
});
test('P17 validates invalid dates, totals, precision, duplicate/outside months and staff-only targets', async () => {
  for (const input of [{ ...single(), fromDate: '2026-10-03' }, { ...single(), toDate: '2026-02-31' }, { ...single(), days: '-1' },
    { ...single(), days: '0' }, { ...single(), allocations: [] }, { ...single(), allocations: [{ month: '2026-10', days: '3' }] },
    { ...single(), allocations: [{ month: '2026-11', days: '1.5' }] }, { ...single(), allocations: [{ month: '2026-10', days: '1' }, { month: '2026-10', days: '0.5' }] },
    { ...single(), allocations: [{ month: '2026-10', days: '0.1' }] }]) assert.equal((await f.write(path(), input)).status, 400);
  assert.equal((await f.write(`/admin/employees/${f.adminId}/leaves`, single())).status, 400);
  for (const query of ['?month=invalid', '?month=2026-10&month=2026-11', '?page=-1']) assert.equal((await f.get(path() + query)).status, 400);
  assert.equal((await f.write(path(), single(), 'POST', f.staffCookie)).status, 403);
  assert.equal((await f.get(path(), f.staffCookie)).status, 403);
  assert.equal((await f.get(path(), '')).status, 401);
});
test('P17 serializes concurrent overlapping records and totals all pages once', async () => {
  const responses = await Promise.all([f.write(path(), single()), f.write(path(), single())]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [201,409]);
  assert.equal((await f.write(path(), { ...single(), fromDate: '2026-10-02', toDate: '2026-10-03' })).status, 409);
  assert.equal((await f.write(path(), { ...single(), fromDate: '2026-10-04', toDate: '2026-10-05' })).status, 201);
  const list = await (await f.get(path() + '?month=2026-10&pageSize=1')).json() as LeaveMonth;
  assert.equal(list.totalDays, '3'); assert.equal(list.total, 2); assert.equal(list.items.length, 1);
});
test('P17 database rejects incomplete allocation totals and leaves are immutable; exact fractions are summed without float', async () => {
  await assert.rejects(f.db.employeeLeaveRecord.create({ data: { employeeId: f.staffId, fromDate: new Date('2026-01-01Z'), toDate: new Date('2026-01-02Z'), days: '1', reason: 'test', createdBy: f.adminId } }));
  const input = { ...single(), days: '0.123456789012345678901234567891', allocations: [{ month: '2026-10', days: '0.123456789012345678901234567891' }] };
  const response = await f.write(path(), input); assert.equal(response.status, 201);
  const list = await (await f.get(path() + '?month=2026-10')).json() as LeaveMonth;
  assert.equal(list.totalDays, input.days);
  const { id } = await response.json() as { id: string };
  await assert.rejects(f.db.employeeLeaveRecord.update({ where: { id }, data: { days: '9' } }));
  await assert.rejects(f.db.employeeLeaveRecord.delete({ where: { id } }));
});
test('P17 failed audit rolls back parent and monthly allocations together', async () => {
  await f.db.$executeRaw`CREATE FUNCTION reject_leave_audit() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'EMPLOYEE_LEAVE_RECORDED' THEN RAISE EXCEPTION 'test audit failure'; END IF; RETURN NEW; END; $$`;
  await f.db.$executeRaw`CREATE TRIGGER reject_leave_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_leave_audit()`;
  try { assert.equal((await f.write(path(), single())).status, 503); }
  finally { await f.db.$executeRaw`DROP TRIGGER reject_leave_audit ON audit_logs`; await f.db.$executeRaw`DROP FUNCTION reject_leave_audit()`; }
  assert.equal(await f.db.employeeLeaveRecord.count({ where: { employeeId: f.staffId } }), 0);
});
