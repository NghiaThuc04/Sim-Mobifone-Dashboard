# BATCH 05 — P16–P20

Ngày kiểm chứng: **24/10/2026**, múi giờ Asia/Ho_Chi_Minh. Workspace duy nhất được sửa: `C:/Users/nghia/OneDrive/Desktop/SimMobile/Dashboard-Sim-Mobi`. Đã đọc v1.6, P16–P20, yêu cầu batch, báo cáo P01–Batch 04 và source/migrations trước khi triển khai. Không sửa Home, không gọi website tham chiếu, không triển khai công khai.

## 1. Trạng thái nghiệm thu

| Prompt | Trạng thái | Kết quả đã xác minh | Gate trước bước tiếp theo |
|---|---|---|---|
| P16 | **DONE** | ADMIN đặt lương theo thời điểm, current/opening/lịch sử theo tháng; số chính xác không âm; audit atomic; STAFF bị chặn | Full verify exit 0, **65/65** |
| P17 | **DONE** | Ghi ngày nghỉ, phân bổ tháng do ADMIN xác nhận, tổng chính xác, chặn trùng khoảng nghỉ kể cả cạnh tranh, audit/rollback | Full verify exit 0, **70/70** |
| P18 | **DONE** | Trang cá nhân chỉ đọc, owner từ session, tháng hiện tại mặc định, lọc tháng/phân trang/rỗng; từ chối truy cập chéo và quyền bị thu hồi | Full verify exit 0, **72/72** |
| P19 | **DONE** | Carriers/sim_categories, CRUD ADMIN, STAFF có sims.view đọc API, mã unique, audit và FK bảo vệ xóa | Full verify exit 0, **75/75** |
| P20 | **DONE** | Schema SIM, số string giữ 0 đầu, partial unique active, giá exact, FK/enum/version, guard visibility, gross profit backend và hướng dẫn rollback | Full verify exit 0, **81/81** |

Baseline trước P16: **61/61** test. Mỗi gate gồm production build, typecheck, lint và test thực với PostgreSQL riêng. Không chạy song song các prompt phụ thuộc. Không triển khai P21 hoặc module nghiệp vụ ngoài phạm vi.

DONE ở đây là phạm vi P16–P20 đã kiểm thử; không có nghĩa hệ thống đã sẵn sàng vận hành tài chính hoặc bán SIM production.

## 2. Hành vi và phạm vi đã triển khai

- **Lương:** NUMERIC(65,30), JSON decimal string, amount không âm, effective_from có offset/độ chính xác mili giây. Bỏ thời điểm thì lấy đồng hồ DB sau khi khóa STAFF. Thêm phiên bản khi đổi; lịch sử cũ không bị UPDATE/DELETE/TRUNCATE. Current theo thời điểm hiện tại, opening trước đầu tháng Việt Nam, items là các thay đổi trong tháng, không phải tổng lương. Trùng nhân viên/thời điểm → 409.
- **Ngày nghỉ:** lưu khoảng ngày, tổng đã xác nhận, lý do, ghi chú cho nhân viên và các phân bổ tháng. Chủ dự án đã xác nhận cách nhập trong [BATCH_05_DECISIONS.md](docs/BATCH_05_DECISIONS.md). Tổng phân bổ phải khớp tổng đợt; mỗi tháng thuộc khoảng nghỉ và không vượt số ngày lịch giao với khoảng đó. Không loại cuối tuần/ngày lễ. Khóa hàng STAFF và trigger DB bảo vệ cộng trùng; deferred trigger kiểm tổng trong transaction. Lịch sử giữ nguyên, chưa có sửa/hủy khi chưa chốt chính sách hiệu chỉnh.
- **Self:** API không nhận employeeId, lấy actor ID từ phiên; không trả employeeId/createdBy/createdAt hoặc thông tin lương/tài khoản khác. Trang chỉ có bộ lọc và bảng đọc; không tạo yêu cầu xin nghỉ.
- **Danh mục:** ADMIN tạo/sửa/xóa danh mục không được sử dụng, tìm kiếm/phân trang ở API; trang quản trị có form và bảng phân trang. Mã slug chuẩn hóa lowercase/trim, unique; tên không rỗng. Không seed dữ liệu kinh doanh, thuật toán phân loại hoặc định giá. STAFF đọc API theo sims.view, không vào trang quản trị hoặc ghi danh mục.
- **SIM:** enum AVAILABLE/RESERVED/SOLD độc lập visibility; mặc định is_visible=false; CHECK cấm visible khi selling_price<=cost_price. Phone chỉ chứa chữ số, string tối đa 32 ký tự, không áp đặt đầu số/độ dài nghiệp vụ chưa chốt. Unique phone WHERE deleted_at IS NULL; lịch sử lưu qua ID cũ. Carrier/category FK RESTRICT. Có deleted_at, error_confirmed_at, created_by/updated_by, version và timestamps phục vụ bước sau. Chưa có price-history/order table hoặc workflow giữ/xóa/đặt SIM. Hàm gross profit dùng decimal chính xác, không float; chưa có SIM API/DTO trả cost_price.

