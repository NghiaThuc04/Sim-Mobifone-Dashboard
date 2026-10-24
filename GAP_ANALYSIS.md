# P00 — Audit workspace và baseline SIM Management Dashboard

Ngày audit: **23/10/2026, Asia/Saigon**. Phạm vi: chỉ P00. Trạng thái: **audit hoàn tất; Dashboard chưa triển khai; P01 chưa bắt đầu**.

## 1. Tài liệu và phạm vi áp dụng

Nguồn nghiệp vụ chính là **SIM_Dashboard_Master_Spec_v1.6.md**, không dùng nghiệp vụ cũ của storefront để tự bổ sung hoặc thay thế đặc tả.

| Đầu vào đã đọc toàn bộ | Vị trí thực tế | SHA256 |
|---|---|---|
| Master Specification v1.6 | `C:/Users/nghia/Downloads/SIM_Dashboard_Master_Spec_v1.6.md` | `2B7EA72F62CFD10E23043979C89C2B377194B53687743974F672B55D80FC9BA4` |
| P00 — Audit workspace và lập baseline | `C:/Users/nghia/Downloads/P00_audit_workspace_v_l_p_baseline.md` | `2787ACB35942AECF1F101F18C012A16C8319936B8DEF1AF61AE1F53A4C06C1FD` |

Hai file được cung cấp qua đường dẫn Downloads, **chưa có bản cùng tên tại gốc SimMobile-Main**. P00 không tự sao chép hoặc chỉnh sửa đặc tả. Chưa nhận được file P01 hoặc danh mục prompt có ID cho các bước tiếp theo.

Quy ước trong báo cáo:

- **Đã xác minh — source:** đã đối chiếu file hiện có, không đồng nghĩa chức năng chạy đúng hoặc đã đạt v1.6.
- **Đã xác minh — chạy kiểm tra:** chỉ áp dụng cho lệnh/test đã thực sự chạy trong P00.
- **Suy luận/đề xuất:** đánh giá kỹ thuật, chưa phải quyết định của chủ dự án.
- **Chưa xác minh/CHƯA CHỐT:** thiếu kiểm chứng hoặc quy tắc nghiệp vụ. Phần triển khai phụ thuộc được đánh dấu **BLOCKED**, không tự chọn giá trị mặc định.

Không xây Dashboard, schema/migration/API mới; không bật quản trị, tạo tài khoản, nhập kho, tạo giao dịch, deploy hoặc thực hiện P01.

## 2. Kết luận baseline

**Đã xác minh:** `Dashboard-Sim-Mobi` chỉ có `README.md` và `src/.gitkeep` (0 byte). Đây là **module Dashboard mới, chưa có source ứng dụng**, không có entrypoint, package hay lệnh chạy riêng. Thư mục không rỗng tuyệt đối vì có tài liệu/placeholder.

**Đã xác minh:** repo cha `C:/Users/nghia/OneDrive/Desktop/SimMobile-Main` là **dự án hiện hữu**, không phải workspace mới hoàn toàn: đã có storefront React/Vite, Express API, PostgreSQL, hai migration và kiểm thử. Phải bảo toàn hệ thống và dữ liệu này khi phát triển Dashboard sau P00.

**Suy luận:** có thể tái sử dụng một phần hạ tầng TypeScript, validation, database pool, transaction và an toàn HTTP. Chưa thể coi backend hiện tại là backend Dashboard v1.6; mô hình quyền, đơn, kho và tài chính thiếu đáng kể.

## 3. Cấu trúc và môi trường hiện có

```text
SimMobile-Main/
├── Home-Sim-Mobi/          React routes/components, API client, CSS, ảnh
│   ├── main.tsx, index.html
│   ├── ReferenceHome.tsx, ReferenceShell.tsx, Explorer.tsx
│   ├── Details.tsx, Checkout.tsx, Orders.tsx, Help.tsx
│   ├── assets/categories/
│   └── vite.config.ts, tsconfig.json
├── Dashboard-Sim-Mobi/
│   ├── README.md
│   ├── src/.gitkeep
│   └── GAP_ANALYSIS.md     Báo cáo duy nhất được thêm bởi P00
├── server/                app → controllers → services/repository → pg
│   └── migrations/        001_initial.sql, 002_deployment_profiles.sql
├── shared/                contracts.ts (Zod/types), display.ts
├── scripts/               dev, PostgreSQL, migrate, khởi tạo cấu hình
├── tests/                 main-safety.test.ts
├── config/                shop.example.json
├── deploy/                nginx.private.example.conf, init-app.sh
├── docs/                  Báo cáo các công việc trước P00
├── .local/                Dữ liệu local, bản sao, fixture; Git ignore
├── .env                   Cấu hình riêng tư, Git ignore
├── package.json, package-lock.json
├── tsconfig.server.json, Dockerfile, compose.yaml
└── dist/                  Output build, Git ignore
```

