# Batch 07 — P26–P30

Ngày: 24/10/2026, Asia/Ho_Chi_Minh. Phạm vi: Dashboard, không triển khai Home hoặc P31.

## Kết quả

| Nhiệm vụ | Trạng thái | Kết quả và giới hạn |
|---|---|---|
| P26 | DONE | API/trang cảnh báo, filter/phân trang/count thật, DTO theo quyền. SIM rời kho vẫn giữ cảnh báo và không còn link sửa. |
| P27 | PARTIAL | API/trang tra cứu chính xác và data minimization đã kiểm chứng. Thông tin đơn chưa có nguồn; confirmation là UNVERIFIED. Không coi SOLD là COMPLETED. |
| P28 | PARTIAL / BLOCKED | Đã có quyết định pending, contract thiết kế và test chặn tự xác nhận. Chưa chốt người xác nhận/nguồn/bằng chứng/state machine, không bật endpoint hoặc tạo bảng confirmation. |
| P29 | PARTIAL | ADMIN xóa logic mọi trạng thái, UI xác nhận, row lock/version, removal log và audit atomic đã kiểm chứng. Chưa thể kiểm chứng snapshot đơn/hoa hồng thật vì chưa có schema/module đơn. |
| P30 | PARTIAL / BLOCKED | Đã kiểm chứng STAFF bị từ chối an toàn. Chưa bật nhánh cho phép xóa theo COMPLETED hoặc confirmed error vì chưa có nguồn xác minh. |

Phần độc lập đã triển khai và kiểm thử. **Không coi toàn bộ Batch là DONE** khi các coverage/chính sách trên còn thiếu. Dừng sau Batch 07 để nghiệm thu.

## Khôi phục sau ngắt kết nối

- Workspace mở ban đầu là REA Skill: `git diff` và staged diff trống; chỉ `research/`, `tasks/` untracked đã có. Công việc thực tế nằm ở `C:/Users/nghia/OneDrive/Desktop/SimMobile/Dashboard-Sim-Mobi`, tìm lại qua lịch sử chat “Phân tích frontend công khai MobiF一” và `tasks/todo.md`.
- Dashboard không có Git repository, nên không có Git diff để tái dựng từng dòng cũ. Đối chiếu SHA-256 với `.local/batch07-baseline.json`, đọc source/test/log và lịch sử công cụ. Danh sách file tại [BATCH_07_FILES.md](docs/BATCH_07_FILES.md); hash chỉ chứng minh file đã khác, không thay thế bản diff nội dung gốc.
- Trước khi tiếp tục: P26 có full verify exit 0, 100/100; P27 exit 0, 103/103 và 18 kiểm tra proxy; P28 có full verify exit 0, 105/105 nhưng checklist chưa cập nhật. Các file quyết định/contract/test P28 có thật. Không chạy lại baseline 98/98 hoặc triển khai lại P26–P28.
- P29/P30 chưa có mã xóa hoặc migration013; báo cáo Batch 07 chưa tồn tại. Tiếp tục đúng từ P29 sau khi xác minh phần an toàn của P28.
- PostgreSQL local lúc đầu không lắng nghe. Đã kiểm tra metadata/PG_VERSION hiện hữu rồi khởi động lại đúng cluster bằng `npm run db:local`, không tạo lại cluster hoặc ghi đè `.env`.
- Trạng thái DB đọc được: 12 migration đã hoàn tất, không có removal table; tài khoản và dữ liệu nghiệp vụ khớp baseline đầu Batch. Có thêm 1 session, 2 login-limit rows và 3 audit events: LOGIN_FAILURE, LOGIN_SUCCESS, EMPLOYEES_LIST_VIEWED. Không suy đoán người thực hiện; giữ nguyên toàn bộ. Tạo snapshot digest riêng lúc khôi phục, không ghi đè baseline cũ.

## Triển khai và API

Tất cả API sau có prefix `/api/v1`.