Tái sử dụng guards, auth, transaction/audit, API client, user-row lock và kiến trúc controller → service → repository hiện có. Tách helper decimal chung khỏi tên commission để cùng dùng cho lương/ngày nghỉ/giá; không đổi chính sách tỷ lệ P15. Không thêm dependency hoặc quyền nghiệp vụ mới.

## 3. API mới

Tất cả có prefix `/api/v1`, session bắt buộc; anonymous 401, thiếu quyền 403. Mutation còn kiểm Origin và JSON. Next proxy chỉ allowlist các route đã triển khai.

| Method | Route | Quyền / kết quả |
|---|---|---|
| GET | /admin/employees/:id/salary | employees.admin; month/page/pageSize; current/opening/history |
| PUT | /admin/employees/:id/salary | employees.admin; amount string, effectiveFrom tùy chọn; thêm policy, 200 |
| GET | /admin/employees/:id/leaves | employees.admin; month/page/pageSize; tổng tháng + records |
| POST | /admin/employees/:id/leaves | employees.admin; fromDate/toDate/days/reason/notes/allocations; 201 |
| GET | /me/leaves | leaves.view.self + owner từ phiên; month/page/pageSize |
| GET | /admin/catalogs/:kind | sims.view; kind carriers/sim-categories, search/page/pageSize |
| POST | /admin/catalogs/:kind | settings.admin; code/name; 201 |
| PUT | /admin/catalogs/:kind/:id | settings.admin; code/name; 200 |
| DELETE | /admin/catalogs/:kind/:id | settings.admin; JSON {}; 204; referenced → 409 |

Lương/nghỉ pageSize mặc định 10, catalog 20; tối đa 100. Search catalog tối đa 100 ký tự, escape wildcard để tìm literal. Month mặc định tháng Việt Nam hiện tại. Unknown query fields, ID sai hoặc body thừa bị từ chối. API nghiệp vụ SIM/Check SIM/payroll vẫn 404, không có proxy tự do.

## 4. Database migrations đã chạy

| Migration | Thay đổi |
|---|---|
| 202610240006_employee_salaries | employee_salaries, exact amount, hiệu lực unique, append-only và kiểm STAFF |
| 202610240007_employee_leaves | employee_leave_records/employee_leave_allocations, overlap lock, phân bổ deferred checks, append-only |
| 202610240008_catalogs | carriers/sim_categories, slug unique và CHECK tên |
| 202610240009_sims | sims/SimStockStatus, partial unique phone active, FK/price/visibility/version constraints |

Đã áp thành công trên các cluster test mới và **database local riêng của Dashboard** sau snapshot riêng tư. `npm run db:status`: **9 migrations, schema up to date**. Không sửa migration 001–005, không migrate reset/db push.

Đối chiếu digest SHA-256 từng bảng trước/sau migration và sau restart: users/auth_sessions/auth_login_limits/audit_logs/employee_permissions/commission_policies giữ nguyên. Local có **1 user ADMIN**, không có STAFF; cả 6 bảng mới đều **0 rows**. Không tạo nhân viên, lương, ngày nghỉ, danh mục hoặc SIM mẫu trong DB local. Không đọc/hiển thị hay thay đổi mật khẩu người dùng.

`scripts/backup-local.mjs` đã mở rộng whitelist cho toàn bộ bảng mới. Snapshot chứa dữ liệu nhạy cảm chỉ nằm trong `.local/backups`, không đính kèm báo cáo. Đây là row snapshot nhất quán, không phải pg_dump. Hướng dẫn rollback ở [BATCH_05_MIGRATIONS.md](docs/BATCH_05_MIGRATIONS.md); restore production và destructive rollback **chưa chạy**.

