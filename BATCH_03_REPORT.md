# BATCH 03 — P06 đến P10

**Ngày kiểm chứng: 24/10/2026, Asia/Saigon.** Workspace: `C:/Users/nghia/OneDrive/Desktop/SimMobile/Dashboard-Sim-Mobi`. Chỉ triển khai P06–P10, tuần tự, không chạy song song các prompt và không thực hiện P11 trở đi.

## 1. Đầu vào và baseline

Đã đọc Master Spec v1.6, source hiện tại, báo cáo P01/Batch 02 và đủ năm prompt gốc. Các prompt P06–P10 được tìm thấy trong `C:/Users/nghia/Downloads/SIM_Dashboard_Prompts_Tung_Chuc_Nang_v1.6/SIM_Dashboard_Prompts_v1.6/New folder/`, thay vì trực tiếp ở đường dẫn cũ trong yêu cầu. Không tự thay nội dung prompt.

Master Spec SHA256 vẫn là `2B7EA72F62CFD10E23043979C89C2B377194B53687743974F672B55D80FC9BA4`. Baseline P00/GAP_ANALYSIS.md giữ nguyên hash `AA27187EF81E85AFE99DCF373A3066B498939ACEBE3922586FA667EA7EBBAE71`. P01–P05 đã có báo cáo và được kiểm tra lại bằng **27/27 test đạt trước khi viết P06**, gồm login đúng/sai/locked, hash, session, migration và Admin CLI. Không cần nhận mật khẩu Admin thật để chạy các test đó.

Có manifest hash source trước sửa trong `.local/batch03-baseline.json` để đối chiếu. Dashboard chưa có Git repository riêng, vì vậy không tuyên bố git diff sạch/commit/push. Không sửa source, config hoặc dữ liệu Home.

## 2. Kết quả từng prompt

| Prompt | Trạng thái | Triển khai | Kiểm chứng trước bước tiếp |
|---|---|---|---|
| P06 | **DONE** | GET me, POST logout; kiểm tra session tồn tại/hết hạn/current role/status, xóa session và cookie, logout idempotent | Full verify exit 0, **31/31 test**; logout rồi phát lại cookie nhận 401 |
| P07 | **DONE** | Shared permission constants, global SessionGuard/PermissionGuard, server resource context, service authorization | Full verify exit 0, **34/34 test**; HTTP fixture test-only kiểm tra 401/403/Admin/owner/role đổi ngay |
| P08 | **DONE** | Màn login, sidebar/header/account/logout, 10 route, loading/error/forbidden, server checks và history/session recheck | Full verify exit 0, **34/34 test**; browser Admin/STAFF, 10 module, 1440/768/390px; Back sau logout đạt |
| P09 | **DONE** | Append-only audit schema/service, tích hợp auth/CLI/permission denied với transaction | Full verify exit 0, **37/37 test**; rollback khi audit lỗi, chặn UPDATE/DELETE/TRUNCATE; migration local áp thành công sau snapshot |
| P10 | **DONE** | API và bảng tài khoản chỉ đọc ADMIN-only, search/filter/pagination, audit truy cập | Full verify cuối exit 0, **42/42 test**, browser filter/pagination/empty/error/mobile/STAFF forbidden |

Sau review cuối đã bỏ cờ sessionStorage khỏi logic xác thực để tránh vòng lặp khi đăng nhập ở tab khác. **Full verify 42/42 test được chạy lại sau thay đổi này**, rồi kiểm tra lại trên trình duyệt: cả ADMIN và STAFF logout → Back đều về màn login. Không dùng localStorage/sessionStorage để xác nhận quyền hoặc session.

## 3. API và hợp đồng đã khóa

Prefix Nest: `/api/v1`.

| API | Quyền | Kết quả |
|---|---|---|
| GET /auth/me | Session còn hạn, user active | 200 `{user:{id,email,fullName,role}}`; thiếu/invalid/revoked/expired/locked/deleted → 401, no-store |
| POST /auth/logout | Cho phép gọi lặp/không còn session; Origin đúng FRONTEND_ORIGIN | 204, thu hồi session và clear cookie cùng thuộc tính path/SameSite/Secure; Origin sai → 403 |
| GET /admin/employees | Session hợp lệ + employees.admin; ADMIN | 200 `{items,page,pageSize,total,totalPages}`; STAFF → 403, anonymous → 401 |

