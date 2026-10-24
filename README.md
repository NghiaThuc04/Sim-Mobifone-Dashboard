# SIM Management Dashboard — Batch 08

Workspace: `C:/Users/nghia/OneDrive/Desktop/SimMobile/Dashboard-Sim-Mobi`.

Giữ Next.js 16.4.3 + TypeScript (Admin), NestJS 12.2.0 + TypeScript (API), Prisma/PostgreSQL và npm workspaces. Batch 08 thêm schema đơn/snapshot, service giữ SIM, API tạo đơn test nội bộ và danh sách đơn theo quyền. STAFF upload mới có contract/placeholder; quyền xóa có điều kiện vẫn BLOCKED và chưa tích hợp nguồn đơn với Check SIM. Home không bị sửa hoặc kết nối. [Baseline P00](GAP_ANALYSIS.md), [P01](docs/P01_VERIFICATION.md), [Batch 02](BATCH_02_REPORT.md), [Batch 03](BATCH_03_REPORT.md), [Batch 04](BATCH_04_REPORT.md), [Batch 05](BATCH_05_REPORT.md), [Batch 06](BATCH_06_REPORT.md), [Batch 07](BATCH_07_REPORT.md), [Batch 08](BATCH_08_REPORT.md).

## Sử dụng Dashboard hiện tại

