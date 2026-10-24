# Batch 02 — P02 đến P05

Ngày kiểm chứng: **24/10/2026, Asia/Saigon**. Workspace duy nhất được sửa: `C:/Users/nghia/OneDrive/Desktop/SimMobile/Dashboard-Sim-Mobi`.

Nguồn nghiệp vụ: Master Spec v1.6, hash giữ nguyên baseline P00. Thực hiện tuần tự, không có agent phụ hoặc chạy song song các prompt. Chưa bắt đầu P06.

| Prompt | Trạng thái | Bằng chứng trước bước tiếp |
|---|---|---|
| P02 | DONE | `npm run verify` exit 0; build/typecheck/lint đạt, 5/5 test. PostgreSQL 18.4 thật, cluster test riêng; health DB 200, mất DB 503 an toàn |
| P03 | DONE | Migration deploy thành công; verify exit 0, 9/9 test |
| P04 | DONE, gồm Admin local do chủ dự án khởi tạo | Verify exit 0; 14/14 test; kiểm tra DB xác nhận admin@khosimso.com có role ADMIN, status active |
| P05 | DONE phần API theo prompt | Verify cuối exit 0, 27/27 test; runtime health/DB health 200 |

## P02

Thêm `.env.example`, `compose.yaml`, `apps/api/prisma.config.ts`, schema Prisma chưa có model, config validation, database service/DB health, script local/test PostgreSQL và test env/DB. Sửa scripts package/lockfile, AppModule/create-app/main, lint ignore generated, README, tasks.

Chọn Prisma/client/adapter 7.10.1 đã kiểm tra engines Node 24; không dùng dist-tag Prisma 8 RC. Các giá trị DATABASE_URL/SESSION_SECRET không nằm trong source; `.env` local sinh ngẫu nhiên, không ghi đè file có sẵn. Không dùng cluster/data Home. Chỉ tái sử dụng PostgreSQL executable đã có trên máy bằng PG_BIN, được ghi private trong .env; mã nguồn không phụ thuộc đường dẫn Home.

Lỗi đã sửa: Windows pg_ctl khởi động PostgreSQL nhưng giữ pipe của execFile làm script chờ. Đổi sang spawn với stdio ignore, lấy mã thoát và giữ log trong cluster private. Đã chạy lại test/cleanup thành công. Docker không có trong PATH: Compose chưa chạy, native PostgreSQL đã kiểm chứng.

## P03

Thêm Prisma User/UserRole/UserStatus và migration users, validation email/full name/password, scrypt async có salt ngẫu nhiên, test hash/constraint. Schema DB enforce normalized email + unique, định dạng email, full_name không rỗng, password_hash scrypt có cấu trúc hợp lệ, enum role ADMIN/STAFF và status active/locked. Không tạo API nhân viên hoặc phân quyền chi tiết.

`npm run db:migrate` áp users lên cluster Dashboard riêng; `npm run verify` exit 0, 9/9 test trên cluster test mới. Kiểm tra startup production với SESSION_SECRET trống trả exit 1, chỉ nêu tên biến lỗi, không lộ marker mật khẩu URL.

## P04

Cập nhật sau bàn giao: chủ dự án đã tự nhập thông tin bằng CLI. Kiểm tra chỉ đọc DB xác nhận `admin@khosimso.com` tồn tại với role `ADMIN`, status `active`. Không đọc password_hash hoặc nhận mật khẩu qua chat. Email được chuẩn hóa từ `Admin@khosimso.com`; bản sao cấu hình trước thay đổi nằm trong `.local/config-backups`, không đưa Git.

Thêm InitAdminService, CLI init-admin, input mật khẩu ẩn và test. Root lệnh admin:init/admin:rotate-password; README hướng dẫn operator. Transaction/advisory lock bảo vệ lần bootstrap; có Admin (kể cả locked) thì không tạo hoặc ghi đè người khác. Email STAFF trùng không bị nâng quyền. Password yếu bị từ chối, chỉ lưu scrypt. CLI xoay mật khẩu chỉ tác động Admin đã có, không thay status/role.

`npm run verify` exit 0, 14/14 test. Có test chạy hai bootstrap đồng thời và spawn CLI với credential ngẫu nhiên trong DB test, xác minh DB/hash và output không lộ password/hash. Khi hoàn tất kiểm thử Batch, database vận hành chưa có Admin; sau đó chủ dự án đã khởi tạo tài khoản riêng và kiểm tra DB xác nhận thành công như trên. Không tạo tài khoản mặc định.

## P05