Login P05 giữ nguyên contract và thêm audit. Health/DB health giữ nguyên public/no-store. Route không tồn tại tiếp tục 404. Không thêm API tạo/sửa/xóa/khóa nhân viên hoặc API kinh doanh khác.

Employees query: `page` mặc định 1, 1–10000; `pageSize` mặc định 20, 1–100; `search` trim/tối đa 100 ký tự; `role` ADMIN/STAFF; `status` active/locked. Query lạ, sai enum, pagination âm/thập phân hoặc trùng tham số bị từ chối 400. Items chỉ có id/fullName/email/role/status/createdAt, không password_hash hoặc session.

Tìm literal substring theo tên/email, không phân biệt hoa thường, hỗ trợ tên tiếng Việt bằng `pg_unicode_fast` đã xác minh trên PostgreSQL 18.4 UTF-8. Escape %, _ và backslash; truy vấn tham số hóa bằng Prisma.Sql, không SQL từ input nối chuỗi. Count/rows dùng chung một predicate và transaction RepeatableRead; thứ tự created_at DESC, id ASC.

Next route proxy chỉ cho phép ba route auth trên và GET employees. Origin/Cookie chuyển tới API, không tự giả Origin hợp lệ; giới hạn body 8 KB và no-store. API_INTERNAL_ORIGIN chỉ dùng server-side, không có secret trong client config.

## 4. Xác thực, RBAC và logout/Back

- SessionGuard mặc định bảo vệ controller đã đăng ký. PublicAccess chỉ đánh dấu health, DB health, login/logout. User/role/status lấy từ DB mỗi request, không lấy role từ client header/body hoặc cache frontend.
- ADMIN bypass các permission tính năng đã định nghĩa sau khi xác thực. STAFF chỉ có quyền v1.6/P07 đã chốt: xem/nhận đơn, cập nhật đơn của mình, xem/thêm SIM, xóa SIM đủ điều kiện, tạo/đăng bài. Chưa xây các endpoint kinh doanh đó.
- AuthorizationService cũng được gọi ở service danh sách nhân viên. orders.update.own thiếu owner xác minh hoặc owner khác → 403; sims.delete.eligible thiếu eligible=true → 403. Resolver resource chạy server-side; về sau phải tra resource thật và kiểm tra lại trong transaction nhạy cảm, không tin resource context từ client.
- Mỗi trang server kiểm tra session/quyền; không chỉ dựa vào layout hoặc ẩn menu. STAFF direct-link /admin/employees bị chuyển sang trang forbidden, không nhận dữ liệu danh sách. API trực tiếp trả HTTP 403.
- Cookie/session được thu hồi ở backend, me no-store, trang admin dynamic/no-store. UI che nội dung khi pagehide và xác minh lại khi pageshow/popstate/focus. Login/logout dùng chuyển trang đầy đủ để không giữ Next router cache cũ.
- **Browser Back đạt:** Admin và STAFF đã đăng nhập, đi tới Kho SIM, logout, Back; trạng thái cuối là /login, không có Dashboard/tài khoản đang đăng nhập. Phiên cookie cũ cũng bị API test từ chối 401. Trường hợp Back đến trang forbidden công khai chỉ hiển thị thông báo không đủ quyền, không chứa nội dung quản trị.

## 5. Migration và audit

Chỉ thêm migration **202610240003_audit_logs**; không sửa hai migration cũ hoặc xóa dữ liệu. audit_logs gồm id, actor_id/actor_kind, action, target_type/target_id, metadata, created_at. Actor USER/SYSTEM/ANONYMOUS phân biệt người có session, CLI operator và login thất bại không xác minh danh tính. Không gán email người bị thử đăng nhập thành actor đã được xác thực.

Không FK tự ghi lại actor khi xóa user: giữ identity lịch sử. CHECK bảo vệ actor/metadata; trigger từ chối UPDATE/DELETE/TRUNCATE qua SQL thông thường. Không có audit mutation API hoặc audit viewer trong Batch này. Metadata strict allowlist: không password, token, hash, SESSION_SECRET, raw payload hoặc search text.

Các event hiện có: AUTH_LOGIN_SUCCESS, AUTH_LOGIN_FAILURE, AUTH_LOGOUT, ADMIN_BOOTSTRAP, ADMIN_PASSWORD_ROTATED, AUTHORIZATION_DENIED, EMPLOYEES_LIST_VIEWED. Login failure ghi reason phân loại an toàn, không lưu credential. Đọc danh sách chỉ lưu page/pageSize/role/status/hasSearch, không lưu từ khóa riêng tư.