### 3.1. Stack đã xác minh

| Thành phần | Hiện có | Quan hệ với v1.6 |
|---|---|---|
| Hệ điều hành/shell | Windows, PowerShell | Không có yêu cầu thay đổi trong P00 |
| Node/npm | Node **24.21.0**, npm **11.19.0**; khớp `.nvmrc` và `packageManager` | Một package/lockfile ở repo cha |
| Frontend | React **19.3.1**, Vite **8.3.5**, TypeScript **5.9.3**, React Router; CSS thuần | Chỉ storefront; chưa có layout Dashboard |
| Backend | Express **5.3.0**, TypeScript, Zod **4.6.7** | Không có NestJS; chưa có auth/RBAC ADMIN–STAFF |
| Database | PostgreSQL runtime **18.4**; driver `pg` **8.23.1** | SQL trực tiếp qua repository; không có Prisma |
| PostgreSQL local/test | `embedded-postgres` **18.4.0-beta.17**, script quản lý cluster riêng | Không phải dịch vụ cloud |
| Import hiện có | CSV/XLSX qua csv-parse, ExcelJS, yauzl | Parser cũ không xác lập quy trình upload STAFF |
| Bảo mật nền | cookie-parser, Helmet, rate limit, CSRF/Origin, scrypt, AES-GCM | Có mã nền; chưa kiểm chứng an toàn Dashboard v1.6 |
| Kiểm thử | Node test runner + tsx + PostgreSQL tạm; Playwright **1.64.1** được cài | Test script hiện chỉ chạy `main-safety.test.ts` |
| Triển khai | Dockerfile, Compose mạng private, nginx mẫu | Docker CLI không có trong PATH phiên audit; chưa chạy Docker |

Next.js/TypeScript + NestJS + PostgreSQL/Prisma trong §1 là **đề xuất**, không bắt buộc. React/Vite + Express hiện có không tự động là vi phạm đặc tả. **CHƯA CHỐT:** giữ stack đang chạy hay chuyển stack; P00 không thay framework/cài dependency.

### 3.2. Lệnh chạy/build/test

Tất cả lệnh chạy tại **gốc SimMobile-Main**, không chạy như một package riêng trong Dashboard-Sim-Mobi.

| Lệnh có trong package.json | Chức năng | P00 đã thực hiện? |
|---|---|---|
| `npm run dev` | Chạy API và Vite qua scripts/dev.mjs | Không khởi động trùng dịch vụ hiện có |
| `npm run dev:web` | Vite dùng Home-Sim-Mobi/vite.config.ts | Không restart; cổng localhost 5180 đang listen |
| `npm run dev:api` | tsx watch server/index.ts | Không restart; cổng localhost 4110 đang listen |
| `npm run main:db` | PostgreSQL local, migration/khởi tạo cấu hình nếu cần | Không chạy lại; cổng localhost 55440 đang listen |
| `npm run main:setup` | Tạo môi trường local khi chưa tồn tại | Không chạy, tránh ghi cấu hình ngoài phạm vi |
| `npm run db:migrate`, `shop:init`, `shop:brand` | Thay đổi DB/schema/cấu hình | Không chạy trên Main trong P00 |
| `npm run typecheck` | TypeScript frontend và backend | Đạt, chạy bên trong build |
| `npm run build` | Typecheck + Vite + tsc server, output dist/web và dist/server | Đạt, chạy bên trong verify |
| `npm test` | 7 test trên PostgreSQL cluster tạm riêng | **7/7 đạt** |
| `npm run verify` | Build rồi test | **Exit 0**, thực thi trong P00 |
| `npm start` | Express từ dist/server/index.js | Có script; không khởi động production trong P00 |
| Lint | Không có script `lint` hoặc cấu hình linter được phát hiện | **Chưa có lint gate**, không báo lint đạt |

Các cổng listen chỉ chứng minh dịch vụ hiện diện, không thay cho kiểm thử UI/API đầy đủ. Không kiểm thử trình duyệt lại trong P00. Không cài lại dependency hoặc chạy `npm ci`.

### 3.3. Git và thay đổi đã tồn tại