Chốt contract trong phạm vi prompt: **POST /api/v1/auth/login** nhận JSON email/password, Origin bằng FRONTEND_ORIGIN, trả HTTP 200 và DTO `{ user: { id, email, fullName, role }, expiresAt }`. Không phản chiếu password/hash/token trong JSON. Sai mật khẩu, email không tồn tại và locked cùng 401/thông báo. Các input ngoài schema bị 400; body lớn hơn 8 KB bị 413; Origin/content type sai bị 403.

- AuthController xử lý HTTP/cookie; AuthService validate/verify/hash dummy cho unknown email; AuthRepository chịu query và transaction cấp phiên.
- Session token ngẫu nhiên 32 byte, DB chỉ lưu HMAC-SHA256 với SESSION_SECRET. Cookie HttpOnly/SameSite=Strict/Path=/, không Domain. Production dùng Secure và tên __Host-sim_dashboard_session; HTTP dev/test dùng tên riêng không Secure. TTL mặc định 8 giờ, cấu hình được giới hạn 60–604800 giây.
- Login lại với cookie cũ sinh token mới và thay phiên cũ thuộc cùng user. Transaction lock row user/recheck status + hash trước khi ghi phiên. Đổi password Admin thu hồi phiên trong cùng transaction.
- Login limiter PostgreSQL atomic upsert: IP 30 và normalized email 10 trong 15 phút mặc định; trả 429 + Retry-After, có expiration/cleanup. Bucket key HMAC không chứa email/IP raw. Bộ đếm tồn tại qua restart và dùng chung giữa process; không có session/rate limit store in-memory.
- API không tin X-Forwarded-For; test xác nhận spoof header không né được limit. Dọn bucket recheck expires_at trong DELETE, tránh xóa bucket vừa được request khác gia hạn. Không thay status tài khoản vì bị giới hạn.
- Production thiếu SESSION_SECRET hoặc Origin HTTP bị từ chối. API bind localhost; chưa chạy TLS/reverse proxy hoặc deploy.

**Chỉ API login/lưu phiên:** chưa logout, /auth/me, guard đọc/kiểm tra phiên trên request, RBAC, form login, layout Dashboard nghiệp vụ hoặc audit module. Đây là P06–P10, không tự thực hiện. Test TTL ở Batch này kiểm tra expires_at/cookie và constraint; chưa tuyên bố test từ chối một protected request dùng phiên hết hạn khi guard còn chưa xây. UI vẫn là placeholder P01; nội dung giới thiệu kỹ thuật của placeholder chưa được nâng thành trạng thái backend động.

## Danh sách file tạo/chỉnh sửa

Đường dẫn tính từ root workspace ở đầu báo cáo. Không có repo Git riêng trong Dashboard nên review bằng đọc source/file inventory; không tuyên bố git diff sạch hoặc tự commit/push.

| Loại | File | Phạm vi |
|---|---|---|
| Tạo | `.env.example`, `compose.yaml` | P02 config và PostgreSQL local mẫu |
| Tạo | `scripts/postgres.mjs`, `scripts/local-db.mjs`, `scripts/test.mjs` | Quản lý cluster riêng và test isolation |
| Tạo | `apps/api/prisma.config.ts`, `apps/api/prisma/schema.prisma` | Prisma 7 và models được phép trong Batch |
| Tạo | `apps/api/prisma/migrations/migration_lock.toml` | Khóa provider migration |
| Tạo | `apps/api/prisma/migrations/202610240001_users/migration.sql` | P03 users, enums, checks, unique email |
| Tạo | `apps/api/prisma/migrations/202610240002_auth_sessions/migration.sql` | P05 sessions/limiter với FK, checks/index |
| Tạo | `apps/api/src/config.ts` | Validate env, không log giá trị |
| Tạo | `apps/api/src/database/database.service.ts`, `apps/api/src/database/db-health.controller.ts` | Prisma driver/pool/timeouts/health |
| Tạo | `apps/api/src/users/user-input.ts`, `apps/api/src/users/password.ts`, `apps/api/src/users/init-admin.service.ts` | Identity/password/khởi tạo Admin |
| Tạo | `apps/api/src/cli/init-admin.ts`, `apps/api/src/cli/secret-input.ts` | CLI operator và input ẩn |
| Tạo | `apps/api/src/auth/auth.controller.ts`, `apps/api/src/auth/auth.service.ts`, `apps/api/src/auth/auth.repository.ts` | Login/cấp phiên |
| Tạo | `apps/api/src/auth/session-token.ts`, `apps/api/src/auth/login-limiter.ts`, `apps/api/src/http-error.filter.ts` | Cookie token, limiter, lỗi an toàn |
| Tạo | `apps/api/test/environment.test.ts`, `apps/api/test/database.test.ts`, `apps/api/test/users.test.ts`, `apps/api/test/init-admin.test.ts`, `apps/api/test/auth.test.ts` | Unit/HTTP/PostgreSQL/CLI tests |
| Sửa | `apps/api/src/app.module.ts`, `apps/api/src/create-app.ts`, `apps/api/src/main.ts` | DI/bootstrap/env/HTTP setup, giữ liveness P01 |
| Sửa | `apps/api/test/health.test.ts` | Giữ regression health; dùng /auth/me chưa xây để kiểm tra 404 thay login đã được bổ sung |
| Sửa | `apps/api/package.json`, `package.json`, `package-lock.json` | Dependency pin và lệnh build/env/DB/Admin/test |
| Sửa | `.gitignore`, `eslint.config.mjs` | Loại Prisma generated/secret/output khỏi Git/lint authored source |
| Sửa | `README.md`, `tasks/todo.md` | Hướng dẫn hiện hành/tiến độ |
| Tạo | `BATCH_02_REPORT.md` | Báo cáo này |

