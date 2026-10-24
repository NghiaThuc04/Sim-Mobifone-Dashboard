# BATCH 06 — P21 đến P25

Ngày kiểm chứng: **24/10/2026**, Asia/Ho_Chi_Minh. Workspace: `C:/Users/nghia/OneDrive/Desktop/SimMobile/Dashboard-Sim-Mobi`.

Đã triển khai và kiểm thử chức năng P21–P25. **Nghiệm thu toàn bộ tình huống còn hai kiểm thử BLOCKED**: UI mất kết nối và tích hợp snapshot đơn cũ, mô tả tại mục 7. Không tuyên bố hai phần đó đã đạt.

## 1. Baseline và kết quả từng prompt

Đã đọc Master Spec v1.6, yêu cầu batch, PROMPT_INDEX.csv, đúng năm prompt theo tên chức năng, source/schema/migrations và báo cáo trước. Không dùng các file trùng số khác. Baseline P01–P20 chạy lại **81/81 pass** trước gate P21. Giữ Next.js/NestJS/Prisma/PostgreSQL hiện có; không agent phụ hoặc thực hiện song song các prompt phụ thuộc.

| Prompt | Trạng thái triển khai | Gate đã chạy trước bước tiếp theo | Giới hạn kiểm chứng |
|---|---|---|---|
| P21 | DONE | Full verify exit 0, **84/84** | Chưa có storefront; public list/direct ID vẫn 404, không tuyên bố đã tích hợp website bán SIM |
| P22 | DONE | Full verify exit 0, **86/86** | Kiểm thử UI mất kết nối: **BLOCKED**, không phải PASS |
| P23 | DONE | Full verify exit 0, **89/89** | Chỉ ADMIN tạo; STAFF upload chưa chốt, không triển khai |
| P24 | DONE phần API/UI hiện có | Full verify exit 0, **93/93** | Tích hợp snapshot đơn/hoa hồng cũ: **BLOCKED** vì chưa có module/bảng đơn |
| P25 | DONE | Full verify exit 0, **98/98** | Chưa kiểm thử tải production/500 dòng đồng thời; không coi giới hạn cấu hình là benchmark |

Sau `npm ci`, chạy lại `npm run verify`: **98 pass, 0 fail, 0 skip**, build/typecheck/lint đạt; test runner khoảng **90.7 giây**. Không chạy P26 trở đi. Không sửa Home, không dùng API/dữ liệu nội bộ MobiFone, không deploy công khai hoặc tạo đơn/giao dịch thật.

## 2. Chức năng đã hoạt động thực tế

**P21 — Giá lỗi:** backend SimPricingService được gọi cùng transaction trong tạo/sửa/import. Selling ≤ cost → has_price_error=true, is_visible=false, một open alert/SIM với snapshot hai giá, lý do và thời điểm. Sửa giá hợp lệ giải quyết alert. Ý định hiển thị `visibility_requested` tách khỏi hiển thị hiệu lực: manual hidden hoặc deleted vẫn ẩn; không tự ghi error_confirmed_at hay cấp điều kiện xóa cho STAFF. Không xây trang cảnh báo P26. CHECK giá từ P20 tiếp tục chặn visible sai ngay tại DB; SQL ngoài ứng dụng không thay thế workflow service/audit.

**P22 — Kho:** GET list hoạt động, tìm substring số, lọc nhà mạng/danh mục/tồn kho/hiển thị/lỗi giá/khoảng giá và phân trang. Loại SIM deleted_at khác null khỏi kho hoạt động. DTO explicit: ADMIN có costPrice, STAFF không nhận trường đó; grossProfit chỉ trả nếu còn profits.view. Quyền sims.view bị thu hồi áp dụng trên phiên hiện tại. UI có danh mục tìm kiếm/phân trang, loading/rỗng/lỗi và bảng cuộn trong khung.

**Lưu ý theo v1.6:** khi STAFF thấy sellingPrice và grossProfit, họ vẫn có thể suy ra giá gốc bằng phép trừ. Không tuyên bố bí mật toán học; yêu cầu được thực hiện ở mức không trả trường costPrice.

**P23 — Tạo:** ADMIN form số/nhà mạng/loại/giá/tồn kho/ý định hiển thị; validate server và lỗi từng trường. Phone giữ 0 đầu, duplicate active trả 409 kể cả cạnh tranh, catalog FK/key-share lock, exact decimal không âm. Tạo SIM + kiểm giá + audit atomic, lỗi audit rollback. Không seed dữ liệu vận hành.