- Branch: **main**. HEAD: `8cd83688b4769644e7147a944fa0340643fef67b` — `first commit`.
- Remote origin: `https://github.com/NghiaThuc04/Sim-Mobifone.git`. Không fetch/push/commit trong P00; không xác nhận trạng thái remote mới nhất.
- Trước audit: **49 dòng porcelain**: 13 ` M`, 17 ` D`, 19 `??`. Đây là số dòng status, không phải số file thực tế vì thư mục untracked được gộp.
- Đã có sửa backend/contracts/test/config, thay ảnh/UI và di chuyển `web/` sang `Home-Sim-Mobi/`; các D/untracked không được tự coi là mất dữ liệu hoặc tự reset.
- `Dashboard-Sim-Mobi/` và `Home-Sim-Mobi/` đã untracked trước P00. Vì Dashboard đã untracked, status gộp thư mục có thể không thêm dòng mới khi tạo báo cáo.
- P00 lấy hash baseline **88 file không bị Git ignore** trước khi viết báo cáo, gồm file tracked/untracked hiện có; loại output build, .local, node_modules và tasks. Chỉ bổ sung báo cáo này; không ghi đè các thay đổi trước đó.

## 4. Vị trí cần bảo vệ thông tin bí mật

Chỉ ghi vị trí/mục đích, không đưa giá trị credential, token, password hoặc nội dung DB vào báo cáo.

| Vị trí | Cần bảo vệ | Quan sát |
|---|---|---|
| `.env` ở repo cha | Kết nối DB, khóa mã hóa, cấu hình riêng | File tồn tại; .gitignore/.dockerignore loại trừ |
| `.local/backups/mobifone-brand/.env.before` | Bản sao môi trường riêng tư | Tồn tại; nằm trong .local bị ignore |
| `.local/postgres-main/` | Cluster PostgreSQL, dữ liệu và cấu hình local | Thư mục tồn tại; không sao chép vào source |
| `.local/main-test-*/` | Cluster/artefact kiểm thử tạm | Có các thư mục kiểm thử; không đưa lên Git |
| `.local/backups/`, `.local/releases/`, `.local/retirement-20261023/`, `.local/github-upload-before/` | Bản lưu cũ có thể chứa cấu hình/dữ liệu | Không đọc toàn bộ nội dung, không xóa hoặc công khai |
| `.local/github-access.mjs`, `.local/github-preflight.mjs` và metadata upload | Helper liên quan xác thực GitHub; kiểm tra kỹ trước chia sẻ | Chỉ xác minh tên/vị trí, không trích nội dung hay token |
| Môi trường process/credential store của hệ điều hành | Secret khi chạy dịch vụ | Không dump, chưa audit kho credential hệ điều hành |

`.env.example` và `.env.production.example` là template dùng placeholder. Nginx mẫu tham chiếu file certificate/key bên ngoài repo; **chưa xác minh các file triển khai đó tồn tại**. Không phát hiện các đường dẫn secret được liệt kê trong kết quả `git ls-files` kiểm tra vị trí; đây **không phải** chứng nhận repo/history đã sạch mọi secret.

## 5. Database và API hiện tại

### 5.1. Database đã có, không xây mới

**Đã xác minh — đọc metadata/count bằng truy vấn chỉ đọc trên Main:** PostgreSQL 18.4; profile `main`, demoMode=false, allowOrders=false. Kho SIM=0, gói=0, đơn=0, admin=0. Không đọc dữ liệu liên hệ, password hash hoặc session token.

13 bảng public hiện có: `admins`, `admin_sessions`, `guest_sessions`, `settings`, `plans`, `sim_numbers`, `sim_plans`, `quotes`, `orders`, `idempotency`, `audit_events`, `app_deployment`, `schema_migrations`.

Migration SQL dùng checksum trong `scripts/migration-lib.ts`. Không sửa migration cũ, không áp migration mới trên Main trong P00. Kiểm thử hiện có tự tạo/áp schema trên **cluster test riêng** rồi dừng cluster; đó là chạy baseline test, không xây schema Dashboard.

### 5.2. API và nghiệp vụ cũ — cần phân biệt với Dashboard mới

- `server/app.ts` mở `/api/v1/config`, `/session`, `/sims`, `/sims/suggestion`, `/sims/:id`, `/plans`, `/quotes`, `/orders`, `/orders/:id`; payment integration trả chưa cấu hình.
- Các route `/admin/login`, `/admin/sims`, import/export, plans/orders/settings cũ chỉ được mount khi `config.profile === 'demo'`. Main không có admin endpoint; test hiện tại yêu cầu chúng trả 404.
- `req.admin` ở Main luôn không được nạp từ session. Middleware auth cũ chỉ kiểm tra có admin, không có role ADMIN/STAFF hay quyền theo nhân viên.
- Repository có DTO, SQL tham số, transaction/row lock/advisory lock; có unique index một đơn PENDING trên mỗi SIM và idempotency theo owner. Đây chưa phải khóa nhận đơn giữa hai STAFF.
- Parser CSV/XLSX và hàm quản trị cũ vẫn có trong source backend; **không có nghĩa Dashboard đã được khôi phục hoặc được phép dùng quy trình cũ cho STAFF**.