## 5. Kiểm thử và bằng chứng thực tế

**Đã xác minh bằng lệnh:**

| Kiểm tra | Kết quả |
|---|---|
| npm run verify sau từng prompt | 65 → 70 → 72 → 75 → 81 test; mọi gate cuối exit 0 |
| Build Next production / shared / API | PASS |
| Typecheck cả workspace / ESLint max-warnings=0 | PASS |
| Full PostgreSQL/API/unit regression cuối | **81 pass, 0 fail, 0 skip**, khoảng 61.9 giây test runner |
| node scripts/batch05-ui-api-check.mjs | **31/31**, qua Next production proxy tại 3110/4210, DB fixture riêng |
| db:migrate + db:status local | PASS, 006–009 applied, 9 migrations up to date |
| Digest dữ liệu local cũ / bảng mới trống | PASS trước/sau migrate và sau restart |
| Khởi động npm run dev | PASS, Next 3100/API 4200, chỉ localhost |
| Health / health/db | 200 / 200 |
| Anonymous auth/me / admin/dashboard / login | 401 / 307 về login / 200 |
| Dừng fixture UI | PASS, 3110/4210 không còn phục vụ |

Test mới: salaries 4, leaves 5, my-leaves 2, catalogs 3, sims 6; cộng 20 vào baseline 61. Bao gồm exact decimal 30 chữ số, tháng/epoch timezone, negative/NaN/invalid input, thiếu quyền/truy cập chéo, cạnh tranh, immutable history, lỗi audit rollback, unique SIM active/archived, FK RESTRICT và atomic conditional version update. Các test P01–P15 vẫn chạy cùng suite. Log riêng tư: `.local/batch05-p16-verify.log` đến `batch05-p20-verify.log`, `batch05-ui-results.json`, `batch05-live-migrate.log`, `batch05-dev.log`; không chứa trong artifact công khai.

**Đã xác minh bằng trình duyệt trên fixture:**

- ADMIN đăng nhập, lưu mức 5.000.000 → 5.500.000 và thấy cả hai dòng lịch sử.
- ADMIN nhập nghỉ 31/12/2026–01/01/2027: tháng 12 xác nhận 0.5, tháng 1 xác nhận 1, tổng 1.5; lưu thành công, lọc tháng 12 tổng 0.5.
- Tạo và sửa tên danh mục từ giao diện mobile; dữ liệu gắn nhãn UI kiểm thử.
- STAFF thấy tháng hiện tại 10/2026 tổng 0.5; đổi sang 01/2027 tổng 1 và đúng ghi chú bản ghi của mình. Tháng 09/2026 hiển thị rỗng/0. Chỉ có nút Xem tháng, không có sửa/xóa.
- STAFF truy cập trực tiếp /admin/catalogs → trang 403. Menu không có quản trị nhân viên/danh mục/tài chính/cài đặt.
- ADMIN và STAFF logout rồi Browser Back đều ở login, không khôi phục nội dung/phiên.
- Desktop 1440px, tablet 768px, mobile 390px và 320px: menu responsive, form hoạt động, bảng cuộn ngang trong khung; document không tràn ngang. Ảnh viewport được xem lại; một ảnh fullPage ban đầu co bố cục khi capture đã được chụp lại bằng viewport, không sửa CSS dựa trên ảnh capture sai.

Ảnh chỉ chứa fixture, không phải dữ liệu nhân sự/kinh doanh thật:

- [Lương/nghỉ ADMIN desktop](docs/screenshots/batch05-admin-salary-leaves-desktop.png)
- [ADMIN tablet](docs/screenshots/batch05-admin-tablet.png)
- [Danh mục mobile](docs/screenshots/batch05-catalog-mobile.png), [320px](docs/screenshots/batch05-catalog-320.png)
- [Ngày nghỉ STAFF desktop](docs/screenshots/batch05-staff-leaves-desktop.png), [mobile](docs/screenshots/batch05-staff-leaves-mobile.png), [rỗng 320px](docs/screenshots/batch05-staff-empty-320.png)
- [ADMIN logout/Back](docs/screenshots/batch05-admin-logout-back.png), [STAFF logout/Back](docs/screenshots/batch05-staff-logout-back.png)

