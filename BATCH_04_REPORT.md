# BATCH 04 — P11 đến P15

Ngày kiểm chứng: **24/10/2026, Asia/Saigon**. Workspace duy nhất được sửa: `C:/Users/nghia/OneDrive/Desktop/SimMobile/Dashboard-Sim-Mobi`. Giữ kiến trúc Next.js/NestJS/Prisma/PostgreSQL hiện có. Thực hiện tuần tự, không agent phụ, không triển khai P16 trở đi.

## 1. Đầu vào và baseline

Đã đọc Master Spec v1.6, đủ P11–P15 gốc, source hiện tại, GAP_ANALYSIS và các báo cáo P01/Batch 02/Batch 03. Prompt gốc ở `C:/Users/nghia/Downloads/SIM_Dashboard_Prompts_Tung_Chuc_Nang_v1.6/SIM_Dashboard_Prompts_v1.6/`. Áp dụng yêu cầu bổ sung trực tiếp của chủ dự án về ADMIN-only reset, không khôi phục mật khẩu cũ và chỉ làm Batch 04; không coi nội dung đính kèm là quyền làm thêm nghiệp vụ.

P01–P10 đã kiểm tra lại trước sửa: **npm test exit 0, 42/42 test**, gồm Admin/STAFF login, session/logout, RBAC, audit và danh sách nhân viên. Không dùng mật khẩu thật của chủ dự án để test. Master Spec giữ SHA256 `2B7EA72F62CFD10E23043979C89C2B377194B53687743974F672B55D80FC9BA4`; GAP_ANALYSIS giữ `AA27187EF81E85AFE99DCF373A3066B498939ACEBE3922586FA667EA7EBBAE71`.

Đã lưu manifest hash source trước sửa trong `.local/batch04-baseline.json` để đối chiếu. Dashboard chưa có Git repository riêng nên không tuyên bố có git diff/commit/push. Không sửa Home, không dùng API website tham chiếu, không thêm dữ liệu demo vào DB local vận hành.

## 2. Trạng thái từng prompt

| Prompt | Trạng thái | Kết quả | Gate trước bước tiếp |
|---|---|---|---|
| P11 | **DONE** | POST create + form ADMIN-only; STAFF/active cố định, validate, email unique, hash scrypt, audit cùng transaction; refresh danh sách | Full verify exit 0, **45/45 test** |
| P12 | **DONE** | PATCH status STAFF + UI xác nhận; khóa thu hồi session, mở cho đăng nhập mới; audit old/new | Full verify exit 0, **48/48 test** |
| P13 | **DONE** | API reset 204, form mật khẩu mới/xác nhận, thu hồi session, không đổi user khác; trang chi tiết STAFF | Full verify exit 0, **51/51 test** |
| P14 | **DONE** | employee_permissions, ma trận 12 quyền, allowlist STAFF, guard/menu/DTO hiệu lực mới, audit before/after | Full verify exit 0, **54/54 test**, browser form |
| P15 | **DONE** | Policy số thập phân chính xác, hiệu lực/lịch sử, lookup theo thời điểm, UI và tỷ lệ hiện hành trong danh sách | Full verify **60/60**, phát hiện lỗi timezone qua UI rồi sửa và chạy lại **61/61** |

Lần full verify cuối sau sửa timezone: **exit 0**, build/typecheck/lint đạt, **61/61 test**, 0 failed/skipped/cancelled. Các test P01–P10 và P11–P14 vẫn đạt trên code cuối. Sau đó chỉ bổ sung tài liệu/ảnh và test harness proxy, không thay source ứng dụng.

## 3. API đã triển khai

Prefix `/api/v1`. Tất cả route nhân viên dưới yêu cầu session active + quyền quản trị, thực tế ADMIN-only. Chưa đăng nhập → 401; STAFF gọi trực tiếp → 403. Mutation yêu cầu Origin đúng FRONTEND_ORIGIN và JSON, body tối đa 8 KB.

