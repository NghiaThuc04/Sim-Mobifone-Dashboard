import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { CommissionPolicyList, EmployeeList, isCommissionAbove100 } from '@sim-dashboard/shared';
import { createApp } from '../src/create-app';
import { readConfig } from '../src/config';
import { DatabaseService } from '../src/database/database.service';
import { hashPassword } from '../src/users/password';
import { CommissionsRepository } from '../src/commissions/commissions.repository';
import { AUDIT_ACTIONS } from '../src/audit/audit.service';

const config = readConfig();
const db = new DatabaseService(config);
const password = 'Commission test password 4321!';
let app: INestApplication;
let origin: string;
let hash: string;
let adminCookie: string;
let staffCookie: string;
let adminId: string;
let staffId: string;
before(async () => { hash = await hashPassword(password); app = await createApp(false); await app.listen(0, '127.0.0.1'); origin = await app.getUrl(); });
beforeEach(async () => {
  await db.user.deleteMany(); await db.loginLimit.deleteMany();
  adminId = (await db.user.create({ data: { email: 'commission-admin@example.test', fullName: 'Admin test', role: 'ADMIN', passwordHash: hash } })).id;
  staffId = (await db.user.create({ data: { email: 'commission-staff@example.test', fullName: 'Staff test', role: 'STAFF', passwordHash: hash } })).id;
  async function login(email: string) {
    const response = await fetch(origin + '/api/v1/auth/login', { method: 'POST', headers: { Origin: config.FRONTEND_ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    assert.equal(response.status, 200); return response.headers.get('set-cookie')!.split(';')[0];
  }
  adminCookie = await login('commission-admin@example.test'); staffCookie = await login('commission-staff@example.test');
});
after(async () => { await app.close(); await db.$disconnect(); });
function put(body: unknown, cookie = adminCookie, id = staffId) {
  return fetch(origin + `/api/v1/admin/employees/${id}/commission-policy`, { method: 'PUT', headers: { Cookie: cookie, Origin: config.FRONTEND_ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
function get(query = '', cookie = adminCookie) { return fetch(origin + `/api/v1/admin/employees/${staffId}/commission-policy${query}`, { headers: { Cookie: cookie } }); }

test('P15 unconfigured is null; ADMIN stores exact decimal and list shows the effective percentage', async () => {
  const initial = await (await get()).json() as CommissionPolicyList;
  assert.equal(initial.current, null); assert.equal(initial.total, 0);
  const ratePercent = '12.123456789012345678901234567891';
  const response = await put({ ratePercent }); assert.equal(response.status, 200);
  const result = await response.json() as { ratePercent: string; id: string; above100Warning: boolean; effectiveAt: string; createdAt: string };
  assert.equal(result.ratePercent, ratePercent); assert.equal(result.above100Warning, false);
  assert(Math.abs(Date.parse(result.effectiveAt) - Date.now()) < 3000);
  assert(Math.abs(Date.parse(result.effectiveAt) - Date.parse(result.createdAt)) < 1000);
  assert.equal((await db.commissionPolicy.findUniqueOrThrow({ where: { id: result.id } })).ratePercent.toString(), ratePercent);
  const listResponse = await fetch(origin + '/api/v1/admin/employees', { headers: { Cookie: adminCookie } });
  const employees = await listResponse.json() as EmployeeList;
  assert.equal(employees.items.find((employee) => employee.id === staffId)?.commissionRatePercent, ratePercent);
  const event = await db.auditLog.findFirstOrThrow({ where: { targetId: staffId, action: AUDIT_ACTIONS.EMPLOYEE_COMMISSION_CHANGED } });
  assert.equal(event.actorId, adminId); assert.equal((event.metadata as { ratePercent: string }).ratePercent, ratePercent);
});

test('P15 lookup uses latest effective instant with millisecond boundaries and preserves prior records', async () => {
  const repository = app.get(CommissionsRepository);
  const firstAt = '2026-01-01T00:00:00.001Z'; const secondAt = '2026-01-01T00:00:00.002Z';
  assert.equal((await put({ ratePercent: '10', effectiveAt: firstAt })).status, 200);
  const first = await repository.lookupAt(staffId, new Date(firstAt)); assert(first);
  assert.equal(await repository.lookupAt(staffId, new Date('2026-01-01T00:00:00.000Z')), null);
  assert.equal((await put({ ratePercent: '20.5', effectiveAt: secondAt })).status, 200);
  assert.equal((await repository.lookupAt(staffId, new Date(firstAt)))?.ratePercent, '10');
  assert.equal((await repository.lookupAt(staffId, new Date(secondAt)))?.ratePercent, '20.5');
  assert.equal((await put({ ratePercent: '30', effectiveAt: '2035-01-01T07:00:00+07:00' })).status, 200);
  assert.equal((await repository.lookupAt(staffId, new Date('2035-01-01T00:00:00.000Z')))?.ratePercent, '30');
  assert.deepEqual(await repository.lookupAt(staffId, new Date(firstAt)), first);
  const history = await (await get('?page=1&pageSize=2')).json() as CommissionPolicyList;
  assert.equal(history.current?.ratePercent, '20.5'); assert.equal(history.total, 3); assert.equal(history.totalPages, 2);
  assert.equal(history.items[0].ratePercent, '30'); assert.equal(history.items[0].previousRatePercent, '20.5');
  assert.equal((await (await get('?page=2&pageSize=2')).json() as CommissionPolicyList).items[0].ratePercent, '10');
});

test('P15 above 100 is accepted with a warning; no arbitrary business cap or float rounding', async () => {
  for (const rate of ['100.000000000000000000000000000001', '125.75', '1000']) {
    const response = await put({ ratePercent: rate, effectiveAt: new Date(Date.now() + Number(rate.split('.')[0]) * 1000).toISOString() });
    assert.equal(response.status, 200); assert.equal((await response.json() as { above100Warning: boolean }).above100Warning, true);
    assert.equal(isCommissionAbove100(rate), true);
  }
  for (const rate of ['0', '99.999999999999999999999999999999', '100', '100.000']) assert.equal(isCommissionAbove100(rate), false);
});

test('P15 STAFF/anonymous cannot configure or read policies; malformed input and unsupported targets are rejected', async () => {
  assert.equal((await put({ ratePercent: '10' }, staffCookie)).status, 403);
  assert.equal((await put({ ratePercent: '10' }, '')).status, 401);
  assert.equal((await get('', staffCookie)).status, 403);
  for (const body of [{ ratePercent: '-1' }, { ratePercent: 10.5 }, { ratePercent: 'NaN' }, { ratePercent: 'Infinity' }, { ratePercent: '1e2' },
    { ratePercent: '1.' + '1'.repeat(31) }, { ratePercent: '1'.repeat(36) }, { ratePercent: '10', effectiveAt: 'not-a-date' },
    { ratePercent: '10', effectiveAt: '2026-01-01T00:00:00.0001Z' }, { ratePercent: '10', approvedProfit: '100' }]) assert.equal((await put(body)).status, 400);
  assert.equal((await put({ ratePercent: '10' }, adminCookie, randomUUID())).status, 404);
  assert.equal((await put({ ratePercent: '10' }, adminCookie, adminId)).status, 400);
  for (const query of ['?page=0', '?pageSize=101', '?page=1&page=2', '?at=invalid']) assert.equal((await get(query)).status, 400);
});

test('P15 same-instant concurrent writes have one winner and policies reject mutation while preserving identity', async () => {
  const at = '2026-06-01T00:00:00.001Z';
  const responses = await Promise.all([put({ ratePercent: '10', effectiveAt: at }), put({ ratePercent: '20', effectiveAt: at })]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
  const policy = await db.commissionPolicy.findFirstOrThrow({ where: { employeeId: staffId } });
  await assert.rejects(db.commissionPolicy.update({ where: { id: policy.id }, data: { ratePercent: '999' } }));
  await assert.rejects(db.commissionPolicy.delete({ where: { id: policy.id } }));
  await assert.rejects(db.$executeRaw`TRUNCATE commission_policies`);
  await assert.rejects(db.commissionPolicy.create({ data: { employeeId: randomUUID(), ratePercent: '10', effectiveAt: new Date(), createdBy: adminId } }));
  await db.user.delete({ where: { id: staffId } });
  assert.equal((await db.commissionPolicy.findUniqueOrThrow({ where: { id: policy.id } })).employeeId, staffId);
});

test('P15 audit failure rolls back policy insertion without modifying existing history', async () => {
  assert.equal((await put({ ratePercent: '10', effectiveAt: '2026-01-01T00:00:00.000Z' })).status, 200);
  await db.$executeRaw`CREATE FUNCTION reject_commission_audit() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'EMPLOYEE_COMMISSION_CHANGED' THEN RAISE EXCEPTION 'test audit failure'; END IF; RETURN NEW; END; $$`;
  await db.$executeRaw`CREATE TRIGGER reject_commission_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_commission_audit()`;
  try { assert.equal((await put({ ratePercent: '20', effectiveAt: '2026-02-01T00:00:00.000Z' })).status, 503); }
  finally { await db.$executeRaw`DROP TRIGGER reject_commission_audit ON audit_logs`; await db.$executeRaw`DROP FUNCTION reject_commission_audit()`; }
  assert.equal(await db.commissionPolicy.count({ where: { employeeId: staffId } }), 1);
  assert.equal((await (await get()).json() as CommissionPolicyList).current?.ratePercent, '10');
});