Chưa kiểm thử deployment HTTPS/TLS, Docker, restore production, tải lớn hoặc trình duyệt Safari/Firefox thật. Chưa đăng nhập bằng mật khẩu ADMIN local vì mật khẩu do chủ dự án giữ; login thực đã kiểm bằng tài khoản trong DB test qua API và trình duyệt.

## 6. Lỗi phát hiện và xử lý

| Lỗi | Nguyên nhân / sửa | Kiểm chứng lại |
|---|---|---|
| P18 lint unused DTO property | Omit bằng destructuring để lại biến không dùng; chuyển projection explicit allowlist | 72/72 + lint PASS |
| Catalog duplicate trả 503 thay 409 | Prisma adapter raw SQL P2010 đặt lỗi trong meta.driverAdapterError.cause; parse boundary bằng Zod theo adapter cài đặt | 75/75 PASS |
| Xóa catalog đang được SIM tham chiếu trả 503 | ON DELETE RESTRICT ánh xạ thành RestrictViolation (SQLSTATE 23001), khác ForeignKeyConstraintViolation 23503 | Mapping cả hai thành 409; 81/81 PASS |
| Nhập date bằng automation fill chưa phát sự kiện React | Quan sát input DOM có value nhưng React chưa nhận thay đổi; dùng thao tác native setValue và nhập bàn phím | Sinh ô tháng, tổng 1.5, lưu/lọc thành công; không đổi source để che lỗi công cụ |

Không còn lỗi build/lint/test chặn nghiệm thu đã biết trong phạm vi Batch 05.

## 7. Những nghiệp vụ chưa chốt và giới hạn

- **BLOCKED riêng phần tự tính lương/ngày nghỉ:** prorate khi thay lương giữa tháng, nghỉ có/không lương, cuối tuần/ngày lễ, khấu trừ/thưởng/phụ cấp chưa chốt. Không tính trong Batch này. Công thức tổng lương đã thống nhất vẫn là lương cứng + hoa hồng được duyệt, chưa thực thi tổng hợp.
- **Chưa chốt hiệu chỉnh nghỉ:** bản ghi đã xác nhận giữ append-only; cần quyết định correction/reversal nếu muốn sửa/hủy về sau. Không tự xóa lịch sử hoặc sửa confirmed total.
- **Chưa triển khai theo phạm vi:** tự ẩn/cảnh báo lỗi giá (P21), UI/import kho SIM, Check SIM, quy trình STAFF đăng/xóa SIM, order/history workflow, duyệt hoa hồng và báo cáo tài chính. Không coi cột version là quy trình đặt SIM hoàn chỉnh.
- Chính sách hồi tố khi đã có đơn/payroll và các điểm CHƯA CHỐT còn trong v1.6 cần chủ dự án quyết định ở prompt liên quan; Batch 05 không thay đổi chúng. Timestamp lịch sử trước sửa UTC Batch 04 vẫn cần operator rà soát nếu dùng đối soát, không tự dịch dữ liệu cũ.
- Chuẩn bị production cần DB role/secret/backup-restore/HTTPS/network riêng và kiểm thử trước triển khai. Không có account mặc định hoặc dữ liệu seed giả trong môi trường vận hành.

## 8. Điều kiện bắt đầu P21–P25

1. Chủ dự án nghiệm thu Batch 05 và cung cấp prompt P21–P25 áp dụng.
2. Giữ migrations 006–009, test 81/81 và guards/audit không hồi quy; backup trước mọi migration tiếp theo.
3. P21 phải thực hiện workflow lỗi giá: auto-hide + cảnh báo theo prompt, không thay CHECK thành cơ chế bỏ qua an toàn. Chưa mở API bán SIM trước khi workflow liên quan hoàn tất.
4. Mọi API kho mới phải whitelist DTO theo quyền, không trả giá gốc cho STAFF; cập nhật tồn kho/version nguyên tử và gắn audit. Unique active/FK phải tiếp tục được DB enforce.
5. Chốt nghiệp vụ còn thiếu đúng phần phụ thuộc, không tự đặt thuật toán phân loại/định giá/xóa hoặc tích hợp đối tác.

**Điểm dừng: P20. Chờ nghiệm thu, không tự thực hiện P21.**

## 9. Danh sách file tạo và chỉnh sửa