**P24 — Sửa:** ADMIN đọc chi tiết, PATCH có version bắt buộc, khóa hàng và từ chối version cũ 409. Chỉ các trường gửi lên được sửa; defaults create không được áp cho field bỏ qua. Lưu sim_changes trước/sau và Audit Log trong cùng transaction; lịch sử append-only. Giá lỗi được ẩn/cảnh báo, khắc phục giải quyết alert nhưng tôn trọng manual hidden. Không có thao tác ghi bảng order/commission trong workflow; chưa thể kiểm chứng integration với module chưa tồn tại.

**P25 — Import:** upload JSON base64 nội bộ → chọn sheet/mapping → preview theo dòng → chọn dòng hợp lệ → xác nhận. Không lấy lại dữ liệu giá/SIM từ client khi confirm; dùng preview của đúng Admin đã lưu DB. Giá lỗi cần checkbox xác nhận rõ, luôn ẩn và sinh cảnh báo. Duplicate trong file/DB, catalog, định dạng/giá được kiểm; duplicate xuất hiện sau preview trả lỗi theo dòng. Transaction SIM/alert/audit/result, confirm đồng thời hoặc replay cùng lựa chọn không tạo trùng; lựa chọn khác 409. Lỗi hạ tầng/audit rollback cả batch, không báo thành công một phần giả.

Giới hạn: 512 KiB/file, 500 dòng dữ liệu, 30 cột, 1.000 ký tự/ô; XLSX tối đa 10 sheet/200 ZIP entry/10 MiB sau giải nén. Đếm byte thực khi giải nén trước ExcelJS. Excel phone phải Text; không tự thêm số 0 bị mất. Công thức/kiểu ô không hỗ trợ bị từ chối; NUL đánh dấu ô không hợp lệ trước JSONB. Preview 30 phút, tối đa 5 chưa xác nhận/Admin; chỉ dọn preview tạm hết hạn của chính Admin khi tạo mới. Chi tiết: [SIM_IMPORT_GUIDE.md](docs/SIM_IMPORT_GUIDE.md).

## 3. API đã hoàn thành

Prefix `/api/v1`. Session bắt buộc; anonymous 401, thiếu quyền 403. Mutation cần Origin đúng và JSON. Dùng quyền settings.admin hiện có làm cổng ADMIN-only cho quản trị SIM, không cấp quyền mới cho STAFF.

| Method | Route | Hợp đồng |
|---|---|---|
| GET | /admin/sims | sims.view; search/carrierId/categoryId/status/visibility/priceError/minPrice/maxPrice/page/pageSize; mặc định 1/20, tối đa 100 |
| POST | /admin/sims | ADMIN; phoneNumber/carrierId/categoryId/costPrice/sellingPrice, stockStatus/visibilityRequested tùy chọn; 201, trùng 409 |
| GET | /admin/sims/:id | ADMIN; item + lịch sử page/pageSize, mặc định 1/20 |
| PATCH | /admin/sims/:id | ADMIN; version + field sửa; xung đột 409, archived 404 |
| POST | /admin/sim-imports/preview | ADMIN; filename/contentBase64/sheetIndex/mapping tùy chọn; trả cột mẫu hoặc preview có ID, 201 |
| POST | /admin/sim-imports/:id/confirm | ADMIN sở hữu preview; rows/acceptPriceErrors; 201 result, 410 hết hạn, 409 replay lựa chọn khác |

Giá JSON decimal string NUMERIC(65,30); không dùng float tính gross profit. Proxy allowlist chính xác, không proxy tùy ý. Body thường 8 KiB; chỉ preview cho 704 KiB JSON và confirm 16 KiB, timeout import riêng. Không nới giới hạn login. Không có public SIM, delete SIM, Check SIM hoặc API trang cảnh báo P26.

## 4. Database migrations và bảo toàn dữ liệu

| Migration | Nội dung |
|---|---|
| 202610240010_sim_price_alerts | visibility_requested/has_price_error, sim_price_alerts, unique open alert/SIM; khởi tạo intent từ is_visible và flag/alert cho giá lỗi hiện có |
| 202610240011_sim_changes | before/after JSONB, actor/time, FK và append-only triggers |
| 202610240012_sim_imports | preview payload, owner, expiry, selection hash/result để confirm một lần |