| Method / route | Hành vi |
|---|---|
| POST /admin/employees | `{fullName,email,password}` → 201 public identity, gán STAFF/active; email trùng → 409 |
| GET /admin/employees/:id | Thông tin STAFF để xác nhận đúng mục tiêu trong trang quản lý; không password/hash/session |
| PATCH /admin/employees/:id/status | active/locked; revoke session khi khóa, ghi previousStatus/status |
| POST /admin/employees/:id/reset-password | `{password}` theo policy hiện có → 204 không body; thu hồi mọi session của mục tiêu |
| GET /admin/employees/:id/permissions | 12 quyền và enabled có hiệu lực |
| PUT /admin/employees/:id/permissions | Ma trận đủ 12 quyền duy nhất, enabled boolean; ghi transaction/audit |
| GET /admin/employees/:id/commission-policy | Current + history phân trang page/pageSize, mặc định 1/10, tối đa 100 |
| PUT /admin/employees/:id/commission-policy | `{ratePercent:string,effectiveAt?:RFC3339}` → thêm policy mới, không ghi đè bản cũ |

ID/input sai → 400, STAFF không tồn tại → 404, dùng chức năng STAFF cho ADMIN → 400. Không tạo API xóa user, cấp ADMIN, sửa tên/email, sửa giá, duyệt tiền hoặc gửi mail/SMS. Các route mới được mở tương ứng trong allowlist Next; không có generic upstream proxy. CORS bổ sung PATCH/PUT; Origin vẫn kiểm tra ở backend, CORS không thay thế authorization.

GET employees có thêm `commissionRatePercent` string/null; dùng một lateral lookup trong query phân trang, không N+1. Login/me public account thêm `permissions`, không có override metadata hay trường nhạy cảm. UI dùng giá trị backend và kiểm tra lại khi focus/history.

## 4. Database và bảo toàn dữ liệu

Thêm đúng hai migration, không sửa/xóa migration đã áp:

1. `202610240004_employee_permissions`: user_id/permission composite PK, enabled, updated_by/updated_at, FK user_id, CHECK allowlist STAFF. Không có override thì mặc định theo v1.6; không backfill dữ liệu giả.
2. `202610240005_commission_policies`: employee_id, NUMERIC(65,30) rate/previous_rate, effective_at, created_by, created_at, unique(employee_id,effective_at), nonnegative CHECK, trigger xác minh STAFF tồn tại khi insert và trigger append-only chặn UPDATE/DELETE/TRUNCATE.

Policy giữ UUID identity lịch sử độc lập với vòng đời user; không cascade xóa chính sách khi tài khoản bị xóa về sau. Vì vậy employee_id/created_by của lịch sử không đặt FK buộc xóa/sửa lịch sử; insert được kiểm tra STAFF tồn tại bằng transaction khóa hàng và trigger DB. Đây là lựa chọn bảo toàn lịch sử, không phải API xóa tài khoản. updated_by và audit actor tương tự giữ định danh người thao tác.

Trước migrate local đã chạy `node scripts/backup-local.mjs`: snapshot hàng dữ liệu đọc nhất quán trong `.local/backups`, private, không đưa vào báo cáo/source. Snapshot không phải pg_dump, chưa kiểm thử restore production. Migrate deploy/status thực tế thành công: **5 migration, schema up to date**.

Đối chiếu hash toàn bộ hàng users trước/sau migration: **giữ nguyên**; local vẫn đúng **1 ADMIN active, 0 STAFF**. employee_permissions/commission_policies local đều rỗng. Không sửa mật khẩu, timestamp hay thông tin Admin thật; không đưa fixture UI/API vào DB này.

## 5. Quyền và hoa hồng