Đối chiếu manifest SHA-256 trước Batch 05; không có file nguồn bị xóa. Không thêm dependency hoặc sửa lockfile. Generated Prisma/dist/.next/next-env/tsbuildinfo và dữ liệu riêng `.local/.env` không tính vào danh sách source. Dashboard không có Git repository riêng nên đây là đối chiếu manifest và review source, không phải git diff/commit.

Baseline P00 giữ nguyên SHA-256 `AA27187EF81E85AFE99DCF373A3066B498939ACEBE3922586FA667EA7EBBAE71`. Spec gốc trong thư mục prompts Downloads giữ nguyên `2B7EA72F62CFD10E23043979C89C2B377194B53687743974F672B55D80FC9BA4`. Các báo cáo batch cũ giữ nguyên.

### File chỉnh sửa

- `apps/admin/app/admin/employees/[id]/page.tsx`
- `apps/admin/app/api/v1/[...path]/route.ts`
- `apps/admin/app/globals.css`
- `apps/admin/components/employee-commission-form.tsx`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/app.module.ts`
- `apps/api/src/audit/audit.service.ts`
- `apps/api/src/commissions/commissions.input.ts`
- `apps/api/src/create-app.ts`
- `apps/api/src/employees/employees.repository.ts`
- `packages/shared/src/commissions.ts`
- `packages/shared/src/index.ts`
- `packages/shared/src/navigation.ts`
- `README.md`
- `scripts/backup-local.mjs`
- `tasks/todo.md`

### File tạo mới

- `apps/admin/app/admin/catalogs/page.tsx`
- `apps/admin/app/admin/my-leaves/page.tsx`
- `apps/admin/components/catalog-manager.tsx`
- `apps/admin/components/employee-leaves-form.tsx`
- `apps/admin/components/employee-leaves-section.tsx`
- `apps/admin/components/employee-salary-form.tsx`
- `apps/admin/components/employee-salary-section.tsx`
- `apps/admin/components/leave-records-table.tsx`
- `apps/api/prisma/migrations/202610240006_employee_salaries/migration.sql`
- `apps/api/prisma/migrations/202610240007_employee_leaves/migration.sql`
- `apps/api/prisma/migrations/202610240008_catalogs/migration.sql`
- `apps/api/prisma/migrations/202610240009_sims/migration.sql`
- `apps/api/src/catalogs/catalogs.controller.ts`
- `apps/api/src/catalogs/catalogs.input.ts`
- `apps/api/src/catalogs/catalogs.repository.ts`
- `apps/api/src/catalogs/catalogs.service.ts`
- `apps/api/src/common/calendar.ts`
- `apps/api/src/inventory/sim-pricing.ts`
- `apps/api/src/leaves/leaves.controller.ts`
- `apps/api/src/leaves/leaves.input.ts`
- `apps/api/src/leaves/leaves.repository.ts`
- `apps/api/src/leaves/leaves.service.ts`
- `apps/api/src/leaves/my-leaves.controller.ts`
- `apps/api/src/salaries/salaries.controller.ts`
- `apps/api/src/salaries/salaries.input.ts`
- `apps/api/src/salaries/salaries.repository.ts`
- `apps/api/src/salaries/salaries.service.ts`
- `apps/api/test/catalogs.test.ts`
- `apps/api/test/helpers/http-fixture.ts`
- `apps/api/test/leaves.test.ts`
- `apps/api/test/my-leaves.test.ts`
- `apps/api/test/salaries.test.ts`
- `apps/api/test/sims.test.ts`
- `BATCH_05_REPORT.md`
- `docs/BATCH_05_DECISIONS.md`
- `docs/BATCH_05_MIGRATIONS.md`
- `docs/screenshots/batch05-admin-logout-back.png`
- `docs/screenshots/batch05-admin-salary-leaves-desktop.png`
- `docs/screenshots/batch05-admin-tablet.png`
- `docs/screenshots/batch05-catalog-320.png`
- `docs/screenshots/batch05-catalog-mobile.png`
- `docs/screenshots/batch05-staff-empty-320.png`
- `docs/screenshots/batch05-staff-leaves-desktop.png`
- `docs/screenshots/batch05-staff-leaves-mobile.png`
- `docs/screenshots/batch05-staff-logout-back.png`
- `packages/shared/src/catalogs.ts`
- `packages/shared/src/decimal.ts`
- `packages/shared/src/leaves.ts`
- `packages/shared/src/salaries.ts`
- `scripts/batch05-ui-api-check.mjs`