Đã migrate trên cluster test mới và DB local Dashboard sau snapshot riêng tư. `db:status`: **12 migrations, schema up to date**. Không chỉnh migration 001–009, không reset hoặc db push.

Đối chiếu digest/columns cũ của 12 bảng trước/sau migration và sau restart: **giữ nguyên toàn bộ dữ liệu cũ**. Local có 1 ADMIN; mọi bảng dữ liệu nghiệp vụ cũ và ba bảng mới đều 0 rows. Không tạo staff/catalog/SIM/import mẫu trong local vận hành. `.local/backups` chứa snapshot riêng tư trước/sau; đã mở rộng backup whitelist cho ba bảng mới, không đưa dữ liệu đó vào báo cáo.

Rollback ưu tiên rollback ứng dụng và giữ bảng bổ sung. Không tự DROP bảng/cột hoặc sửa `_prisma_migrations`; nếu đã có dữ liệu, cần backup/restore được thử riêng trước migration đảo được review. Snapshot JSON không thay pg_dump. Restore production/destructive rollback **chưa kiểm thử**.

## 5. Kiểm thử và bằng chứng

| Kiểm tra | Kết quả thực tế |
|---|---|
| Baseline npm test | 81/81 |
| Gates P21 → P25 | 84 → 86 → 89 → 93 → 98 pass; full verify exit 0 mỗi gate cuối |
| npm ci | Exit 0, cài lockfile; warning allowScripts Prisma không chặn db:generate/build |
| Final npm run verify sau npm ci | Build/shared/API/Next + typecheck + lint PASS; **98/98**, 0 skipped |
| node scripts/batch06-ui-api-check.mjs | **28/28** qua Next production 3110/API 4210, DB UI test riêng |
| npm audit --omit=dev | **0** info/low/moderate/high/critical tại thời điểm kiểm tra |
| Dependency compatibility | Multer 2.5.0/uuid 11.1.1 overrides đã cài; CJS uuid.v4 chạy, ExcelJS read/write XLSX và toàn suite chạy |
| Local migration/digest | 010–012 applied, 12 migrations current, dữ liệu cũ không đổi và kho local rỗng |
| npm run dev | Next 3100/API 4200 chạy lại, health/db health 200; anonymous me 401, admin/dashboard 307 về login, login 200 |
| Cleanup test runtime | 3110/4210 đã dừng; không có deploy public |

17 test mới gồm pricing 3, list 2, create 3, edit 4, import 5. Các test cũ được giữ; chỉ sửa assertion “SIM endpoint còn 404” khi endpoint chính thức xuất hiện. Không tắt test để đạt gate.

Bao phủ equality/below/above cost; 100000−70000=30000; manual/deleted hidden; unique active/leading zero; STAFF projection/rights/revocation; filter/paging/rỗng/input; race/version; before/after immutable; audit rollback; CSV mixed/duplicate/selection/replay đồng thời; XLSX Text/numeric/formula; expiry/owner; expansion bomb và NUL. Test và fixture đều dùng DB riêng, không DATABASE_URL vận hành.

**UI đã quan sát:**

- ADMIN tạo số 0006655001, cost=price=70000 → thông báo ẩn/cảnh báo và bảng hiển thị lỗi giá.
- Sửa giá lên 100000 → hợp lệ/hiển thị lại theo intent, lịch sử trước 70000/sau 100000, flag true→false.
- Upload CSV fixture, mapping 5 cột; dòng âm bị disable. Chọn hai dòng, nút confirm vẫn disable tới khi chấp nhận dòng giá lỗi. Kết quả 2 thành công/1 lỗi/0 bỏ qua; list cập nhật.
- STAFF chỉ có list/filter, không cột cost hoặc nút tạo/import/link sửa; mở URL sửa trực tiếp → forbidden. API STAFF create/patch/import đều 403.
- Tìm số không có → empty state. Desktop 1440, tablet 768, mobile 390 và 320px không tràn ngang document; bảng scroll trong khung. ADMIN/STAFF logout rồi Back vẫn login.

Ảnh đã xem lại, chỉ chứa fixture:

- [Kho ADMIN desktop](docs/screenshots/batch06-admin-inventory-desktop.png)
- [Sửa và lịch sử](docs/screenshots/batch06-sim-edit-history.png)
- [Kết quả import desktop](docs/screenshots/batch06-import-result-desktop.png), [tablet](docs/screenshots/batch06-import-tablet.png), [mobile](docs/screenshots/batch06-import-mobile.png), [320px](docs/screenshots/batch06-import-320.png)
- [STAFF desktop](docs/screenshots/batch06-staff-inventory-desktop.png), [empty mobile](docs/screenshots/batch06-inventory-empty-mobile.png), [forbidden](docs/screenshots/batch06-staff-forbidden.png)
- [ADMIN logout/Back](docs/screenshots/batch06-admin-logout-back.png), [STAFF logout/Back](docs/screenshots/batch06-staff-logout-back.png)

Log kiểm chứng riêng: `.local/batch06-baseline.log`, `batch06-p21-verify.log` đến `batch06-p25-verify.log`, `batch06-final-verify.log`, `batch06-ci.log`, `batch06-audit-final.json`, `batch06-ui-results.json`, `batch06-live-migrate.log`, `batch06-runtime.log`. Credential/backup không đính kèm.

## 6. Lỗi đã xử lý

| Lỗi | Cách xử lý / bằng chứng |
|---|---|
| Assertion API SIM 404 cũ không còn đúng | Chuyển test sang kiểm quyền/status endpoint mới; vẫn giữ check các module chưa triển khai 404 |
| Fixture list trùng phone giữa test | Sinh phone fixture riêng; không bỏ unique constraint hoặc xóa dữ liệu thật |
| PATCH nhận defaults create vào field không gửi | Tách optional schema không có defaults cho PATCH; regression giữ RESERVED/visibilityRequested khi chỉ đổi giá; 93/93 |
| ExcelJS type Buffer không khớp Node 24 | Truyền ArrayBuffer bản sao có giới hạn, không cast any; XLSX roundtrip test pass |
| Advisory lock query trả void gây preview 503 | Dùng executeRaw cho command lock theo pattern bootstrap hiện có, không deserialize như data query |
| NUL khiến JSONB từ chối preview | Parser đánh dấu ô unsupported và giữ vị trí dòng; không persist NUL hoặc đoán/sửa số SIM. Test row errors pass |
| Dependency audit 5 cảnh báo | Scoped overrides multer 2.5.0/uuid 11.1.1; npm update đúng hai package, npm ci và verify lại; audit 0. Không force downgrade framework |

Không còn lỗi build/lint/typecheck/test đang FAILED trong phạm vi đã chạy.

## 7. Kiểm chứng BLOCKED và nghiệp vụ còn mở

| Phần | Trạng thái | Lý do / điều kiện xác minh |
|---|---|---|
| UI mất kết nối backend | **BLOCKED** | Cơ chế phê duyệt tự động chặn lệnh khởi chạy Next phụ cổng 3111 với API test không phục vụ, lý do trả về “blocked by policy”. Không thử lách bằng công cụ khác. Error boundary/proxy có đường xử lý theo source, nhưng không coi source review là runtime PASS. Cần môi trường test cho phép mô phỏng ngắt kết nối |
| Snapshot đơn/hoa hồng cũ không đổi khi sửa SIM | **BLOCKED** | Chưa có schema/API/module orders/commission records. Chỉ xác minh writer hiện tại ghi SIM/alert/history/audit; không dựng đơn giả hoặc khẳng định đã test integration. Kiểm lại khi có order_items snapshot và module đơn |

Các phần này không được đánh dấu DONE; chức năng triển khai độc lập đã có gate test riêng như mục 1. Chưa kiểm thử TLS/Docker/deployment/restore production/tải đồng thời nhiều Admin hoặc Safari/Firefox thật. Không đăng nhập bằng mật khẩu ADMIN thật của chủ dự án.

Nghiệp vụ CHƯA CHỐT giữ nguyên v1.6: STAFF upload/giá/duyệt SIM, ai xác nhận SIM lỗi, ý nghĩa completed đủ điều kiện xóa, xóa vật lý, phân đơn/hoa hồng sau chuyển và quy tắc đối soát tài chính. Không tự bổ sung chúng. Cảnh báo tự động khác SIM lỗi đã xác nhận.

## 8. Điều kiện chuyển P26–P30