ADMIN có toàn bộ quyền đã định nghĩa. STAFF chỉ được cấu hình 12 quyền v1.6: xem/nhận/xử lý đơn của mình; xem kho/đăng SIM/xóa SIM đủ điều kiện; viết/đăng bài; xem lợi nhuận; Check SIM/cảnh báo; xem lương/nghỉ của mình. Không cấp finance.admin, employees.admin, settings.admin, sửa giá hoặc duyệt hoa hồng. PUT matrix thiếu/trùng/lạ/sai boolean → 400; DB cũng từ chối permission ngoài allowlist.

Guard lấy effective permissions từ DB trong mỗi session lookup, không giữ permission cũ trong token. Thay quyền xong request kế tiếp của cùng cookie phản ánh ngay. Xử lý đơn vẫn cần ownerId chính mình do server xác minh; quyền lương/nghỉ cần owner self; xóa SIM cần eligible=true. Không mở endpoint nghiệp vụ để giả rằng các module đã hoàn thành. Các DTO hiện có không có cost_price/costPrice; **chưa thể nghiệm thu việc ẩn giá vốn trên API SIM/đơn vì các API đó chưa tồn tại**.

Tỷ lệ dùng string/Decimal, lưu NUMERIC(65,30), reject độ chính xác vượt khả năng lưu thay vì làm tròn. Giới hạn lưu 35 chữ số nguyên và 30 thập phân là giới hạn kỹ thuật, không phải trần nghiệp vụ. P15 gốc yêu cầu không áp trần 100%: API chấp nhận và trả above100Warning, UI cảnh báo chính xác kể cả phần thập phân rất nhỏ vượt 100.

Chưa thiết lập tỷ lệ → null, không tự lấy 0%. Bỏ effectiveAt → đồng hồ DB sau khi khóa user; có effectiveAt → RFC3339 có offset, độ chính xác tối đa mili giây. Trùng employee/time → 409, kể cả hai request đồng thời. Lookup chọn policy mới nhất có effective_at <= thời điểm tra. Thời điểm tương lai không thay tỷ lệ hiện hành sớm. previous_rate phản ánh tỷ lệ tra được tại thời điểm hiệu lực khi ghi thay đổi; các bản ghi lịch sử không được cập nhật lại.

Chỉ chuẩn bị lookup và policy id/rate/effective time để giai đoạn hoàn thành đơn lưu snapshot. Chưa có bảng đơn, commission record, approve hoặc tính tiền, nên **không tuyên bố đã kiểm thử snapshot đơn hoàn thành**. Điều kiện triển khai giai đoạn đó: lưu rate/policy snapshot trong transaction hoàn thành; thay policy không rewrite snapshot; chỉ ghi nhận hoa hồng sau COMPLETED + ADMIN duyệt lợi nhuận. Không tính trên giá bán.

## 6. Kết quả kiểm thử và bằng chứng