Sinh cục bộ và **không đưa Git**: `.env` (secret ngẫu nhiên), `.local/postgres-dashboard`, `.local/test-*`, `apps/api/src/generated/prisma`, dist/.next/node_modules. Không đưa credential vào báo cáo. Không sửa source Admin/shared/Home hoặc GAP_ANALYSIS.md; không thêm bảng SIM/đơn/tài chính/nhân viên nghiệp vụ.

## Kết quả kiểm thử thực tế

Các prompt được thực hiện và kiểm chứng tuần tự. Các tình huống race test chủ động tạo request/script đồng thời để kiểm tra constraint, không phải chạy nhiều prompt song song.

| Mốc | Lệnh/check thực thi | Kết quả |
|---|---|---|
| Sau P02, trước P03 | npm run verify | Exit 0; build/typecheck/lint; **5/5 test** |
| Sau P03, trước P04 | npm run db:migrate; npm run verify | Migration up thành công; verify exit 0; **9/9 test** |
| Sau P04, trước P05 | npm run verify | Exit 0; **14/14 test** |
| P05 sau sửa lỗi TypeScript | npm run verify | Exit 0; **26/26 test** |
| Cuối Batch, sau kiểm tra limiter concurrency | npm ci; npm run verify | Cài lại thành công; verify exit 0; **27/27 test**, 0 skipped/failed |
| Dependency | npm ls --depth=0 | Exit 0, các workspace/dependency hợp lệ |
| Migration vận hành local | npm run db:status | 2 migration, Database schema is up to date |
| Startup env sai | Chạy main process production với SESSION_SECRET trống | Exit 1, nêu SESSION_SECRET, marker mật khẩu URL không xuất hiện |
| Native PostgreSQL | Cluster Dashboard và cluster test | PostgreSQL 18.4 thực; tests dùng DB mới và áp cả hai migration |
| Runtime bản build | npm start | Next 3100 và Nest 4200 khởi động thành công; đang chạy để review |
| HTTP smoke | /admin/dashboard, /api/v1/health, /api/v1/health/db | 200, 200 {status:ok}, 200 {status:ok,database:up} |
| Scope regression | GET /api/v1/auth/me | 404, xác nhận chưa làm P06 |
| Dữ liệu vận hành trước khi chủ dự án tự tạo Admin | SELECT count users/sessions/login buckets | **0/0/0**; không rò tài khoản test vào DB Dashboard. Kiểm tra sau thao tác CLI của chủ dự án: Admin local đã tồn tại, active |
| Cleanup test | Kiểm tra các cluster test được giữ lại | 5 cluster private được giữ để debug, 0 cluster test còn chạy |
| Network bind | Get-NetTCPConnection | 3100/4200/55441 chỉ trên 127.0.0.1 |
| Baseline P00 | SHA256 GAP_ANALYSIS.md | `AA27187EF81E85AFE99DCF373A3066B498939ACEBE3922586FA667EA7EBBAE71`, khớp trước/sau |
| Cấu trúc cha | SimMobile inventory | Chỉ Dashboard-Sim-Mobi và Home-Sim-Mobi |