1. Chủ dự án nghiệm thu Batch 06 và cung cấp prompt đúng theo index; không tự chuyển bước.
2. Duy trì schema/constraints/DTO quyền/version và service kiểm giá trong mọi writer; trước migration tiếp theo backup riêng.
3. P26 chỉ xây trang cảnh báo theo prompt, không biến cảnh báo thành xác nhận lỗi/xóa nếu chưa chốt quyền.
4. Khi làm order/financial modules phải có snapshot bất biến và bổ sung integration test đã BLOCKED ở trên; không lấy giá hiện tại để sửa hồi tố.
5. Hoàn tất kiểm tra outage UI khi có môi trường cho phép; chuẩn bị kiểm tải/restore/HTTPS trước vận hành production. Không coi npm audit 0 là chứng nhận an toàn toàn hệ thống.

**Dừng sau P25. Chờ nghiệm thu; không P26 hoặc storefront.**

## 9. File tạo và chỉnh sửa

Đối chiếu SHA-256 với `.local/batch06-baseline.json` và review source. Không có source bị xóa, không sửa báo cáo batch cũ/GAP_ANALYSIS. Master Spec giữ SHA-256 `2B7EA72F62CFD10E23043979C89C2B377194B53687743974F672B55D80FC9BA4`; P00 giữ `AA27187EF81E85AFE99DCF373A3066B498939ACEBE3922586FA667EA7EBBAE71`. Dashboard không có Git repository riêng, không tuyên bố git diff/commit/push. Không tính generated/.next/dist/node_modules/.env/.local/tsbuildinfo vào danh sách source.

### File chỉnh sửa

- `apps/admin/app/api/v1/[...path]/route.ts`
- `apps/admin/app/globals.css`
- `apps/admin/lib/api-client.ts`
- `apps/api/package.json`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/app.module.ts`
- `apps/api/src/audit/audit.service.ts`
- `apps/api/src/create-app.ts`
- `apps/api/test/employee-permissions.test.ts`
- `apps/api/test/health.test.ts`
- `apps/api/test/sims.test.ts`
- `package-lock.json`
- `package.json`
- `packages/shared/src/index.ts`
- `README.md`
- `scripts/backup-local.mjs`
- `scripts/batch05-ui-api-check.mjs`
- `scripts/ui-api-check.mjs`
- `tasks/todo.md`

### File tạo mới

- `apps/admin/app/admin/inventory/[id]/page.tsx`
- `apps/admin/app/admin/inventory/page.tsx`
- `apps/admin/components/catalog-picker.tsx`
- `apps/admin/components/sim-form.tsx`
- `apps/admin/components/sim-import.tsx`
- `apps/api/prisma/migrations/202610240010_sim_price_alerts/migration.sql`
- `apps/api/prisma/migrations/202610240011_sim_changes/migration.sql`
- `apps/api/prisma/migrations/202610240012_sim_imports/migration.sql`
- `apps/api/src/imports/import-parser.ts`
- `apps/api/src/imports/import.controller.ts`
- `apps/api/src/imports/import.input.ts`
- `apps/api/src/imports/import.repository.ts`
- `apps/api/src/imports/import.service.ts`
- `apps/api/src/inventory/inventory.controller.ts`
- `apps/api/src/inventory/inventory.input.ts`
- `apps/api/src/inventory/inventory.repository.ts`
- `apps/api/src/inventory/inventory.service.ts`
- `apps/api/src/inventory/sim-pricing.service.ts`
- `apps/api/src/inventory/sim-write.repository.ts`
- `apps/api/test/inventory.test.ts`
- `apps/api/test/sim-create.test.ts`
- `apps/api/test/sim-edit.test.ts`
- `apps/api/test/sim-import.test.ts`
- `apps/api/test/sim-pricing.test.ts`
- `BATCH_06_REPORT.md`
- `docs/screenshots/batch06-admin-inventory-desktop.png`
- `docs/screenshots/batch06-admin-logout-back.png`
- `docs/screenshots/batch06-import-320.png`
- `docs/screenshots/batch06-import-mobile.png`
- `docs/screenshots/batch06-import-result-desktop.png`
- `docs/screenshots/batch06-import-tablet.png`
- `docs/screenshots/batch06-inventory-empty-mobile.png`
- `docs/screenshots/batch06-sim-edit-history.png`
- `docs/screenshots/batch06-staff-forbidden.png`
- `docs/screenshots/batch06-staff-inventory-desktop.png`
- `docs/screenshots/batch06-staff-logout-back.png`
- `docs/SIM_IMPORT_GUIDE.md`
- `packages/shared/src/inventory.ts`
- `packages/shared/src/sim-import.ts`
- `scripts/batch06-ui-api-check.mjs`