| Kiểm tra thực tế | Kết quả |
|---|---|
| Baseline | npm test 42/42 |
| Gate P11/P12/P13/P14 | Full verify lần lượt 45/48/51/54 test, tất cả exit 0 |
| Gate P15 trước kiểm tra UI | Full verify 60/60; UI phát hiện lệch timezone, không bàn giao ngay |
| Sau sửa timezone | npm run verify exit 0: build + typecheck + lint + **61/61** |
| P11 | STAFF tạo được bởi ADMIN, hash salt khác, login được; dữ liệu thiếu/sai/role spoof → 400; race email trùng một 201/một 409; STAFF 403 |
| P12 | Lock → login/cookie cũ 401; unlock → login mới 200, cookie cũ vẫn 401; audit actor + old/new; sai target không ảnh hưởng user khác |
| P13 | Reset 204; password cũ 401, mới 200; session cũ 401; hash/mật khẩu không trong DTO/audit; tài khoản khác không đổi |
| P14 | Test HTTP từng quyền mặc định/revoked/restored trên cùng cookie; ADMIN vẫn được; invalid/admin permission bị chặn; không tự nâng quyền |
| P15 | Exact decimal 30 chữ số lẻ, current/null/future/history/paging; sát nhau 1ms, offset +07; duplicate concurrent 200/409; >100 cảnh báo |
| Audit failure | Trigger PostgreSQL gây lỗi ghi audit: create/status/reset/permission/policy đều rollback, 503 an toàn |
| Bất biến DB | Policy UPDATE/DELETE/TRUNCATE bị chặn; insert nhân viên không tồn tại bị chặn; lịch sử giữ identity khi xóa user test |
| Timestamp | Connection URL cố ý Asia/Bangkok nhưng boundary UTC; Date đối chiếu epoch PostgreSQL và đồng hồ thực; immediate effectiveAt gần createdAt |
| Proxy Next build cuối | `node scripts/ui-api-check.mjs` exit 0, **27 assertions** qua 3110: create/duplicate/lock/unlock/reset/replay/RBAC/policy/Origin/allowlist |
| Browser desktop | Form tạo + native required validation; chi tiết STAFF; nhập 125.5, cảnh báo rồi lưu policy test; current/history cập nhật không F5 |
| Browser responsive | 1440/768/390/320px: scrollWidth <= innerWidth; form/menu dùng được; history/table cuộn trong vùng riêng |
| Browser STAFF | Menu không còn đơn/kho khi thu hồi quyền; direct inventory và employees → forbidden |
| Logout/Back | ADMIN → login; STAFF → trang 403 công khai trong history, vào Dashboard tiếp → login; không phục hồi nội dung quản trị/phiên |
| Local DB | Snapshot/migration/status đạt, user digest giữ nguyên; 1 ADMIN, không fixture STAFF/policy |
| Local runtime cuối | npm run dev khởi động; health/DB health 200, me/employees không cookie 401, admin/dashboard 307 /login, login 200, no-store |
| Cleanup | UI fixture Next/API/PostgreSQL đã dừng; giữ local 3100/4200 để nghiệm thu và trả viewport về mặc định |

Tất cả mutation test chạy trên cluster PostgreSQL test riêng. UI fixture 3110/4210 gắn nhãn UI kiểm thử; script proxy chỉ chấp nhận địa chỉ đó và kiểm tra nhãn tài khoản trước thao tác. Không dùng browser để nhập/reset credential thật của người dùng. Form password đã kiểm tra hiển thị/validation; submit create/reset credential được kiểm thử qua HTTP/API trên fixture. Không tuyên bố có suite UI tự động tích hợp CI, mọi browser/device hoặc pentest/production TLS.

Ảnh kiểm chứng (chỉ dữ liệu kiểm thử):

- [Trang quản lý desktop](docs/screenshots/batch04-employee-desktop.png)
- [Form tạo STAFF](docs/screenshots/batch04-create-desktop.png)
- [Cảnh báo tỷ lệ vượt 100%](docs/screenshots/batch04-rate-warning.png)
- [Trang quản lý mobile](docs/screenshots/batch04-employee-mobile.png)
- [Menu mobile ADMIN](docs/screenshots/batch04-mobile-menu.png)
- [Menu STAFF sau thu hồi quyền](docs/screenshots/batch04-staff-menu.png)
- [Từ chối direct link](docs/screenshots/batch04-permission-denied.png)
- [Phiên đã logout](docs/screenshots/batch04-logout-back.png)

Log lệnh đầy đủ và manifest kiểm chứng nằm private `.local/batch04-*-verify.log`, `.local/ui-proxy-results.json`. Không đính kèm backup/secret/credential vào báo cáo.

## 7. Lỗi phát hiện và xử lý