## 6. Bảng đối chiếu đặc tả → chức năng

Trạng thái đánh giá theo mục tiêu **Dashboard v1.6**. “Có một phần” chỉ xác nhận nền tảng source, không nghiệm thu hành vi mới.

| Đặc tả | Yêu cầu chính | Hiện trạng có bằng chứng | Gap / trạng thái |
|---|---|---|---|
| §1 | Dashboard riêng, backend/nguồn dữ liệu chung với storefront sau này | Có folder tách riêng, server/shared ở repo cha; Dashboard chưa có app | **Có một phần**; cần quyết định stack và ranh giới tích hợp |
| §2 | 10 mục menu, routes admin, responsive/loading/empty/error | Home-Sim-Mobi chỉ có route khách hàng; Dashboard chỉ placeholder | **Thiếu toàn bộ UI Dashboard**; route mới chưa khóa |
| §2, §8–9 | KPI/tháng, mặc định tháng hiện tại/mới nhất | Chưa có KPI, báo cáo hoặc bộ lọc kỳ Dashboard | **Thiếu**; mặc định kỳ cụ thể cần làm rõ |
| §3 | ADMIN/STAFF và quyền chi tiết ở backend | Chỉ bảng admins và auth legacy, không users/role/permissions | **Thiếu RBAC**, không dùng auth cũ như đã đáp ứng |
| §3 | STAFF xem lợi nhuận nhưng API ẩn cost_price | Chưa có giá vốn hoặc gross profit | **Thiếu** DTO theo quyền và test chống lộ trường |
| §4 | Nhận trước khóa trước, chỉ người giữ xử lý; ADMIN mở/chuyển | Đơn không có assigned_staff_id/claimed_at/history | **Thiếu** claim/assign/ownership/concurrency test STAFF |
| §4 | Luồng đơn đến COMPLETED, approval tách trạng thái | Cũ: PENDING/CONFIRMED/CANCELLED/EXPIRED; confirm làm SOLD | **Lệch mô hình**, thiếu PROCESSING/COMPLETED và approval |
| §4 | Chống giữ một SIM cho hai đơn | Có transaction, row lock, unique pending SIM, idempotency | **Có nền tảng**; chưa kiểm chứng đồng thời theo v1.6 |
| §5.1 | phone_number unique trong kho hoạt động; cost/selling NUMERIC, visibility/error/history | sim_numbers.msisdn unique toàn bảng; một price integer; sale_state AVAILABLE/SOLD/WITHDRAWN, HELD suy từ order | **Lệch schema**, thiếu giá vốn/NUMERIC/RESERVED/visibility; không tự đổi schema |
| §5.1, §15 | STAFF đăng SIM mới theo quy trình được chốt | Parser cũ có trường price/isDemo/planCodes, chỉ route legacy Demo | **BLOCKED** mẫu upload, quyền nhập giá và duyệt chưa chốt |
| §5.2 | Giá bán ≤ vốn → ẩn + cảnh báo; sửa hợp lệ có thể hiện lại | Không có cost_price, alert, lý do ẩn hoặc điều kiện này trong public query | **Thiếu**; gợi ý ngẫu nhiên hiện cũng chưa có điều kiện lỗi giá |
| §5.3 | Check SIM và xóa theo quyền, ADMIN mọi trạng thái | Không có route Check SIM/DELETE; setStock cũ chặn HELD/SOLD | **Thiếu**; không thay xóa bằng WITHDRAWN hoặc bỏ chặn bừa |
| §5.3 | Xóa giữ snapshot/sổ sách, không phá lịch sử | Có JSON snapshot và FK từ order/quote tới SIM; chưa có cơ chế removal | **Có một phần**; lựa chọn xóa logic/vật lý **BLOCKED** |
| §6 | ADMIN/STAFF soạn, upload, preview, publish; public Tin tức | Không có tables/routes/editor/media/articles public | **Thiếu**; quyền bài người khác và kiểm duyệt cần làm rõ |
| §7 | % theo STAFF, snapshot lúc COMPLETED, duyệt một lần | Không có commission policy/record/approved profit | **Thiếu**; người hưởng sau chuyển đơn và giới hạn duyệt **BLOCKED** |
| §8 | Gộp, hoa hồng, phí, ship cửa hàng chịu, chi phí, ròng tháng | Chỉ shippingFee báo giá, total đơn; chưa có sổ phí/tài chính | **Thiếu**; phí tính cho khách không đồng nghĩa chi phí cửa hàng |
| §8 | Đối soát khác kỳ, không trừ trùng, hoàn/hủy sau duyệt | Không có ledger/đóng sổ/hoàn hoặc liên kết phí kỳ | **BLOCKED** quy tắc kỳ, hoàn và ship chưa chốt |
| §9 | Tài khoản, quyền, hoa hồng, lương, nghỉ, bảng lương self | Chưa có employee/salary/leave/payroll | **Thiếu**; không tự trừ lương/ngầm cộng tiền công |
| §10 | Các nhóm bảng/constraints cho Dashboard | 13 bảng cũ nêu trên, chưa có ước lượng mapping được phê duyệt | **Thiếu schema đích**, bảng trong spec là đề xuất |
| §11 | Auth/claim/assign/approval/employees/articles/finance/settings API | Có prefix và envelope API cũ; Main chặn admin | **Thiếu API v1.6**, phải khóa contract trước code |
| §12 | Đồng bộ kho/đơn/Tin tức qua backend chung sau Dashboard | Có storefront lấy API và số ngẫu nhiên từ kho trống | **Giai đoạn sau**; giữ tương thích, không nghiên cứu REA mới trong P00 |
| §13 | 15 nhóm test nghiệp vụ Dashboard | 7 test baseline bảo vệ Main; không có test STAFF/finance/payroll/articles | **Chưa nghiệm thu** bất kỳ luồng Dashboard nào |
| §14 | Core → kho/check → đơn → nhân viên/hoa hồng → bài/tài chính → vận hành | Dashboard chưa bắt đầu; có storefront từ giai đoạn cũ | Dùng trình tự v1.6 cho công việc mới; không xóa storefront |