| Pxx | API / file chính |
|---|---|
| P26 | `GET /admin/alerts/sim-pricing`; `apps/api/src/inventory/price-alerts.controller.ts`; `apps/admin/app/admin/alerts/sim-pricing/page.tsx`; test `price-alerts.test.ts`. Không viết lại cơ chế giá P21. |
| P27 | `GET /admin/check-sim?phoneNumber=...`; `check-sim.controller.ts`, `check-sim.service.ts`, `check-sim.repository.ts`, `sim-removal.policy.ts`; shared `sim-inspection.ts`; trang `admin/check-sim/page.tsx`; test `check-sim.test.ts`. |
| P28 | [DECISION_SIM_ERROR.md](DECISION_SIM_ERROR.md), [contract trung lập](docs/SIM_ERROR_CONFIRMATION_CONTRACT.md), `apps/api/test/sim-error-policy.test.ts`. Không có mutation confirmation. |
| P29 | `DELETE /admin/sims/:id`; controller/service/writer/input inventory, `audit.service.ts`, Prisma schema/migration013, Next proxy, `components/remove-sim-action.tsx`, Check SIM page; `sim-remove.test.ts`. |
| P30 | `sim-remove-policy.test.ts`. Giữ DELETE ADMIN-only tại cả controller và service; không đưa boolean eligibility từ client vào guard. |

DELETE nhận `{ version: number, reason?: string }`, schema strict, reason không rỗng sau trim, tối đa 500 ký tự, từ chối NUL. Role/actor từ session hiện tại; yêu cầu Origin đúng và JSON. Frontend xác nhận trước khi gửi, cho hủy, hiển thị pending/lỗi và refresh kết quả sau thành công.

Transaction khóa SIM bằng `FOR UPDATE`, kiểm tra còn hoạt động và version hiện tại; đặt `deleted_at`, tắt hiển thị/ý định hiển thị, tăng version và ghi actor. Không đổi `stock_status`, giá, confirmation cũ, lịch sử chỉnh sửa hoặc alert. `sim_removal_logs` lưu SIM UUID, số snapshot, actor, timestamp, reason tùy chọn và snapshot trước xóa; cùng transaction với audit `SIM_REMOVED`. Log có UNIQUE(sim_id), FK RESTRICT và trigger chặn UPDATE/DELETE/TRUNCATE. Xóa lặp trả 404; stale version trả 409. Nhập lại cùng số tạo UUID mới, giữ UUID/lịch sử cũ.

## Kiểm thử đã thực hiện

### Bằng chứng trước ngắt kết nối — không chạy lại baseline

| Lệnh | Kết quả đã lưu |
|---|---|
| `npm run verify` ở P26 | Exit 0, 100/100; `.local/batch07-p26-verify.log`. |
| `npm run verify` ở P27 | Exit 0, 103/103; `.local/batch07-p27-verify.log`. |
| `node scripts/batch07-ui-api-check.mjs` | 18 proxy checks; `.local/batch07-ui-results.json`. |
| `npm run verify` ở P28 | Exit 0 trong lịch sử công cụ, 105/105 trong `.local/batch07-p28-verify.log`. |

### Sau khôi phục — giữ cả log thất bại và kết quả sửa

| Lệnh | Kết quả |
|---|---|
| `npm run verify` — P29 | Build/typecheck/lint PASS; test 110/111. Một assertion mới giả định edit chỉ tăng version một lần; cơ chế reconciliation P21 hiện có có thể tăng thêm. Không thay cơ chế cũ để làm test qua. Log `.local/batch07-p29-verify.log`. |
| `npm run build:api` + `node .local/batch07-focused-test.mjs sim-remove.test.js` | Exit 0, 6/6 P29 sau sửa assertion đối chiếu version DTO và trạng thái cuối. Log `.local/batch07-p29-recheck.log`. |
| `npm run verify` — P30/final | Build/typecheck/lint PASS; test 112/113. Một fixture mới cố chèn settings.admin bị constraint DB hiện có chặn. Log `.local/batch07-p30-final-verify.log`. |
| `npm run build:api` + `node .local/batch07-focused-test.mjs sim-remove-policy.test.js` | Exit 0, 2/2 P30 sau đổi fixture sang assert DB từ chối quyền ngoài allowlist rồi thu hồi quyền hợp lệ. Log `.local/batch07-p30-recheck.log`. |
| `npm run lint` sau sửa test cuối | Exit 0; `.local/batch07-final-lint.log`. API build cuối đã typecheck cả source/test. Không đổi production code sau full build/typecheck trên. |
| `node scripts/ui-test.mjs` + `node scripts/batch07-removal-proxy-check.mjs` | Fixture production riêng 3110/4210, database mới; **33/33** proxy checks. `.local/batch07-removal-proxy-results.json`, `.local/batch07-removal-proxy.log`. |