Mở [http://127.0.0.1:3100/login](http://127.0.0.1:3100/login), dùng tài khoản đã khởi tạo bằng CLI. Không có tài khoản/mật khẩu mặc định trong source. ADMIN thấy 12 mục menu, STAFF thấy các mục được phép; các module chưa xây hiển thị placeholder, không có KPI/dữ liệu demo. Trang Nhân viên dành riêng ADMIN: tìm tên/email, lọc role/status, phân trang, tạo STAFF; bấm Quản lý để khóa/mở, reset mật khẩu, cấu hình quyền, tỷ lệ hoa hồng, lương cứng và ngày nghỉ. Trang Danh mục SIM quản lý nhà mạng/loại SIM; trang Ngày nghỉ của tôi chỉ đọc dữ liệu theo phiên. Kho SIM đã có danh sách theo quyền, tạo/sửa và import dành ADMIN. Check SIM tìm chính xác số, ADMIN có nút xác nhận bỏ khỏi kho; cảnh báo giá giữ lịch sử cả SIM đã rời kho. Trang Đơn hàng chỉ đọc, có lọc tháng/ngày, trạng thái, mã đơn/SIM chính xác, người được giao và phân trang; không có nút nhận/đổi trạng thái. Không có xóa tài khoản, cấp ADMIN, tính/duyệt hoa hồng hoặc nghiệp vụ P36 trở đi.

Mỗi trang kiểm tra session server-side; Next layout không phải ranh giới bảo mật duy nhất. API global SessionGuard yêu cầu xác thực trừ các route PublicAccess rõ ràng; PermissionGuard và service enforce quyền. Role/status/quyền cá nhân lấy lại từ DB mỗi request. orders.update.own và quyền lương/nghỉ self từ chối nếu thiếu owner đúng; sims.delete.eligible từ chối nếu thiếu eligibility do backend xác minh. Ngày nghỉ self và danh sách đơn đã có endpoint; payroll chưa có. DELETE SIM hiện chỉ ADMIN: STAFF bị chặn ngay cả SOLD, cảnh báo giá, timestamp xác nhận cũ hoặc fixture đơn COMPLETED chưa tích hợp eligibility. [Quyết định còn chờ](DECISION_SIM_ERROR.md).

`DELETE /api/v1/admin/sims/:id` nhận `{ version, reason? }` với phiên bản hiện tại từ Check SIM; reason tùy chọn 1–500 ký tự. Transaction khóa hàng SIM, đặt deleted_at và tắt hiển thị, tăng version, ghi `sim_removal_logs` bất biến và audit cùng lúc. ADMIN được xóa AVAILABLE/RESERVED/SOLD và SIM lỗi giá; không sửa trạng thái kho hoặc giá đã lưu, không hủy đơn. Request cũ trả 409; bản ghi đã rời kho trả 404 kể cả lặp lại. Batch 08 đã kiểm chứng giữ order_items/giá/số snapshot và reservation qua API sửa/xóa SIM; hoa hồng/tài chính chưa có nguồn nên chưa kiểm chứng.

`POST /api/v1/admin/internal-orders` chỉ dành ADMIN ở development/test và mặc định tắt (`INTERNAL_ORDER_CREATION_ENABLED=false`). Không bật trong `.env` hiện dùng. Request cần customer, simId và idempotencyKey UUID; backend khóa SIM, giữ hàng và chụp giá trong cùng transaction với audit/key. Không nhận giá hoặc trạng thái từ client, không có checkout public. `POST /api/v1/admin/staff-sim-submissions` trả 501/NOT_IMPLEMENTED sau kiểm quyền và không ghi dữ liệu. Xem [contract đơn](docs/INTERNAL_ORDERS.md) và [quyết định STAFF upload](STAFF_UPLOAD_DECISIONS.md).

Logout vô hiệu hóa session trong DB và xóa cookie. /auth/me trả 401 sau logout kể cả phát lại cookie cũ. UI no-store, che nội dung trước khi trang vào history/BFCache và recheck /me khi pageshow/popstate/focus; dùng điều hướng đầy đủ sau login/logout. Không lấy localStorage/sessionStorage làm nguồn xác thực. Browser Back sau logout đã kiểm tra bằng Admin và STAFF: trở về login hoặc trang từ chối truy cập, không phục hồi phiên.

Next proxy có allowlist chính xác cho auth và các route nhân viên đã triển khai, không phải proxy tự do. API_INTERNAL_ORIGIN là cấu hình server, mặc định http://127.0.0.1:4200; không đặt thành NEXT_PUBLIC_*. Cookie/Origin được chuyển tới Nest, body giới hạn 8 KiB ngoại trừ hai route import có giới hạn riêng, lỗi hạ tầng không trả chi tiết. Thao tác ghi yêu cầu Origin đúng và JSON, ngoài kiểm tra session/quyền. Không trỏ proxy tới API website tham chiếu.

Migration mới 202610240003_audit_logs chỉ thêm audit_logs/triggers. Audit append-only chống UPDATE/DELETE/TRUNCATE; không có API chỉnh sửa audit. Actor USER/SYSTEM/ANONYMOUS được phân biệt; CLI operator không bị gán giả thành một người dùng đã đăng nhập. Ghi login thành công/thất bại, logout, bootstrap/đổi mật khẩu, permission denied và đọc danh sách tài khoản. Metadata allowlist không lưu password/token/hash/secret hoặc search text. Session/Admin mutation và audit dùng cùng transaction; lỗi ghi log trả lỗi và rollback, không cấp cookie thành công. Đây cũng là nguyên tắc cho thao tác nhạy cảm tương lai; chưa xây tài chính/outbox hoặc audit viewer.

Tìm tên tiếng Việt dùng collation built-in pg_unicode_fast, đã kiểm chứng trên PostgreSQL 18.4; yêu cầu PostgreSQL 18 UTF-8 khi triển khai cấu hình hiện tại. Query tham số hóa, escape %, _ và backslash để tìm literal substring; không cần extension hoặc đổi collation dữ liệu đang có. Thứ tự danh sách created_at DESC, id ASC; page mặc định 1, pageSize 20 (1–100), search tối đa 100 ký tự. Chế độ repeatable read giữ count và rows nhất quán trong một response.

## Chạy local

Node 24.21.0, npm 11.19.0; cài dependency tại root Dashboard. Dừng nhóm dev/start trước `npm ci` trên Windows để tránh khóa thư viện native Next.

```powershell
cd C:\Users\nghia\OneDrive\Desktop\SimMobile\Dashboard-Sim-Mobi
npm ci
```

Chọn một cách chạy PostgreSQL riêng, không dùng database Home:

1. **Docker:** copy `.env.example` thành `.env`, thay password/secret bằng giá trị ngẫu nhiên của bạn, điền DATABASE_URL và POSTGRES_USER/PASSWORD/DB nhất quán. Chạy `docker compose up -d db`. Chỉ mở DB tại 127.0.0.1:55441. Dừng bằng `docker compose stop db`; không xóa volume chứa dữ liệu. Compose chưa được chạy trên máy kiểm thử vì chưa có Docker trong PATH.
2. **PostgreSQL binaries đã cài:** đặt PG_BIN trỏ đến thư mục có initdb/pg_ctl trong process environment, chạy `npm run db:local`. Script tạo `.local/postgres-dashboard`, bind localhost 55441, mật khẩu ngẫu nhiên và `.env` nếu chưa có; giữ nguyên `.env` có sẵn. `npm run db:stop` dừng cluster. Nếu tự cung cấp `.env`, bảo đảm DATABASE_URL trỏ đúng cluster. Không dùng tiện ích local này cho production.

Không chạy Docker và native cùng cổng. `.env`/`.local` chứa secret và được ignore; không gửi chat, commit hoặc đưa vào client. Trên Windows phải bảo vệ thư mục bằng quyền tài khoản hệ điều hành; mode 0600 trong Node không thay thế Windows ACL.

```powershell
npm run db:generate
npm run db:migrate
npm run admin:init
npm run dev
```

`admin:init` yêu cầu nhập thông tin và mật khẩu ẩn trong terminal của bạn. Nếu chưa muốn tạo tài khoản, có thể chạy API/placeholder trước; không có tài khoản hoặc dữ liệu demo mặc định.

- Admin placeholder: [http://127.0.0.1:3100/admin/dashboard](http://127.0.0.1:3100/admin/dashboard).
- Liveness P01: [http://127.0.0.1:4200/api/v1/health](http://127.0.0.1:4200/api/v1/health), chỉ xác nhận tiến trình HTTP.
- Database health: [http://127.0.0.1:4200/api/v1/health/db](http://127.0.0.1:4200/api/v1/health/db), SELECT 1 qua Prisma, lỗi DB trả 503 an toàn.
- `dev` build Prisma/shared/API trước, rồi chạy Next dev, shared watch, API node watch và TypeScript watch. Ctrl+C dừng nhóm. Không khởi động hai nhóm trên cùng cổng.

## Cấu hình môi trường

| Biến server | Ý nghĩa |
|---|---|
| DATABASE_URL | PostgreSQL connection URL, bắt buộc, không log |
| SESSION_SECRET | Secret ngẫu nhiên tối thiểu 32 ký tự, bắt buộc cả dev/test/production |
| FRONTEND_ORIGIN | Origin chính xác, không path/trailing slash; production phải HTTPS |
| NODE_ENV / PORT | development/test/production; port mặc định 4200, API chỉ bind 127.0.0.1 |
| SESSION_TTL_SECONDS | Mặc định 28800 (8 giờ), giới hạn 60–604800 |
| LOGIN_WINDOW_SECONDS | Mặc định 900, giới hạn 60–3600 |
| LOGIN_IP_MAX / LOGIN_ACCOUNT_MAX | Mặc định 30/IP và 10/email trong một cửa sổ; tính mọi lần thử kể cả thành công |
| PG_BIN | Thư mục PostgreSQL binaries dùng cho native local/test, không cần cho API production |
| API_INTERNAL_ORIGIN | Origin Nest dành riêng cho Next server/proxy; mặc định http://127.0.0.1:4200 |
| POSTGRES_USER/PASSWORD/DB | Chỉ Docker Compose local |

Có thể sinh secret tại terminal riêng bằng `node -e "process.stdout.write(require('node:crypto').randomBytes(48).toString('hex'))"`; đưa vào cấu hình riêng, không đưa vào README/client/log. Chưa có file production chứa giá trị thật. Production cần DB role riêng có quyền phù hợp, secret riêng, HTTPS và reverse proxy riêng tư; chưa triển khai.

Prisma/client/adapter cùng pin 7.10.1, PostgreSQL runtime đã kiểm tra 18.4. Cấu hình datasource nằm ở `apps/api/prisma.config.ts`, URL lấy từ environment. Không tự migrate khi API khởi động. Migration đã áp phải giữ nguyên; dùng migration bổ sung cho thay đổi mới. Không dùng migrate reset/db push trên dữ liệu vận hành.

## Users và Admin ban đầu

`users`: UUID, email unique chuẩn hóa trim/lowercase, full_name, password_hash, role ADMIN/STAFF, status active/locked, timestamps. PostgreSQL enforce định dạng/unique email, tên không rỗng, hash hợp lệ và enums. Tạo STAFF qua trang Nhân viên; không sửa role ADMIN từ API này.

Password dùng scrypt async N=65536/r=8/p=2, salt 16 byte ngẫu nhiên, key 32 byte, timingSafeEqual. Chính sách tạo/đổi: 12–128 ký tự và ít nhất 12 ký tự sau trim; không có mật khẩu mặc định/plaintext trong DB. Tham số hash được version hóa; thay thuật toán/parameters cần migration/chiến lược chuyển đổi phù hợp.

`npm run admin:init`: nhập email, họ tên, password ẩn và xác nhận. Không truyền password trong argv hoặc ghi vào .env. Tự động hóa có thể cấp ADMIN_EMAIL/ADMIN_FULL_NAME/ADMIN_PASSWORD từ secret manager/process env và xóa sau khi dùng. Script xóa ADMIN_PASSWORD khỏi environment trong process của nó; operator vẫn cần xóa biến trong process cha.

Chỉ tạo Admin đầu tiên. Nếu đã có ADMIN (kể cả locked), chạy lại không tạo hoặc đổi tài khoản. Transaction/advisory lock chống bootstrap đồng thời; không nâng STAFF có email trùng. Seed đã được kiểm chứng trong DB test; chủ dự án cũng đã khởi tạo Admin local bằng CLI và DB xác nhận ADMIN/active. Không có credential mặc định trong source.

Đổi password ADMIN bằng `npm run admin:rotate-password`, nhập email Admin hiện có và password mới ẩn. Không tạo user/mở khóa/đổi role. Lệnh thu hồi toàn bộ phiên của Admin trong cùng transaction. Operator cần quyền vào máy/DB và quy trình backup trước thao tác vận hành. Reset STAFF có form riêng trong Quản lý nhân viên, ADMIN-only; không xem mật khẩu cũ, không gửi email/SMS tự động.

## P05 — API login và session

`POST /api/v1/auth/login`, JSON `{ "email": "email-cua-ban", "password": "mat-khau-cua-ban" }`. Yêu cầu header Origin đúng FRONTEND_ORIGIN và Content-Type application/json. Body tối đa 8 KB; không log payload. Khi gọi từ frontend về sau dùng fetch với credentials: include.

- 200: `{ user: { id, email, fullName, role, permissions }, expiresAt }` và Set-Cookie. Không trả hash/password/token trong JSON.
- 401 chung cho password sai, email không tồn tại hoặc locked; thực hiện scrypt cả khi email không tồn tại.
- 400 input sai/JSON hỏng; 413 body quá lớn; 403 Origin hoặc content type không hợp lệ; 429 quá ngưỡng với Retry-After; lỗi hạ tầng được che chi tiết.

Session token 32 byte ngẫu nhiên, chỉ gửi bằng HttpOnly/SameSite=Strict/Path=/ cookie không Domain. Production dùng Secure và tên `__Host-sim_dashboard_session`; dev/test HTTP localhost dùng `sim_dashboard_session` không Secure để test local. DB chỉ lưu HMAC-SHA256 của token với SESSION_SECRET, user FK, created_at/expires_at. Login lại với cookie phiên cũ thay token và xóa phiên cũ thuộc cùng user; không dùng token client làm session mới. Trước khi tạo session, lock user/recheck password hash và status để ngăn cấp phiên từ credential vừa bị đổi/khóa.

Brute force dùng upsert nguyên tử PostgreSQL cho IP và email chuẩn hóa, key HMAC, có hết hạn/dọn bucket; dùng chung giữa các process và không mất khi restart. Không tự khóa status tài khoản. API không tin X-Forwarded-For; khi triển khai sau proxy cần thiết kế trust proxy theo mạng tin cậy trước khi mở cho người dùng. Cookie Strict yêu cầu frontend/API cùng site, khuyến nghị reverse proxy cùng site qua HTTPS khi triển khai.

**Sau Batch 06:** /auth/me trả permissions có hiệu lực. ADMIN luôn có toàn bộ quyền; STAFF mặc định có 12 quyền v1.6, các override chỉ được tắt/bật trong allowlist. Không thể cấp finance.admin/employees.admin/settings.admin cho STAFF. Menu và route server dùng quyền hiện hành; UI kiểm tra lại khi lấy focus/history. Kho SIM có API/UI quản trị; chưa có đơn hoặc tính tài chính. Dừng trước P26, không triển khai công khai.

## API quản lý STAFF — P11 đến P15

Tất cả route dưới có prefix `/api/v1`, bắt buộc ADMIN; anonymous → 401, STAFF → 403. Chỉ thao tác trên STAFF, không dùng để khóa/reset ADMIN.

| Method / route | Body hoặc kết quả |
|---|---|
| POST /admin/employees | `{fullName,email,password}`; 201 public DTO, email trùng → 409 |
| GET /admin/employees/:id | Thông tin cơ bản và commissionRatePercent hiện hành hoặc null |
| PATCH /admin/employees/:id/status | `{status:"active" hoặc "locked"}`; khóa thu hồi mọi session, mở không khôi phục cookie cũ |
| POST /admin/employees/:id/reset-password | `{password}` theo chính sách hiện có; 204, thu hồi session |
| GET /admin/employees/:id/permissions | Ma trận 12 quyền hiệu lực |
| PUT /admin/employees/:id/permissions | `{permissions:[{permission,enabled},...]}`; đủ 12 quyền, không trùng/không quyền admin |
| GET /admin/employees/:id/commission-policy | Current + history, page/pageSize (mặc định 1/10, tối đa 100 mỗi trang) |
| PUT /admin/employees/:id/commission-policy | `{ratePercent:"10.5",effectiveAt?:"RFC3339"}`; thêm bản mới, không ghi đè lịch sử |

Các mutation cùng transaction với audit, khóa hàng nhân viên để tuần tự hóa cạnh tranh. Audit lỗi → rollback; không trả mật khẩu/hash trong DTO hoặc log. POST create chỉ gán STAFF, active. Không đổi email/tên/role trong Batch này.

Hoa hồng dùng NUMERIC(65,30) và JSON string, không Number khi lưu/lookup. Nhập không âm, tối đa 35 chữ số nguyên/30 chữ số thập phân; vượt khả năng lưu bị từ chối thay vì làm tròn. Đây là giới hạn kỹ thuật, không phải trần 100%: tỷ lệ >100% được chấp nhận và cảnh báo. Không có chính sách thì null, không tự đặt 0%.

effectiveAt có offset và độ chính xác tối đa mili giây; bỏ qua thì lấy đồng hồ DB sau khi khóa hàng. Trùng cùng nhân viên/thời điểm → 409. Lookup dùng effective_at <= thời điểm tra, mới nhất trước; history phân trang gồm cũ/mới/actor/thời gian. Lịch sử append-only và giữ identity ngay cả khi tài khoản bị xóa trong tương lai; không có API xóa user hiện tại. Mọi tạo policy đều kiểm tra STAFF tồn tại trong service/transaction và trigger database.

Chỉ chuẩn bị lookup; chưa có đơn/snapshot/tính tiền. Khi xây hoàn thành đơn sau này phải lưu policy id + rate snapshot trong transaction hoàn thành, chỉ ghi nhận hoa hồng sau ADMIN duyệt lợi nhuận. Không dùng giá bán làm cơ sở tính, không tính lại đơn cũ khi đổi policy. Quy tắc hồi tố tỷ lệ sau khi đã có đơn cần được review trước giai đoạn đó.

Lớp kết nối PostgreSQL cố định session timezone UTC vì adapter-pg phiên bản pin chuẩn hóa timestamp theo UTC. UI hiển thị lịch sử ở Asia/Ho_Chi_Minh; trường chọn thời điểm ghi rõ múi giờ thiết bị. Test đối chiếu epoch PostgreSQL ngăn lỗi lệch 7 giờ. Không tự sửa timestamp lịch sử trước bản sửa; cần operator rà soát nếu sử dụng lịch sử cũ để đối soát.

## API Batch 05 — P16 đến P20

Prefix `/api/v1`. Các mutation cần session, quyền, Origin đúng và JSON. Không gửi số tiền/số ngày bằng JSON number; sử dụng decimal string chính xác.

| Method / route | Quyền và hợp đồng |
|---|---|
| GET /admin/employees/:id/salary | ADMIN; month YYYY-MM, page/pageSize mặc định 1/10, tối đa 100. current, opening trước đầu tháng và lịch sử thay đổi trong tháng |
| PUT /admin/employees/:id/salary | ADMIN; `{amount:"5000000",effectiveFrom?:"RFC3339"}`; thêm phiên bản hiệu lực, không ghi đè lịch sử |
| GET /admin/employees/:id/leaves | ADMIN; month/page/pageSize; tổng số ngày xác nhận tháng độc lập phân trang |
| POST /admin/employees/:id/leaves | ADMIN; `{fromDate,toDate,days,reason,notes,allocations:[{month,days}]}`; ngày dạng YYYY-MM-DD, số ngày là string |
| GET /me/leaves | leaves.view.self; month/page/pageSize; owner lấy từ session, không nhận employeeId; chỉ đọc |
| GET /admin/catalogs/:kind | sims.view; kind carriers hoặc sim-categories; search/page/pageSize (1/20, tối đa 100) |
| POST /admin/catalogs/:kind | settings.admin; `{code,name}` |
| PUT /admin/catalogs/:kind/:id | settings.admin; `{code,name}` |
| DELETE /admin/catalogs/:kind/:id | settings.admin; body `{}`; 204, hoặc 409 nếu đang có SIM tham chiếu |

Lương dùng NUMERIC(65,30), không âm; không có policy trả null. effectiveFrom bỏ qua thì lấy đồng hồ DB, trùng thời điểm trả 409. Lịch sử theo tháng Việt Nam; mức opening không phải tổng lương tháng. Chưa có prorate, bảng lương, thưởng/phụ cấp/khấu trừ hoặc thanh toán. Thay đổi lương tạo bản mới; không có API sửa/xóa lịch sử.

Ngày nghỉ dùng khoảng ngày lịch và số ngày ADMIN xác nhận. Theo [quyết định của chủ dự án](docs/BATCH_05_DECISIONS.md), ADMIN nhập số ngày từng tháng, tổng phân bổ phải khớp tổng đợt, không vượt số ngày lịch thuộc tháng; không tự loại cuối tuần/ngày lễ. Khoảng nghỉ trùng bị từ chối 409, kể cả gọi đồng thời; không cộng trùng. Không tự trừ lương hoặc xác định nghỉ có lương. Lịch sử append-only; sửa/hủy bản ghi cần chính sách bổ sung. Ghi chú được đặt nhãn rõ là hiển thị cho nhân viên. API self không trả employeeId/createdBy hoặc dữ liệu tài khoản khác; quyền bị thu hồi áp dụng ngay.

Danh mục không seed tên nhà mạng/loại SIM mặc định, không có phân loại tự động hoặc giá. Mã slug không dấu, trim/lowercase; tên tối đa 150 ký tự. STAFF có sims.view được đọc API danh mục, trang quản trị và mọi ghi dành ADMIN. Các mutation lương/nghỉ/danh mục và audit cùng transaction, audit lỗi rollback.

`sims`: phone string giữ số 0 đầu, unique khi deleted_at IS NULL, carrier/category FK RESTRICT, giá NUMERIC không âm, AVAILABLE/RESERVED/SOLD, visibility riêng, deleted_at/error_confirmed_at, version và timestamps. Mặc định ẩn; CHECK không cho hiển thị khi selling_price <= cost_price. Batch 06 thêm cảnh báo, intent hiển thị, lịch sử và import; chi tiết bên dưới. Schema nền/rollback cũ: [hướng dẫn Batch 05](docs/BATCH_05_MIGRATIONS.md).

## API và thao tác kho — P21 đến P25

Mọi route có prefix `/api/v1`, session bắt buộc. List cần sims.view; tất cả tạo/đọc chi tiết/sửa/import dùng settings.admin như cổng ADMIN-only hiện có. Không cấp thêm quyền cho STAFF; sims.create của STAFF vẫn chờ quy trình được chốt.

| Method / route | Hợp đồng |
|---|---|
| GET /admin/sims | search số, carrierId, categoryId, status, visibility=visible/hidden, priceError=true/false, minPrice/maxPrice, page/pageSize; mặc định 1/20, tối đa 100 |
| POST /admin/sims | phoneNumber, carrierId, categoryId, costPrice/sellingPrice string; stockStatus mặc định AVAILABLE, visibilityRequested mặc định false; 201 hoặc duplicate 409 |
| GET /admin/sims/:id | ADMIN-only, item + history, page/pageSize; mặc định 1/20, tối đa 100 |
| PATCH /admin/sims/:id | version bắt buộc, ít nhất một trường chỉnh sửa từ create input; 200, version/số trùng 409, archived 404 |
| POST /admin/sim-imports/preview | filename, contentBase64, sheetIndex mặc định 0; không mapping → cột/mẫu; có mapping → preview đã validate lưu DB |
| POST /admin/sim-imports/:id/confirm | rows là số dòng được chọn, acceptPriceErrors nếu chọn giá lỗi; 201 kết quả; replay cùng lựa chọn trả lại kết quả, không nhập lần hai |

ADMIN DTO có costPrice; STAFF DTO không có trường này, chỉ trả grossProfit nếu còn profits.view. STAFF thấy cả sellingPrice/grossProfit **có thể suy ra giá gốc bằng phép trừ**; không hứa bí mật toán học. Giá/số ngày/tỷ lệ luôn JSON decimal string. Trạng thái hidden và stock độc lập; danh sách loại bỏ deleted_at khác null. UI có bộ chọn danh mục tìm kiếm/phân trang, lỗi/rỗng/loading và bảng responsive.

Tạo/sửa/import gọi cùng SimPricingService trong transaction: selling<=cost → has_price_error=true, is_visible=false, một open alert/SIM. Khi khắc phục, giải quyết alert và chỉ hiển thị nếu visibility_requested=true, chưa bị xóa. Manual hidden giữ visibility_requested=false; sửa giá không tự bật lại. Cảnh báo tự động không ghi error_confirmed_at và không cấp quyền xóa cho STAFF. Writer phải tiếp tục dùng service này; SQL trực tiếp chỉ có chốt CHECK visibility, không thay workflow backend.

PATCH khóa hàng/so version và chỉ thay trường gửi lên, không áp defaults create. Lịch sử sim_changes append-only và audit before/after cùng transaction. Không sửa hoặc tạo bảng đơn/commission, không có chức năng xóa SIM/Check SIM/trang cảnh báo P26. Integration với snapshot đơn cũ phải kiểm lại khi module đơn tồn tại; hiện chưa thể xác minh thực tế.

Chi tiết file, mapping, giới hạn và retry: [SIM_IMPORT_GUIDE.md](docs/SIM_IMPORT_GUIDE.md). File thực không được seed từ test; local DB giữ trống đến khi Admin nhập dữ liệu thật. Dữ liệu fixture chỉ nằm trong cluster kiểm thử riêng.

Migration 010 thêm visibility_requested/has_price_error/sim_price_alerts; 011 thêm sim_changes; 012 thêm sim_import_batches. Trước migrate chạy backup riêng và dừng writer. Không sửa migrations cũ/reset DB; rollback ứng dụng ưu tiên giữ các bảng bổ sung. Sau khi có dữ liệu, không tự DROP bảng; cần phương án backup/restore đã thử trên môi trường riêng trước rollback destructive. Restore production chưa được kiểm thử.

## Lệnh và kiểm thử

| Lệnh root | Mục đích |
|---|---|
| npm ci | Cài đúng lockfile, dừng tiến trình dev trước khi cài |
| npm run db:generate | Sinh Prisma Client vào source generated bị ignore |
| npm run db:migrate / db:status | Áp migration / kiểm tra migration |
| npm run db:local / db:stop | PostgreSQL native riêng trong .local |
| npm run admin:init / admin:rotate-password | CLI operator, không có credential mặc định |
| npm run dev | Admin/API/watch local |
| npm run build | Prisma generate → shared → API → Next production |
| npm run typecheck / lint | TypeScript cả 3 workspace / ESLint Next+TS |
| npm test | Cluster PostgreSQL test mới, migrations và HTTP/integration/unit tests |
| npm run verify | Build + typecheck + lint + test |
| npm start | Chạy Admin/API từ build, chỉ localhost; cần .env hợp lệ |

`npm test` yêu cầu PostgreSQL binaries trong PG_BIN/PATH (Docker CLI đơn thuần chưa đủ cho test runner native). Script tạo `.local/test-*` mới với password ngẫu nhiên, DB dashboard_test, áp migration rồi test tuần tự; finally dừng cluster. Dữ liệu giả chỉ trong test. Không dùng DATABASE_URL vận hành làm test target. Giữ cluster/log test private để điều tra, không commit .local. Chưa có UI test tự động/TLS deployment test. UI được kiểm tra bằng trình duyệt trong Batch 03.

`node scripts/ui-test.mjs` chạy fixture UI riêng tại 3110/4210 sau build, tạo cluster mới và tài khoản gắn nhãn UI kiểm thử. Credential nằm riêng trong .local/ui-current.json; không commit/chia sẻ. Gõ stop trong terminal để dừng cả Next, API và cluster. Không dùng script này để chạy dữ liệu thật. Khi fixture đang chạy, `node scripts/batch06-ui-api-check.mjs` kiểm tra 28 trường hợp qua Next proxy và chuẩn bị CSV fixture UI. Mỗi lần chạy cần fixture mới. Script cũ Batch 04/05 đã cập nhật assertion inventory hiện tồn tại; Batch 04 tắt một số quyền STAFF nên dùng fixture riêng.

`node scripts/backup-local.mjs` tạo snapshot JSON các bảng Dashboard trong transaction đọc nhất quán, lưu riêng trong .local/backups. Snapshot chứa hash và dữ liệu nhạy cảm cần bảo vệ. Đây là bản sao logic hàng dữ liệu, không thay thế pg_dump/backup vận hành; khôi phục cần migrations tương ứng và kiểm chứng riêng. Runtime embedded hiện có không kèm pg_dump, chưa kiểm thử restore production.

## Cấu trúc và điểm dừng

```text
Dashboard-Sim-Mobi/
├── apps/admin/                 Login, shell, server route guards, bảng nhân viên
├── apps/api/
│   ├── prisma.config.ts
│   ├── prisma/schema.prisma
│   ├── prisma/migrations/      users/auth/audit/permissions/policies/salary/leaves/catalogs/sims
│   ├── src/config.ts, main.ts, create-app.ts, app.module.ts
│   ├── src/database/, users/, cli/, auth/, authorization/, audit/, employees/, commissions/
│   ├── src/salaries/, leaves/, catalogs/, inventory/, imports/, common/
│   ├── src/http-error.filter.ts
│   └── test/
├── packages/shared/            Health, account/permissions, policies/leaves/catalog DTO, exact decimals
├── scripts/                    PostgreSQL local/test
├── .env.example, compose.yaml
├── README.md, BATCH_02_REPORT.md … BATCH_08_REPORT.md, GAP_ANALYSIS.md
├── docs/P01_VERIFICATION.md
└── package.json, package-lock.json, tasks/todo.md
```

Generated Prisma, .next, dist, node_modules, .local và .env không đưa lên Git. Dashboard chưa có Git repository riêng; không tự commit/push. Các mục CHƯA CHỐT trong v1.6 không được tự triển khai. Dừng Batch 08 để nghiệm thu; không thực hiện P36 trở đi.