## 7. Những phần đã thống nhất trong v1.6

Các mục dưới là **yêu cầu đã chốt**, không phải tuyên bố đã triển khai:

1. Dashboard triển khai riêng tư trước; storefront/REA là giai đoạn sau. Không dùng API nội bộ hoặc dữ liệu riêng tư MobiFone, không demo trong báo cáo thật.
2. Hai nhóm ADMIN/STAFF; enforce quyền ở backend. ADMIN quản trị nhân viên/tài chính/cài đặt; STAFF chỉ xem lương/nghỉ của mình.
3. Nhân viên thấy đơn nhưng chỉ người nhận được xử lý; ADMIN có quyền mở/chuyển và phải có audit. Nhận đơn và giữ SIM phải nguyên tử/chống trùng.
4. STAFF xem kho/giá bán/lợi nhuận nhưng API không trả trường giá vốn. Đặc tả đã chấp nhận hạn chế: có thể suy ra vốn từ giá bán và lợi nhuận.
5. STAFF được tạo SIM mới nhưng chưa có quy trình chi tiết; STAFF không được sửa giá SIM đã có. ADMIN sửa giá kho.
6. selling_price ≤ cost_price phải ẩn khỏi storefront và sinh cảnh báo. Cảnh báo tự động **không** đồng nghĩa SIM lỗi đã xác nhận đủ điều kiện STAFF xóa.
7. ADMIN được xóa SIM bất kể trạng thái; STAFF chỉ xóa khi hoàn thành bán hoặc lỗi đã xác nhận. Lịch sử đơn/tài chính không được mất vì xóa SIM.
8. ADMIN và STAFF được viết/đăng bài; PUBLISHED đưa ra Tin tức. Trạng thái DRAFT/PUBLISHED/UNPUBLISHED, có validate upload, chống XSS, audit. Hiện yêu cầu cho STAFF đăng trực tiếp; không tự thêm bước duyệt bắt buộc.
9. Hoa hồng = lợi nhuận gộp được ADMIN duyệt × % hiệu lực **khi đơn hoàn thành**; chốt snapshot, không tính lại đơn cũ khi thay tỷ lệ. Approval và payment là hai trạng thái khác nhau.
10. Gộp = giá bán thực tế − vốn snapshot. Còn lại đơn = gộp − hoa hồng − phí giao dịch − ship cửa hàng chịu. Tổng hợp tháng còn trừ lương/tiền công được tính kỳ và phát sinh; không trừ trùng.
11. Bảng lương tháng = lương cứng + tổng hoa hồng từng đơn đã duyệt, trước điều chỉnh được chốt; không dùng tỷ lệ hiện hành nhân tổng lợi nhuận tháng.
12. Theo dõi nghỉ theo tháng; **không tự trừ lương vì nghỉ**. Không mặc nhiên cộng tiền công bổ sung từ v1.5 vào công thức v1.6.
13. KPI/danh sách có lọc kỳ, loading/empty/error và responsive; dữ liệu tài chính đã duyệt không hồi tố theo giá hiện tại.
14. Kiến trúc framework, tên bảng và route ghi “đề xuất” phải được quyết định/khóa trước triển khai, không tự coi đã cố định.