Session tạo/xóa, bootstrap/rotate và event tương ứng cùng transaction. Khi audit storage lỗi, hành động không được báo thành công; login không cấp cookie/session dở dang. Chính sách cho thao tác nhạy cảm tương lai là fail-closed + cùng transaction hoặc outbox được thiết kế riêng trước khi triển khai; chưa có nghiệp vụ tài chính trong Batch.

Runtime embedded không kèm pg_dump. Trước migration local đã chạy `node scripts/backup-local.mjs` để ghi snapshot hàng dữ liệu nhất quán của users/auth_sessions/auth_login_limits/_prisma_migrations trong `.local/backups`. Đây là JSON private, không phải pg_dump archive; chưa tuyên bố restore production đã được kiểm chứng. Sau đó migrate deploy/status thành công: **3 migration, schema up to date**. Không backfill log giả cho Admin đã tạo trước P09.

## 6. Kết quả test và bằng chứng

| Kiểm tra thực tế | Kết quả |
|---|---|
| Baseline trước P06 | npm test exit 0, 27/27 |
| Sau P06/P07/P08/P09 | npm run verify lần lượt 31/31, 34/34, 34/34, 37/37; build/typecheck/lint đạt |
| P10 sau sửa collation | npm run verify exit 0, 42/42, 0 skipped/failed |
| Review cuối bỏ auth flag cục bộ | npm run verify chạy lại exit 0, 42/42, 0 skipped/failed |
| Sau sửa launcher dev | node --check ba launcher/helper; npm run lint; npm run dev + HTTP smoke đạt |
| API session | Admin/Staff login/me/logout, session missing/malformed/unknown/expired/revoked/locked/deleted, current role cập nhật; 401 sau logout |
| RBAC trực tiếp | 401 anonymous, 403 STAFF/admin permission, Admin qua, spoof X-Role không tác dụng; owner/eligible default deny |
| Audit | actor/action đúng; failure event; không lộ credential; DB mutation bị chặn; log failure rollback session, trả 503 không cookie thành công |
| Employees | ADMIN-only; filter role/status; tên/email không phân biệt hoa thường; tiếng Việt viết hoa; wildcard literal; paging/no overlap/empty; SQL-like input không thành SQL |
| Browser desktop | Admin đi đủ 10 mục; login/header/user/logout; P10 phân trang và filter/search/empty/error |
| Browser responsive | 1440 desktop, 768 tablet, 390 và 320 mobile; menu mở/đóng/điều hướng; trang không tràn ngang, bảng cuộn bên trong vùng table |
| Browser Back sau logout | Admin/Staff kiểm tra lại trên code cuối, đều về /login; không khôi phục phiên |
| Local runtime thật | admin/dashboard không cookie → 307 /login; me/employees → 401; health/DB health → 200; no-store |
| Dữ liệu local sau migration | Chính xác 1 user: Admin đã có của chủ dự án, ADMIN/active; 0 audit giả; không user fixture lọt vào DB thật |
| Cleanup | Các môi trường UI test 3110/4210 và cluster test đã dừng; bản local 3100/4200 được chạy lại để nghiệm thu |

42 test tự động chạy HTTP/PostgreSQL/CLI trên cluster test riêng: giữ 27 test Batch 02 và thêm 4 session, 3 RBAC, 3 audit, 5 employees. Fixture controller RBAC chỉ tồn tại trong test module; không mount vào API vận hành. UI fixture ở cổng 3110/4210 có nhãn “UI kiểm thử”, password ngẫu nhiên giữ private; chưa có test UI tự động tích hợp CI. Các tương tác browser là kiểm tra thực tế qua CUA, không suy rộng thành kiểm thử mọi trình duyệt/mobile device.

Ảnh không chứa dữ liệu khách hàng, chỉ tài khoản test:

- [Login](docs/screenshots/batch03-login.png)
- [Shell desktop](docs/screenshots/batch03-desktop.png)
- [Menu mobile](docs/screenshots/batch03-mobile-menu.png)
- [Danh sách nhân viên desktop](docs/screenshots/batch03-employees-desktop.png)
- [Bảng nhân viên mobile](docs/screenshots/batch03-employees-mobile.png)
- [Danh sách rỗng](docs/screenshots/batch03-employees-empty.png)
- [STAFF bị chặn](docs/screenshots/batch03-forbidden.png)
- [Sau logout và Back](docs/screenshots/batch03-logout-back.png)

