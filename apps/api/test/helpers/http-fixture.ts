import { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import type { INestApplication } from '@nestjs/common';
import { createApp } from '../../src/create-app';
import { readConfig } from '../../src/config';
import { DatabaseService } from '../../src/database/database.service';
import { hashPassword } from '../../src/users/password';

export class HttpFixture {
  readonly db: DatabaseService;
  readonly password = 'Isolated fixture password 8421!';
  app!: INestApplication;
  origin!: string;
  adminId!: string;
  staffId!: string;
  otherId!: string;
  adminCookie!: string;
  staffCookie!: string;
  otherCookie!: string;
  constructor(readonly config = readConfig()) {
    this.db = new DatabaseService(config);
    assert.equal(this.config.NODE_ENV, 'test', 'Fixture must only run inside the isolated test harness.');
    let hash: string;
    before(async () => { hash = await hashPassword(this.password); this.app = await createApp(false, this.config); await this.app.listen(0, '127.0.0.1'); this.origin = await this.app.getUrl(); });
    beforeEach(async () => {
      await this.db.user.deleteMany(); await this.db.loginLimit.deleteMany();
      for (const [key, role] of [['admin', 'ADMIN'], ['staff', 'STAFF'], ['other', 'STAFF']] as const) {
        const user = await this.db.user.create({ data: { email: `${key}@fixture.example.test`, fullName: `Test ${key}`, role, passwordHash: hash } });
        const response = await this.write('/auth/login', { email: user.email, password: this.password }, 'POST', '');
        assert.equal(response.status, 200); const cookie = response.headers.get('set-cookie')!.split(';')[0];
        if (key === 'admin') { this.adminId = user.id; this.adminCookie = cookie; }
        else if (key === 'staff') { this.staffId = user.id; this.staffCookie = cookie; }
        else { this.otherId = user.id; this.otherCookie = cookie; }
      }
    });
    after(async () => { await this.app.close(); await this.db.$disconnect(); });
  }
  get(path: string, cookie = this.adminCookie) {
    return fetch(this.origin + '/api/v1' + path, { headers: { Cookie: cookie } });
  }
  write(path: string, body: unknown, method = 'POST', cookie = this.adminCookie, origin = this.config.FRONTEND_ORIGIN) {
    return fetch(this.origin + '/api/v1' + path, { method, headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }
}