## 8. Chưa chốt, blocker và câu hỏi cần giải quyết

Các blocker dưới áp dụng **cho phần triển khai tương ứng**, không ngăn hoàn tất báo cáo P00. Chưa tự gán câu trả lời hoặc thực hiện thay đổi. Quyết định nghiệp vụ bổ sung phải được ghi thành phiên bản đặc tả mới theo nguyên tắc §15.

| ID audit | Cần quyết định | Phần bị BLOCKED |
|---|---|---|
| Q01 | Giữ React/Vite + Express + pg hay chọn Next/Nest/Prisma? Backend dùng chung hiện tại sẽ mở rộng theo ranh giới nào để giữ storefront? | Kiến trúc/khởi tạo Dashboard khi prompt tiếp theo yêu cầu |
| Q02 | Mẫu STAFF đăng SIM, thêm từng số hay file, cột nhập, quyền nhập giá, có duyệt trước vào kho không? | Form/import STAFF; parser cũ chưa phải câu trả lời |
| Q03 | Ai xác nhận SIM lỗi, bằng chứng/điều kiện gì, ai có quyền thay/hủy xác nhận? | Error confirmation và quyền xóa STAFF |
| Q04 | “SIM hoàn thành” chính xác theo SOLD hay đơn COMPLETED? Cách xử lý trạng thái cũ CONFIRMED/EXPIRED và thời hạn giữ SIM mới? | State mapping, điều kiện xóa STAFF, reservation |
| Q05 | Xóa logic hay vật lý? Với ADMIN xóa SIM đang giữ/bán, đơn/reservation liên quan được xử lý thế nào mà không phá sổ sách? Số đã xóa có được đưa lại kho hoạt động? | Removal/schema/constraint; không tự thêm rào cản trạng thái cho ADMIN |
| Q06 | ADMIN chuyển NV1 sang NV2 thì ai hưởng hoa hồng? Dùng tiêu chí hoàn thành/người xử lý nào đã được duyệt? | Commission ownership khi reassign |
| Q07 | STAFF sửa/xóa bài đồng nghiệp hay chỉ bài mình? Có thay quyết định đăng trực tiếp bằng duyệt trước không? | Article ownership/delete; đăng trực tiếp vẫn là yêu cầu hiện tại |
| Q08 | Nghỉ chỉ thống kê hay ảnh hưởng lương? Tiền công bổ sung có phải khoản chi thêm? | Các điều chỉnh lương mới; mặc định hiện tại vẫn không tự trừ/cộng |
| Q09 | Đơn hoàn thành tháng A, duyệt hoa hồng tháng B ghi kỳ nào? Đóng/mở sổ, hoàn/hủy sau duyệt/đã trả xử lý sao? | Monthly close, reversal, payroll cross-period |
| Q10 | Khách trả một phần/toàn bộ ship thì phần chi phí cửa hàng chịu tính/ghi nhận thế nào? | Net profit và đối soát ship |
| Q11 | ADMIN có thể duyệt lợi nhuận khác snapshot trong giới hạn nào? Có bắt buộc lý do/chứng từ không? | Profit approval validation/audit |
| Q12 | “Tháng hiện tại/mới nhất” chọn chính xác thế nào khi tháng hiện tại trống? Múi giờ nghiệp vụ, làm tròn %/NUMERIC, precision/scale tiền và tỷ lệ? | Bộ lọc mặc định và tính toán tiền; spec chưa định nghĩa chi tiết |
| Q13 | Chốt bảng chuyển trạng thái hợp lệ, quyền sửa sau COMPLETED, contract API/routes và ánh xạ schema hiện hữu → schema mới ở prompt nào? | Implement schema/API; không tự chuyển mô hình cũ |
| Q14 | Cần file P01 và danh mục prompt/ID, phạm vi cùng prerequisites thực tế | Chưa thể lập mapping chính xác mọi công việc vào ID prompt tiếp theo |

Q12–Q13 là **câu hỏi kỹ thuật/chi tiết phát hiện khi audit**, không phải nghiệp vụ mới tự đưa vào đặc tả. Chỉ giải quyết khi cần cho nhiệm vụ được giao tiếp theo.

## 9. Mâu thuẫn và điểm phải xử lý trước khi tích hợp