## 7. Lỗi đã phát hiện và xử lý

1. Đường dẫn prompt cũ không còn file: tìm đúng trong New folder, đọc toàn bộ trước code; hash spec vẫn khớp.
2. Next lint cấm gán biến tên module: đổi thành feature; không tắt lint rule.
3. Helper UI spawn dùng log stream trước khi file descriptor mở: chờ sự kiện open rồi spawn; cleanup cluster khi lỗi, đã kiểm tra chạy/dừng thành công.
4. Lỗi cú pháp option JSX ở bộ lọc role: sửa thẻ, build/typecheck chạy lại đạt.
5. Test Unicode thất bại với C locale (NHÂN không ghép Nhân). Truy vấn chỉ đọc xác minh default_match=false/unicode_match=true; sửa tại query bằng collation pg_unicode_fast cho cả count/rows, test lại đạt, không đổi collation dữ liệu hoặc cài extension.
6. Review nhận thấy sessionStorage logout flag có thể xung đột với login tab khác: bỏ flag, dùng session backend duy nhất; che cache/history và recheck me. Full verify và browser Back chạy lại đạt. Không tuyên bố đã kiểm thử mọi tổ hợp đa tab.
7. Next dev từ launcher Node --env-file-if-exists chuyển cờ vào NODE_OPTIONS của child, Node từ chối. Thêm scripts/admin.mjs nạp env bằng loadEnvFile rồi spawn Next với execArgv sạch; npm run dev khởi động thành công, watch 0 lỗi và HTTP smoke đạt. Không thay cờ môi trường của API/Prisma đang hoạt động.
8. pg_dump không có trong runtime: dùng snapshot logic private trước migration; không báo sai đã có backup/restore đầy đủ kiểu pg_dump.

## 8. Giới hạn còn tồn tại

- Không có lỗi build/typecheck/lint/test/migration hoặc dev startup còn biết tại thời điểm bàn giao.
- Chưa triển khai công khai, Docker/TLS/reverse proxy/production DB role/restore đầy đủ chưa được kiểm chứng. DB audit trigger ngăn sửa thông thường; trước production cần role vận hành có quyền phù hợp, không cấp quyền quản trị DB cho người dùng ứng dụng.
- Chưa có màn tạo/sửa/khóa/reset nhân viên, cấp permission cá nhân hoặc các module SIM/đơn/tài chính/bài viết. Menu hiển thị placeholder rõ ràng; không có KPI giả.
- Search Unicode cấu hình hiện tại yêu cầu PostgreSQL 18 UTF-8 với pg_unicode_fast; cần kiểm tra version/collation nếu đổi môi trường.
- Quy tắc CHƯA CHỐT §15 vẫn giữ nguyên, không tự quyết định nghiệp vụ.
- Admin thật được giữ nguyên; không kiểm thử password thật của chủ dự án. Các login/role/mutation tests dùng DB test, ảnh có nhãn kiểm thử.

## 9. Điều kiện bắt đầu P11–P15

Chủ dự án nghiệm thu Batch 03 rồi giao rõ các prompt tiếp theo. Trước triển khai đọc từng file P11–P15 cùng v1.6, kiểm tra prerequisites và test sau từng bước. Tài khoản Admin hiện có và database riêng đã sẵn sàng cho kiểm thử local; không cần tạo lại/ghi đè tài khoản. Không coi danh sách P10 là đã có quyền tạo/sửa/khóa user.

Nếu bước tiếp theo chạm mục CHƯA CHỐT hoặc quyền chi tiết chưa có quyết định, dừng đúng phần bị ảnh hưởng; không lấy mô hình cũ của Home để tự bổ sung. Mọi migration tiếp theo là migration bổ sung, giữ audit append-only và dữ liệu hiện hữu.

**Dừng sau P10. Chờ nghiệm thu Batch 03, không tự thực hiện P11.**

## 10. Danh sách file tạo/chỉnh sửa

Danh sách dưới được đối chiếu manifest hash trước/sau; không có file source bị xóa. Next-generated next-env.d.ts và cache/build output không tính là source chỉnh tay. .env thật không sửa trong Batch này; snapshot/fixture/secret nằm trong .local, được ignore.