Các nhóm P26/P27/P28/P29/P30 đều có kết quả PASS trên production source cuối: 2/3/2/6/2 test tương ứng. Không còn test thất bại chưa xử lý. **Không có một lần `npm run verify` cuối đạt 113/113 trong cùng lượt**: full run đạt 112/113, sau đó sửa riêng test fixture và nhóm P30 đạt 2/2. Không chạy lại các nhóm đã PASS để đáp ứng yêu cầu không lặp việc đã kiểm chứng. Không đổi test runner chính; harness focused chỉ nằm trong `.local`, luôn tạo database test mới.

### Phân quyền, transaction và các ca biên

- ADMIN xóa cả AVAILABLE/RESERVED/SOLD, giá hợp lệ và giá lỗi: cả 6 tổ hợp PASS; số 0 đầu, giá và stock snapshot giữ nguyên; SIM biến khỏi lookup hoạt động; alert còn và được đánh dấu rời kho.
- Anonymous 401; STAFF/STAFF khác 403; Origin sai 403; ID sai 400; UUID không tồn tại 404 cho ADMIN; strict body/version/reason, field lạ, NUL và stale version đều bị chặn.
- STAFF không được xóa khi tự gửi `eligible`, `confirmed`, `confirmedBy`, ADMIN actor/role, `COMPLETED`, header giả, SOLD, cảnh báo giá hoặc timestamp xác nhận cũ. Không ghi removal/audit thành công, hàng SIM không thay đổi. Tắt quyền có hiệu lực trên cùng session; gọi service trực tiếp vẫn bị chặn. ADMIN độc lập với điều kiện STAFF.
- Hai request xóa đồng thời: một 200, một 404, đúng một log/audit. Edit/remove đồng thời: sửa thắng thì xóa 409; xóa thắng thì sửa 404; test chấp nhận hai kết quả đúng và kiểm tra trạng thái cuối.
- Lỗi insert removal log hoặc audit: 503 và rollback toàn bộ SIM/log/audit. Log không sửa/xóa/truncate được; SIM đã có removal log không xóa vật lý được. Nhập lại cùng số giữ UUID cũ và dùng UUID mới trong lookup.
- Các test quyền, dữ liệu, transaction và hồi quy còn lại trong full run cuối đã PASS; không phát hiện regression production chưa xử lý.

### UI production trên database test

- ADMIN: kết quả SIM RESERVED có price alert; mở xác nhận, nhập reason, hủy; cố xóa phiên bản cũ sau một edit độc lập nhận thông báo tra cứu lại; reload và xác nhận xóa thành công, kết quả chuyển sang “Không tìm thấy trong kho hoạt động”.
- Lịch sử cảnh báo còn số đã xóa, hiện “Đã rời kho hoạt động” và không có link sửa. STAFF xem SIM SOLD có cảnh báo nhưng không thấy giá gốc/nút sửa/nút xóa; thông điệp thiếu nguồn xác minh rõ ràng. STAFF logout rồi Back vẫn ở login.
- Check SIM/xác nhận: screenshot kiểm tra 1440/768/390/320px, không tràn ngang. Cảnh báo: desktop/mobile 390px và kiểm tra chiều rộng 320px; bảng cuộn trong khung. Không xác nhận riêng measurement cảnh báo 768px vì mẫu đo ngay sau resize vẫn trả width cũ; không coi số đo đó là PASS.
- Loading/empty/error của P26/P27 có bằng chứng trước gián đoạn: `batch07-p26-empty.png`, `batch07-p27-desktop.png`, `batch07-p27-loading.txt` và lịch sử UI. Không tạo lại chúng. UI outage hạ tầng từ Batch 06 vẫn chưa xác minh, không thử lại thao tác server phụ từng bị chặn.

Ảnh mới: [xác nhận desktop](docs/screenshots/batch07-remove-confirm-desktop.png), [390px](docs/screenshots/batch07-remove-confirm-mobile.png), [320px](docs/screenshots/batch07-remove-confirm-320.png), [tablet](docs/screenshots/batch07-remove-confirm-tablet.png), [xung đột](docs/screenshots/batch07-remove-conflict.png), [sau xóa](docs/screenshots/batch07-remove-result.png), [cảnh báo lưu trữ](docs/screenshots/batch07-archived-alerts.png), [STAFF Check SIM](docs/screenshots/batch07-staff-check-sim.png), [STAFF cảnh báo](docs/screenshots/batch07-staff-alerts-mobile.png). Tất cả dữ liệu ảnh là fixture test.