| Điểm lệch | Bằng chứng | Hệ quả/đề xuất — chưa thực hiện |
|---|---|---|
| Main chủ động không mở admin trong khi Dashboard cần auth API | `server/app.ts:89,126`; test `main has no admin endpoints...` | Thiết kế auth/route Dashboard được phép mới; không bật Demo để lách test; sau này cập nhật baseline test theo contract đã chốt |
| CONFIRMED cũ lập tức chuyển SIM SOLD | `server/services.ts:235`; `shared/contracts.ts:138` | Cần mapping sang PROCESSING/COMPLETED và thời điểm snapshot mới, không tự coi CONFIRMED=COMPLETED |
| price integer và unique số toàn bảng khác NUMERIC/cost-selling/kho hoạt động | `server/migrations/001_initial.sql:7` | Migration bổ sung và quy tắc reuse số cần quyết định, không sửa checksum migration cũ |
| setStock/saveSim legacy chặn HELD/SOLD, không có xóa | `server/services.ts:155,173`; không DELETE ở app | Không dùng WITHDRAWN thay nghiệp vụ ADMIN xóa mọi trạng thái; cần thiết kế theo §5.3 khi đến lượt |
| Snapshot hiện có không có vốn/approved profit/commission snapshot | `server/services.ts:39`; `orders.snapshot`, `quotes.snapshot` trong SQL | Chưa đủ bảo toàn tài chính v1.6 dù đã có JSON snapshot |
| Bản frontend khách hàng đã tồn tại trước đặc tả Dashboard-first | `Home-Sim-Mobi/main.tsx`; lịch sử repo | Bảo toàn storefront, tạm dừng mở rộng tích hợp; công việc mới theo v1.6 |
| Routes và tables trong spec là đề xuất | v1.6 §2, §10, §11 | Không tự scaffold tất cả hoặc tuyên bố mapping đã chốt |

## 10. Bằng chứng kiểm tra và giới hạn

### 10.1. Lệnh đã chạy trong P00

| Kiểm tra | Kết quả thực tế |
|---|---|
| Đọc 2 đầu vào, SHA256 | Đã đọc đầy đủ; hash ở §1 |
| `rg --files`, đọc package/config/source/migrations/tests, inventory Dashboard | Xác nhận Dashboard chưa có app và repo cha có kiến trúc hiện hữu |
| `node --version`, `npm --version`, kiểm tra package metadata | Phiên bản tại §3.1 |
| Git branch/log/remote/status | Baseline dirty tại §3.3, không thay đổi Git state |
| PostgreSQL metadata/count trong transaction chỉ đọc | Profile Main, PostgreSQL 18.4, 13 bảng, 4 nhóm dữ liệu đếm đều 0 |
| `npm run verify` | **Exit 0**: typecheck/build đạt, **7 pass, 0 fail**, tổng test khoảng 63,2 giây |
| Cảnh báo build | JS entry khoảng **512,44 kB**, vượt ngưỡng 500kB; build vẫn đạt. Không tối ưu bundle trong P00 |
| Lint | Chưa có script; không tự thêm linter |
| Docker | Không có Docker CLI trong PATH; chưa build/run container hoặc xác minh triển khai |
| Trình duyệt/responsive Dashboard | Không thực hiện: chưa có Dashboard. Không dùng ảnh/storefront cũ làm bằng chứng Dashboard |
| `git diff --check` và so sánh hash sau báo cáo | **Đạt**; 88 file baseline không đổi/không mất, tổng 89 file sau audit, file thêm duy nhất là báo cáo này; không có trailing whitespace trong báo cáo |

Trong bước tra phiên bản, `require('embedded-postgres/package.json')` gặp `ERR_PACKAGE_PATH_NOT_EXPORTED` do package exports; đã đọc trực tiếp metadata cài tại `node_modules/embedded-postgres/package.json` và xác minh version. Đây là lỗi câu lệnh audit đã xử lý, không phải lỗi build hay blocker ứng dụng. Một lượt `rg` không có file P01/Next/Nest/linter khớp trả exit 1 theo nghĩa “không tìm thấy”, không phải test thất bại.

### 10.2. 7 test đạt chứng minh điều gì

`tests/main-safety.test.ts` xác minh: Main bắt đầu trống/khởi tạo idempotent; đổi brand bảo toàn cấu hình; không mở admin endpoint trên Main; DB chặn demo rows; profile DB bất biến; từ chối cấu hình trộn profile; gợi ý số bỏ số không khả dụng và tránh lặp liên tiếp. Test dùng cluster `.local/main-test-*` riêng, không nhập fixture vào Main.

**Chưa được kiểm chứng bởi 7 test này:** toàn bộ 15 nhóm chấp nhận Dashboard ở v1.6 §13, gồm hai STAFF tranh nhận đơn, quyền owner/self, ẩn giá vốn, xóa bảo toàn sổ sách, cảnh báo giá, bài published, snapshot/duyệt hoa hồng idempotent, phí/lương và đối soát kỳ. Không báo các chức năng này “xong”.

### 10.3. Nguồn source cho người review