1. Mock audit Promise không tương thích PrismaPromise trong test P11: build bắt lỗi; thay bằng trigger PostgreSQL gây lỗi audit thật, không cast any hoặc bỏ test. Verify lại đạt trước P12.
2. Breadcrumb trang STAFF chi tiết chưa nhận route con: chọn module có path khớp dài nhất, UI xác minh Nhân viên đúng.
3. UI phát hiện immediate effective time lệch 7 giờ so với created time. Đối chiếu PG/Prisma cho thấy cluster mặc định Asia/Bangkok, adapter-pg 7.10.1 normalize_timestamptz thay offset bằng +00 và serialize Date thành UTC không offset. Test round-trip trước đó cùng adapter che được lỗi. Sửa **tại DatabaseService**, thêm options timezone=UTC trên mọi pooled connection, giữ options khác và không đổi timezone toàn cluster. Thêm test epoch độc lập với cách parse timestamp của adapter, cộng assertion immediate gần đồng hồ thực/createdAt. Full verify lại 61/61 và UI/proxy trên fixture sạch xác nhận thời gian khớp. Không chỉnh node_modules hoặc tự nâng dependency.

## 8. Vấn đề còn tồn tại và nghiệp vụ chưa chốt

- Không còn lỗi chặn build/typecheck/lint/test/migration/luồng Batch 04 đã biết sau sửa timezone.
- **Timestamp lịch sử trước bản sửa cần rà soát riêng nếu dùng để đối soát.** Không tự dịch giờ dữ liệu hiện hữu vì không thể suy ra chắc chắn nguồn/offset của mọi giá trị. Local chỉ có Admin cũ; user rows được giữ nguyên. Snapshot trước migration có thể hỗ trợ điều tra. Phiên cũ tạo trước chuẩn hóa giờ có thể cần đăng nhập lại.
- Chưa kiểm thử backup restore đầy đủ, Docker/TLS/production DB role hoặc triển khai riêng tư trên máy khác. Trigger ngăn thao tác SQL thông thường, không thay thế phân quyền DB production chống superuser tắt trigger.
- Không có API SIM/đơn/tài chính, không snapshot đơn thực; chỉ cơ chế quyền/lookup. Không coi placeholder hoặc quyền sims.create là quy trình upload đã chốt.
- Giữ nguyên CHƯA CHỐT v1.6 §15: upload STAFF, xác nhận lỗi/xóa SIM, người hưởng hoa hồng khi chuyển đơn, sửa bài đồng nghiệp, ngày nghỉ và lương, đối soát khác kỳ/ship/hoàn, giới hạn duyệt lợi nhuận.
- Chưa chốt trần tỷ lệ; >100 cảnh báo và được phép theo P15. Phạm vi này chỉ STAFF; không khóa/reset ADMIN từ UI, chính sách ADMIN tự khóa chưa được mở rộng. Quy tắc hồi tố effectiveAt khi đã có đơn phải review trước khi dùng lookup vào hoàn thành/đối soát; không viết lại policy hoặc snapshot cũ trong Batch này.

## 9. Điều kiện bắt đầu P16–P20

Chủ dự án nghiệm thu Batch 04 và giao các prompt gốc P16–P20. Đọc lại v1.6/báo cáo trước, kiểm tra prerequisite, làm tuần tự và test sau mỗi bước. Mọi bước chạm CHƯA CHỐT phải dừng đúng phần cần quyết định; không mặc định có quyền làm các module chỉ vì xuất hiện trong ma trận. Trước dùng timestamp lịch sử cho nghiệp vụ đối soát cần xử lý việc rà soát ở trên; mọi migration tiếp theo phải giữ dữ liệu và audit/history.

**Dừng sau P15. Chờ nghiệm thu Batch 04; không thực hiện P16.**

## 10. File đã tạo/chỉnh sửa

Danh sách đối chiếu manifest hash trước/sau, tính từ root Dashboard. Generated Prisma, .next/dist, tsbuildinfo và next-env tự sinh không tính là source chỉnh tay. Không xóa source hiện có; không sửa `.env` hoặc các báo cáo batch đã nghiệm thu.