## Migration và dữ liệu local

- Đã kiểm tra DB thực tế trước thao tác ghi: 001–012 hoàn tất, chỉ 013 pending. Migration mới `202610240013_sim_removals` chỉ tạo bảng/index/trigger, không sửa hàng cũ.
- `node scripts/backup-local.mjs`: PASS; snapshot riêng tư `.local/backups/dashboard-logical-1792856422886.json`. Không đưa snapshot/credential vào báo cáo hoặc Git. Đây là snapshot hàng logic, không phải pg_dump/kiểm chứng restore production.
- `npm run db:migrate`: exit 0, chỉ áp **013**, không áp lại 001–012. Log `.local/batch07-local-migration.log`.
- Đối chiếu trước/sau: **15 bảng cũ giữ nguyên digest so với snapshot lúc khôi phục**; bao gồm session/login-limit/audit đã có thêm trước lúc tiếp tục. Không tuyên bố auth vẫn khớp baseline đầu Batch. Bảng mới `sim_removal_logs` trống, đủ 13 migration finished, không rollback. Bằng chứng `.local/batch07-pre-migration-state.json`, `.local/batch07-post-migration-state.json`.
- Database local không nhận fixture hoặc thao tác xóa SIM kiểm thử. Dashboard 3100/login và API 4200/api/v1/health HTTP 200; DELETE anonymous tới UUID giả nhận 401, không có ghi/xóa SIM. Không reset Git, xóa dữ liệu hoặc khởi tạo lại DB.
- Cuối lượt: `npm run db:status` exit 0, schema up to date. Đã gửi `stop` cho fixture 3110/4210, công cụ xác nhận cả server và PostgreSQL test đã dừng; đóng tab test. Không dừng Dashboard/API/database local đang dùng.

## Review Astra

Đã dùng subagent **gpt-6-astra**, reasoning high, rà soát độc lập source/test P27–P30 đúng yêu cầu Batch. Không có finding P0–P2 cần sửa trong phạm vi đó; kiểm tra guard và service, IDOR, body/header giả, allowlist quyền, confirmation chưa xác minh, row lock/version, transaction, replay, FK/log bất biến, UI/proxy/DTO.

Đây là **source review**, Astra không chạy lại DB/test và không truy cập dữ liệu live. Root đã kiểm chứng các kết quả công cụ/test/UI nêu trên. Khoảng trống không nâng thành PASS: test race dùng Promise.all không cưỡng chế riêng cả hai thứ tự thắng; replay DELETE UUID cũ sau tái nhập chưa có assertion HTTP riêng. Schema/workflow đơn và confirmation chưa tồn tại nên không thể kiểm chứng race hoàn thành đơn–xóa hoặc thu hồi confirmation–xóa.

## Blocker và điều kiện nghiệm thu / Batch 08

1. P28 cần chủ dự án quyết định nguồn/người được báo và xác nhận lỗi, bằng chứng, quyết định/bác bỏ/thu hồi và ảnh hưởng tới đơn. Các câu hỏi cụ thể tại DECISION_SIM_ERROR.md; contract chỉ là đề xuất, không cấp quyền.
2. P30 COMPLETED cần schema/order source thật và liên kết SIM–đơn được backend xác minh. Không dựng module đơn hoặc giả dữ liệu COMPLETED để đánh dấu PASS trong Batch 07. Nhánh confirmed-error cần chính sách P28 và nguồn confirmation có provenance.
3. P27/P29 còn kiểm chứng tích hợp đơn/giá snapshot/hoa hồng sau xóa; chưa có dữ liệu/schema nên NOT RUN. Giữ lịch sử SIM/alert/change/removal đã kiểm chứng không thay thế bằng chứng đơn/tài chính.
4. Chỉ bắt đầu Batch 08 khi người dùng nghiệm thu phần độc lập, chấp nhận rõ các blocker carry-forward hoặc cho phép hoàn tất chúng với đầu vào cần thiết, và giao phạm vi tiếp theo. Không tự mở quyền STAFF để vượt gate; không coi review Astra là nghiệm thu của người dùng.

**Dừng ở Batch 07. Không thực hiện P31 hoặc batch kế tiếp.**