| Mã bằng chứng | File | Nội dung |
|---|---|---|
| E01 | [Dashboard README](README.md), [src placeholder](src/.gitkeep) | Chưa có ứng dụng Dashboard |
| E02 | [package.json](../package.json), [frontend Vite](../Home-Sim-Mobi/vite.config.ts), [dev script](../scripts/dev.mjs) | Stack và lệnh chạy |
| E03 | [app.ts](../server/app.ts) — dòng 89,113,126 | Main/public route và nhánh quản trị Demo |
| E04 | [services.ts](../server/services.ts) — dòng 74,155,173,235 | Transaction đơn cũ, giới hạn sửa kho, confirm → SOLD |
| E05 | [repository.ts](../server/repository.ts) — dòng 91,190,266,285,348,392 | HELD suy từ đơn, gợi ý, lock, admin session và audit |
| E06 | [migration 001](../server/migrations/001_initial.sql), [002](../server/migrations/002_deployment_profiles.sql) | Schema, index, constraint profile |
| E07 | [contracts.ts](../shared/contracts.ts) | price/schema và trạng thái cũ |
| E08 | [db.ts](../server/db.ts), [security.ts](../server/security.ts), [migration runner](../scripts/migration-lib.ts) | Pool/transaction, hash/encryption, checksum migration |
| E09 | [main-safety.test.ts](../tests/main-safety.test.ts) — dòng 31,71,92,105,125,158,164,185 | Cluster test và phạm vi 7 test đã chạy |
| E10 | [storefront routes](../Home-Sim-Mobi/main.tsx), [importer](../server/importer.ts) | UI khách hàng và parser cũ, không phải Dashboard v1.6 |

## 11. Thứ tự công việc đề xuất và ranh giới ID prompt

**Đây chỉ là thứ tự để review**, không phải chạy prompt tiếp theo hoặc chốt thiết kế. Không có danh mục ID nên không tự gán P02/P03… cho các module.

| Thứ tự/ID xác minh được | Nội dung theo đầu vào | Trạng thái |
|---|---|---|
| **P00** | Audit, baseline và GAP_ANALYSIS.md này | **DONE trong phạm vi audit** |
| **P01** — chủ dự án mới nhắc tên, chưa cung cấp file | Cần nhận nội dung prompt, đối chiếu prerequisites và chốt các quyết định mà prompt đó thực sự phụ thuộc | **NOT STARTED**; chưa giả định P01 là scaffold/schema/auth |
| Chưa biết ID — v1.6 §14.1 | Core: dự án, auth, quyền, layout, DB, audit | Chờ mapping prompt và quyết định kỹ thuật |
| Chưa biết ID — §14.2 | Kho SIM/Check SIM/cảnh báo/xóa; upload STAFF theo quyết định bổ sung | Chờ phần phụ thuộc Q02–Q05 |
| Chưa biết ID — §14.3 | Đơn hàng, claim/assign/status và chống tranh chấp | Chờ state/hold/ownership contract |
| Chưa biết ID — §14.4 | Nhân viên, chính sách %, duyệt hoa hồng, lương/nghỉ | Chờ Q06/Q08/Q09/Q11 |
| Chưa biết ID — §14.5 | Bài viết, phí, phát sinh, KPI và báo cáo tháng | Chờ Q07/Q09/Q10/Q12 |
| Chưa biết ID — §14.6 | Test đầy đủ, vận hành/backup/triển khai riêng tư; storefront sau | Chưa thực hiện, không deploy công khai |

## 12. Kết thúc P00 và điều kiện chuyển bước

- **File tạo mới duy nhất:** `Dashboard-Sim-Mobi/GAP_ANALYSIS.md`. Không chỉnh README/tasks/source/migrations/config trong P00; không reset, stage, commit hay push thay đổi cũ.
- Build ghi lại output bị ignore trong `dist/`; test tạo artefact cluster riêng dưới `.local/` như workflow sẵn có, không phải file chức năng mới. Main được kiểm tra bằng truy vấn chỉ đọc.
- Báo cáo đã có baseline môi trường, trạng thái Git, vị trí secret, bảng đối chiếu từng nhóm đặc tả, quyết định đã thống nhất/chưa chốt, blocker và giới hạn kiểm chứng.
- **Không có blocker để hoàn tất P00.** Dashboard chưa được xây dựng và không được coi đã đáp ứng v1.6. Những blocker nghiệp vụ trong §8 vẫn mở.
- Chỉ chuyển bước sau khi **chủ dự án review P00 và yêu cầu P01**, cung cấp prompt P01/danh mục ID cần thiết; giải quyết đúng các quyết định mà P01 phụ thuộc. Không cần đoán hoặc giải quyết toàn bộ module trong P00.

**DỪNG SAU P00. Không thực hiện P01 hoặc module tiếp theo.**