| Loại | File |
|---|---|
| Tạo | `apps/admin/app/admin/employees/[id]/page.tsx` |
| Sửa | `apps/admin/app/admin/employees/page.tsx` |
| Sửa | `apps/admin/app/api/v1/[...path]/route.ts` |
| Sửa | `apps/admin/app/globals.css` |
| Sửa | `apps/admin/components/auth-boundary.tsx` |
| Tạo | `apps/admin/components/create-employee-form.tsx` |
| Sửa | `apps/admin/components/dashboard-shell.tsx` |
| Tạo | `apps/admin/components/employee-commission-form.tsx` |
| Tạo | `apps/admin/components/employee-commission-section.tsx` |
| Tạo | `apps/admin/components/employee-permissions-form.tsx` |
| Tạo | `apps/admin/components/employee-permissions-section.tsx` |
| Tạo | `apps/admin/components/employee-status-action.tsx` |
| Sửa | `apps/admin/components/employees-table.tsx` |
| Tạo | `apps/admin/components/reset-employee-password.tsx` |
| Sửa | `apps/admin/lib/server-session.ts` |
| Tạo | `apps/api/prisma/migrations/202610240004_employee_permissions/migration.sql` |
| Tạo | `apps/api/prisma/migrations/202610240005_commission_policies/migration.sql` |
| Sửa | `apps/api/prisma/schema.prisma` |
| Sửa | `apps/api/src/app.module.ts` |
| Sửa | `apps/api/src/audit/audit.service.ts` |
| Sửa | `apps/api/src/auth/auth.repository.ts` |
| Sửa | `apps/api/src/authorization/authorization.service.ts` |
| Tạo | `apps/api/src/authorization/mutation.guard.ts` |
| Tạo | `apps/api/src/commissions/commissions.controller.ts` |
| Tạo | `apps/api/src/commissions/commissions.input.ts` |
| Tạo | `apps/api/src/commissions/commissions.repository.ts` |
| Tạo | `apps/api/src/commissions/commissions.service.ts` |
| Sửa | `apps/api/src/create-app.ts` |
| Sửa | `apps/api/src/database/database.service.ts` |
| Sửa | `apps/api/src/employees/employees.controller.ts` |
| Tạo | `apps/api/src/employees/employees.input.ts` |
| Sửa | `apps/api/src/employees/employees.repository.ts` |
| Sửa | `apps/api/src/employees/employees.service.ts` |
| Sửa | `apps/api/test/auth.test.ts` |
| Tạo | `apps/api/test/commissions.test.ts` |
| Sửa | `apps/api/test/database.test.ts` |
| Tạo | `apps/api/test/employee-management.test.ts` |
| Tạo | `apps/api/test/employee-permissions.test.ts` |
| Sửa | `apps/api/test/employees.test.ts` |
| Sửa | `apps/api/test/rbac.test.ts` |
| Sửa | `apps/api/test/session.test.ts` |
| Tạo | `BATCH_04_REPORT.md` |
| Tạo | `docs/screenshots/batch04-create-desktop.png` |
| Tạo | `docs/screenshots/batch04-employee-desktop.png` |
| Tạo | `docs/screenshots/batch04-employee-mobile.png` |
| Tạo | `docs/screenshots/batch04-logout-back.png` |
| Tạo | `docs/screenshots/batch04-mobile-menu.png` |
| Tạo | `docs/screenshots/batch04-permission-denied.png` |
| Tạo | `docs/screenshots/batch04-rate-warning.png` |
| Tạo | `docs/screenshots/batch04-staff-menu.png` |
| Tạo | `packages/shared/src/commissions.ts` |
| Sửa | `packages/shared/src/employees.ts` |
| Sửa | `packages/shared/src/index.ts` |
| Sửa | `packages/shared/src/navigation.ts` |
| Sửa | `packages/shared/src/permissions.ts` |
| Sửa | `README.md` |
| Sửa | `scripts/backup-local.mjs` |
| Tạo | `scripts/ui-api-check.mjs` |
| Sửa | `tasks/todo.md` |