| Loại | File (từ root Dashboard) |
|---|---|
| Sửa | `.env.example` |
| Sửa | `apps/admin/app/admin/dashboard/page.tsx` |
| Tạo | `apps/admin/app/admin/employees/page.tsx` |
| Tạo | `apps/admin/app/admin/layout.tsx` |
| Tạo | `apps/admin/app/admin/loading.tsx` |
| Tạo | `apps/admin/app/admin/page.tsx` |
| Tạo | `apps/admin/app/admin/[...segments]/page.tsx` |
| Tạo | `apps/admin/app/api/v1/[...path]/route.ts` |
| Tạo | `apps/admin/app/error.tsx` |
| Tạo | `apps/admin/app/forbidden/page.tsx` |
| Sửa | `apps/admin/app/globals.css` |
| Sửa | `apps/admin/app/layout.tsx` |
| Tạo | `apps/admin/app/login/page.tsx` |
| Tạo | `apps/admin/components/auth-boundary.tsx` |
| Tạo | `apps/admin/components/dashboard-shell.tsx` |
| Tạo | `apps/admin/components/employees-table.tsx` |
| Tạo | `apps/admin/components/login-form.tsx` |
| Tạo | `apps/admin/components/module-placeholder.tsx` |
| Tạo | `apps/admin/lib/api-client.ts` |
| Tạo | `apps/admin/lib/api-origin.ts` |
| Tạo | `apps/admin/lib/server-api.ts` |
| Tạo | `apps/admin/lib/server-session.ts` |
| Sửa | `apps/admin/next.config.ts` |
| Sửa | `apps/admin/package.json` |
| Tạo | `apps/api/prisma/migrations/202610240003_audit_logs/migration.sql` |
| Sửa | `apps/api/prisma/schema.prisma` |
| Sửa | `apps/api/src/app.module.ts` |
| Tạo | `apps/api/src/audit/audit.service.ts` |
| Sửa | `apps/api/src/auth/auth.controller.ts` |
| Sửa | `apps/api/src/auth/auth.repository.ts` |
| Sửa | `apps/api/src/auth/auth.service.ts` |
| Tạo | `apps/api/src/auth/session.service.ts` |
| Tạo | `apps/api/src/authorization/access.decorators.ts` |
| Tạo | `apps/api/src/authorization/access.guards.ts` |
| Tạo | `apps/api/src/authorization/authorization.service.ts` |
| Sửa | `apps/api/src/create-app.ts` |
| Sửa | `apps/api/src/database/db-health.controller.ts` |
| Tạo | `apps/api/src/employees/employees.controller.ts` |
| Tạo | `apps/api/src/employees/employees.query.ts` |
| Tạo | `apps/api/src/employees/employees.repository.ts` |
| Tạo | `apps/api/src/employees/employees.service.ts` |
| Sửa | `apps/api/src/health.controller.ts` |
| Sửa | `apps/api/src/users/init-admin.service.ts` |
| Tạo | `apps/api/test/audit.test.ts` |
| Tạo | `apps/api/test/employees.test.ts` |
| Sửa | `apps/api/test/health.test.ts` |
| Tạo | `apps/api/test/rbac.test.ts` |
| Tạo | `apps/api/test/session.test.ts` |
| Tạo | `BATCH_03_REPORT.md` |
| Tạo | `docs/screenshots/batch03-desktop.png` |
| Tạo | `docs/screenshots/batch03-employees-desktop.png` |
| Tạo | `docs/screenshots/batch03-employees-empty.png` |
| Tạo | `docs/screenshots/batch03-employees-mobile.png` |
| Tạo | `docs/screenshots/batch03-forbidden.png` |
| Tạo | `docs/screenshots/batch03-login.png` |
| Tạo | `docs/screenshots/batch03-logout-back.png` |
| Tạo | `docs/screenshots/batch03-mobile-menu.png` |
| Tạo | `packages/shared/src/employees.ts` |
| Sửa | `packages/shared/src/index.ts` |
| Tạo | `packages/shared/src/navigation.ts` |
| Tạo | `packages/shared/src/permissions.ts` |
| Sửa | `README.md` |
| Tạo | `scripts/admin.mjs` |
| Tạo | `scripts/backup-local.mjs` |
| Tạo | `scripts/ui-test.mjs` |
| Sửa | `tasks/todo.md` |