27 test gồm 13 auth/session/limiter/constraints tests, 2 DB health tests, 1 environment test, 2 P01 health/scope tests, 5 init-admin tests và 4 password/users tests. Bao phủ login đúng/sai/unknown/locked, DTO không lộ hash/token, session rotation/TTL/FK/expiry, Origin/body validation, account/IP limit và limit đồng thời, Secure production cookie flags, password rotation thu hồi phiên, stale credential/locked race, seed CLI/log không lộ password, bootstrap đồng thời/idempotent và DB constraints.

Đây là test HTTP/PostgreSQL/CLI local, không suy rộng thành pentest, kiểm chứng TLS production, toàn bộ ma trận quyền hoặc Dashboard nghiệp vụ. Không chạy test UI mới vì không thay UI trong Batch. Compose chưa chạy thực tế do không có Docker.

## Các lỗi đã sửa

1. Windows pg_ctl giữ pipe execFile sau khi DB chạy: dùng spawn stdio ignore, mã thoát và log private; kiểm tra test cluster dừng sau mỗi lần chạy.
2. TypeScript suy luận union headers trong auth test có property undefined, không tương thích Record<string,string>: khai báo kiểu danh sách headers, build/typecheck và toàn bộ test chạy lại đạt.
3. npm ci lần đầu bị EPERM trên next-swc vì dev P01 giữ native DLL: dừng đúng nhóm dev Dashboard đã sở hữu, chạy lại npm ci và verify thành công. Không nâng quyền hoặc tắt bảo vệ hệ điều hành.
4. Rà soát cleanup rate bucket bổ sung điều kiện expires_at ngay tại DELETE để không xóa bucket vừa được gia hạn bởi request khác; thêm test giới hạn account đồng thời.

## Lỗi chưa xử lý và thông tin còn thiếu

- **Không còn lỗi build/typecheck/lint/test/migration local đã biết.** npm còn cảnh báo chính sách install scripts cho prisma/@prisma/engines; không bật allow-all hoặc dùng --force, và generate/build/test thực tế đã chạy thành công sau npm ci. Nếu môi trường triển khai có chính sách chặt hơn, operator cần review script của dependency pin trước khi cấp quyền chạy.
- **Bootstrap Admin local đã hoàn tất bởi chủ dự án.** Truy vấn chỉ đọc xác nhận admin@khosimso.com có role ADMIN, status active. Chưa thực hiện login bằng tài khoản này vì mật khẩu chỉ do chủ dự án giữ; test login sử dụng tài khoản test riêng.
- Docker Compose/TLS/reverse proxy/deploy chưa được kiểm chứng, chưa công khai dịch vụ. API cookie Secure được test header production bằng HTTP test riêng, không tuyên bố browser đã dùng cookie qua một triển khai HTTPS thật.
- Các quyết định CHƯA CHỐT trong §15 v1.6 (upload/xóa SIM, hoa hồng, bài viết, đối soát...) vẫn giữ nguyên; không tự thêm nghiệp vụ.
- API chỉ login và lưu/cấp phiên; auth/me/logout/session guard/RBAC/audit nằm ngoài Batch, chưa được bảo vệ theo các chức năng tương lai đó. Không đưa ứng dụng hiện tại lên public.

## Điều kiện bắt đầu P06–P10

1. Chủ dự án nghiệm thu báo cáo, migration, code và kết quả test Batch 02; giao rõ batch/prompt tiếp theo.
2. Khởi tạo Admin vận hành bằng CLI với credential riêng khi muốn kiểm thử tài khoản thật của dự án; xác nhận database riêng và secret/origin đúng môi trường.
3. Đọc từng prompt P06–P10 cùng v1.6 trước khi triển khai, giữ prerequisite và chạy test sau mỗi bước. P06 mới thêm logout/me và kiểm tra phiên/expiry/current user; P07 mới thêm guard/RBAC; P08/P09/P10 theo file được giao, không coi code Batch này là đã hoàn thành chúng.
4. Trước triển khai riêng tư cần chọn DB/backup/secret store/HTTPS/proxy tin cậy và kiểm chứng môi trường đó. Không tự dùng DB hay auth legacy của Home.

**Dừng sau Batch 02. Không thực hiện P06 hoặc tính năng nghiệp vụ khác.**

## Tài liệu kỹ thuật đã đối chiếu

- [Prisma 7 PostgreSQL](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/postgresql), [Prisma Client generation](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/generating-prisma-client): config datasource/adapter/generator theo phiên bản pin.
- [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html): tham số scrypt/cookie/token và quản lý phiên, không bổ sung quy tắc kinh doanh.
- [Nest Cookies](https://docs.nestjs.com/techniques/cookies): response cookie trên Express adapter.
