# Batch 08 — P31–P35

Ngày 24/10/2026, Asia/Ho_Chi_Minh. Nguồn: `SIM_Dashboard_Master_Spec_v1.6.md` và bản gộp `BATCH_08_P31-P35.md` được người dùng giao. Chỉ Dashboard; không storefront, MobiFone API hoặc P36.

## Kết quả từng nhiệm vụ

| Pxx | Trạng thái | Kết quả |
|---|---|---|
| P31 | PARTIAL / BLOCKED BY POLICY | Đã có STAFF_UPLOAD_DECISIONS.md, DTO/contract tạm, endpoint 501 và placeholder. Upload thật chờ nguồn số/input/quyền nhập giá/duyệt/xử lý trùng; không mở ghi kho cho STAFF. |
| P32 | DONE | customers/orders/order_items, trạng thái đơn riêng, giá/số snapshot bất biến, FK RESTRICT và indexes. Đã kiểm chứng qua API sửa/xóa SIM không mất đơn/snapshot. |
| P33 | DONE | Reservation gắn draft hợp lệ, row locks/transaction, unique active theo SIM UUID và số snapshot; chống contention/orphan/rollback. Không TTL hoặc release tự động. |
| P34 | DONE | API tạo đơn nội bộ ADMIN-only, config mặc định tắt, strict validation, actor-scoped idempotency, snapshot/reservation/audit atomic. Không checkout public. |
| P35 | DONE | API/trang danh sách chỉ đọc, lọc/phân trang, mặc định tháng giờ VN, projection ADMIN/STAFF, không có nút nhận hoặc mutation trạng thái. |

Đã hoàn thành phần độc lập được yêu cầu. Không coi quy trình STAFF upload thật là DONE. **Dừng sau Batch 08 để nghiệm thu.**

## Kiểm tra Batch trước và kế hoạch

- Đọc BATCH_07_REPORT.md, tasks/todo.md, source và cấu hình hiện có. Batch 07 không hoàn tất toàn bộ nghiệp vụ: xác nhận lỗi/xóa STAFF còn BLOCKED. Các phụ thuộc trực tiếp P20/P14/P09/P08 đã có; P31 thiết kế không dùng phần bị chặn, P32–P35 độc lập với upload chưa chốt theo ngoại lệ trong file Batch 08.
- Đã đối chiếu log Batch 07: full run 112/113 rồi sửa fixture và P30 recheck 2/2, không còn failure chưa xử lý. Không diễn giải thành một full run 113/113. Batch 08 cuối lượt đã chạy full suite mới thành công, gồm hồi quy Batch 07.
- Trước P31: DB khớp 13 migration. Dashboard không có `.git`, nên không có Git diff của repo này; lưu hash 261 file và bản trước sửa trong `.local/batch08-before`. Kiểm tra Git/DB trước mỗi Pxx, không reset hoặc đè công việc cũ.
- Kế hoạch/chốt gate thực tế trong tasks/todo.md. P31 → P32 → P33 → P34 → P35 được triển khai tuần tự; mỗi bước có build, typecheck, lint và test riêng trước bước kế tiếp.

## Thay đổi và API theo Pxx

Tất cả route dưới đây có prefix `/api/v1`. Contract chi tiết: [INTERNAL_ORDERS.md](docs/INTERNAL_ORDERS.md). Danh sách file: [BATCH_08_FILES.md](docs/BATCH_08_FILES.md).

| Pxx | File / migration / API chính |
|---|---|
| P31 | `STAFF_UPLOAD_DECISIONS.md`; shared `staff-sim-upload.ts`; `staff-sim-submissions.controller.ts`; inventory page, app.module/proxy; test `staff-sim-upload.test.ts`. `POST /admin/staff-sim-submissions` luôn 501 sau guards, body không được ghi. Giữ sims.create trong ma trận, không thêm quyền giá. |
| P32 | Prisma schema; migration `202610240014_orders`; shared orders.ts; helpers/order-data.ts và order-schema.test.ts. Không API claim/status/finance. |
| P33 | Migration `202610240015_reservations`; `orders/reservations.service.ts`; reservations.test.ts; module đăng ký service. Không endpoint reserve public. |
| P34 | Migration `202610240016_order_create_keys`; orders.input.ts, order-create.repository/service/controller.ts, config.ts/.env.example, audit/module/shared/proxy; order-create.test.ts. `POST /admin/internal-orders`. HttpFixture nhận config rõ ràng để kiểm thử enabled/disabled mà không sửa process environment chung. |
| P35 | orders.repository/service/controller.ts; `app/admin/orders/page.tsx`, shared DTO/proxy; orders-list.test.ts. `GET /admin/orders`. Cập nhật đúng hai assertion cũ từng coi route orders chưa tồn tại; giữ kiểm tra finance/payroll/claim/status chưa triển khai. |

Các sửa tích hợp trực tiếp:

- Backup thêm removal log và các bảng đơn mới để không bỏ sót lịch sử khi backup sau Batch.
- Check SIM đổi đúng thông báo “chưa có module đơn” thành “chưa tích hợp đối soát tại đây”; không mở lại eligibility P30.
- Sửa `monthBounds` tại boundary sở hữu lịch: Date.UTC tự đổi năm 0001–0099 thành 1901–1999 dù schema cho phép các năm này. Dùng setUTCFullYear, thêm calendar.test.ts kiểm năm nhỏ/leap/year boundaries; không đặt giới hạn năm nghiệp vụ mới.
- README, contract, script proxy/UI test và báo cáo. Không thêm dependency; package.json/package-lock.json giữ nguyên.

## Hành vi và bảo toàn dữ liệu

### P32/P33

Customer tối thiểu lưu tên/phone như chuỗi, không suy luận trùng khách theo phone. Order code ORD-UUID là định danh hiển thị kỹ thuật, không phải mẫu mã hóa đơn. Actor UUID giữ danh tính lịch sử như audit; chưa có API gán/nhận/hoàn thành. OrderStatus không trộn trạng thái duyệt lợi nhuận.

Order item chụp giá bán, vốn và số từ SIM đang khóa, NUMERIC(65,30), không null; append-only và FK RESTRICT. ADMIN sửa giá hoặc bỏ SIM khỏi kho vẫn giữ order/items/giá/số/reservation; không hủy đơn hoặc tự giải phóng giữ hàng.

Reserve khóa draft rồi SIM trong transaction caller sở hữu; kiểm PENDING, SIM chưa removed, visible, AVAILABLE, không lỗi giá và giá bán thật > giá vốn. Unique active theo cả SIM và số snapshot ngăn giữ trùng, kể cả nhập lại số sau xóa logic. Không chọn thời hạn giữ hàng hoặc triển khai release/cancel ngoài phạm vi.

### P34

ADMIN + Origin/JSON hợp lệ và `INTERNAL_ORDER_CREATION_ENABLED=true` ở development/test mới được tạo; mặc định false, config chặn bật production. `.env` local không được bật flag này. Không tạo role mới hoặc cấp STAFF đường nhập giá.

Body strict chỉ nhận idempotencyKey UUID, simId UUID và customer fullName/phone. UUID canonicalize lowercase trước hash/lock/lookup, giữ số 0 điện thoại. Không nhận giá, status, assignment hoặc actor do client gửi. Advisory transaction lock theo actor/key; cùng payload trả nguyên response tạo ban đầu, khác payload 409. Customer/order/item/reservation/audit/key cùng transaction; lỗi bất kỳ bước ghi được rollback, key thất bại có thể thử lại. Response chỉ id/orderCode/PENDING, không có giá vốn/PII.

### P35

Lọc status, mã đơn/SIM chính xác, ngày tạo, người được giao; mặc định tháng hiện tại theo giờ VN. Hai ngày đủ sẽ thay khoảng tháng, gồm hết ngày cuối. Page 1–10000, pageSize 1–100, mặc định 20. Count/rows đọc repeatable-read, sort ổn định. Trang ngoài phạm vi trả items rỗng cùng total thật.

Một preview SIM/row kèm itemCount thật để chặn expansion không giới hạn; UI ghi rõ SIM đầu tiên và không coi giá preview là tổng đơn. STAFF xem đơn người khác giữ nhưng không có mutation; không query/trả giá vốn, customer phone, key/hash hoặc dữ liệu bảo mật tài khoản. Danh tính nhân viên đã mất vẫn giữ UUID với fullName null.

## Kiểm thử đã chạy

Mỗi gate dùng script hiện có, không npm ci hoặc cài dependency lại. Test runner tạo PostgreSQL cluster mới trong `.local`, áp migration trên DB test riêng rồi dừng; không dùng DATABASE_URL local làm test target.

| Gate | Lệnh thực tế | Kết quả / bằng chứng |
|---|---|---|
| P31 | `npm run build`, `npm run typecheck`, `npm run lint`, `node .local/batch07-focused-test.mjs staff-sim-upload.test.js` | Exit 0, 2/2; `.local/batch08-p31-gate.log`. |
| P32 | Cùng build/typecheck/lint; focused `order-schema.test.js` | Exit 0, 2/2; `.local/batch08-p32-gate.log`. |
| P33 | Build/typecheck/lint; focused `reservations.test.js` | Exit 0, 4/4; `.local/batch08-p33-gate.log`. Sau bổ sung identity số snapshot, chạy lại gate 4/4 tại `.local/batch08-p33-identity-gate.log`. |
| P34 | Build/typecheck/lint; focused `order-create.test.js` | Exit 0, 6/6; `.local/batch08-p34-gate.log`. Sau canonical UUID, build:api/typecheck/lint + 6/6 tại `.local/batch08-p34-identity-gate.log`. |
| P35 | Build/typecheck/lint; focused `orders-list.test.js` | Exit 0, 4/4; `.local/batch08-p35-gate.log`. |
| Tổng cuối | `npm run verify` | **Exit 0; build/typecheck/lint PASS; 132/132 test, fail/cancel/skip/todo đều 0**. `.local/batch08-final-verify.log`; test duration 154736.3607ms, không phải tổng thời gian cả build/UI. |
| Proxy/UI | Fixture `INTERNAL_ORDER_CREATION_ENABLED=true; node scripts/ui-test.mjs`, rồi `node scripts/batch08-ui-api-check.mjs` | **31/31 checks** qua Next proxy; `.local/batch08-ui-proxy.log`, `.local/batch08-ui-results.json`. Flag chỉ ở process fixture, không sửa .env local. |
| Scripts | `node --check scripts/batch08-ui-api-check.mjs`, `node --check scripts/backup-local.mjs` | Exit 0. |

Không có gate test thất bại chưa xử lý. Không gọi kiểm thử chưa chạy là PASS.

### Quyền và các ca biên đã kiểm chứng

- P31: session/Origin/quyền bị thu hồi, giả role/approved/costPrice không ghi kho; STAFF create/PATCH/import ADMIN đều bị chặn.
- P32: giá 30 chữ số thập phân giữ nguyên qua API edit/remove; không null/số âm/NaN/sai FK/trùng code/item; snapshot không sửa/xóa/truncate; không cascade order/customer/SIM. Ràng buộc completion timestamp/actor tách khỏi trạng thái tài chính.
- P33: 2 transaction tranh SIM chỉ 1 thành công, không orphan, SIM unavailable/removed/hidden/price-error/RESERVED/SOLD hoặc draft không hợp lệ bị từ chối; lỗi sau reserve rollback stock/version/customer/order/hold. ADMIN bỏ SIM RESERVED vẫn giữ draft/reservation; nhập lại cùng số không giữ trùng.
- P34: 2 request cùng key kể cả UUID khác hoa/thường trả cùng đơn; khác payload 409; hai key tranh SIM một 201/một 409 và không có customer/order/hold ma. Key theo actor hiện tại, không body; schema strict, Origin, missing session, STAFF, disabled/default và production config. Lỗi insert order_item/audit rollback toàn bộ, retry cùng key thành công. Replay sau sửa/xóa SIM vẫn trả nguyên creation response, snapshot không đổi.
- P35: bộ lọc kết hợp, ngày/tháng giờ VN và ngày cuối; sort/paging/outside page; snapshot số vẫn tìm được sau đổi số/removal; projection STAFF, quyền bị thu hồi, xem đơn nhân viên khác, không có claim/status/update route. Calendar regression mới và hồi quy cũ đều PASS trong full suite.

### UI production trên database test

- ADMIN: 3 đơn, giá vốn hiện; lọc PROCESSING bằng form còn 1 đơn; pagination trang 1 → 2 thay đúng bản ghi; CANCELLED rỗng; filter INVALID hiển thị lỗi và link thử lại.
- STAFF: không cột giá vốn hoặc nút nhận/ghi, vẫn đọc được trạng thái/người giữ; inventory có placeholder đăng SIM và không có form nhập giá ADMIN. Logout rồi Back vẫn ở login.
- Responsive orders: kiểm ảnh 1440/768/390/320px; form không tràn document, bảng cuộn trong khung. 390/320 dùng ảnh viewport sau khi full-page capture của tool không ổn định; không thay CSS hoặc bỏ kiểm tra để che lỗi công cụ.
- Loading và lỗi dịch vụ: dùng `.local/batch08-ui-lock.mjs` khóa tạm **orders của dashboard_ui_test**, không sửa hàng. Chuyển từ Kho SIM sang Đơn hàng quan sát “Đang tải không gian làm việc…”, sau timeout UI hiện lỗi kết nối an toàn. ROLLBACK/release lock đã xác nhận; bấm Thử lại phục hồi 3 đơn. Không khởi chạy server phụ hoặc tác động DB local.
- Trạng thái PROCESSING/COMPLETED trên ảnh là fixture được script đặt trực tiếp trong DB test cho màn hình đọc, **không phải** kiểm chứng quy trình nhận/hoàn thành/hoa hồng. Chưa triển khai các mutation đó.

Ảnh: [ADMIN desktop](docs/screenshots/batch08-orders-admin-desktop.png), [tablet](docs/screenshots/batch08-orders-tablet.png), [390px](docs/screenshots/batch08-orders-mobile.png), [320px](docs/screenshots/batch08-orders-320.png), [lọc](docs/screenshots/batch08-orders-filter.png), [empty](docs/screenshots/batch08-orders-empty.png), [filter error](docs/screenshots/batch08-orders-error.png), [pagination](docs/screenshots/batch08-orders-pagination.png), [STAFF](docs/screenshots/batch08-orders-staff.png), [upload placeholder](docs/screenshots/batch08-staff-upload-placeholder.png), [loading observation](docs/screenshots/batch08-orders-loading.txt), [service error](docs/screenshots/batch08-orders-service-error.png), [recovered](docs/screenshots/batch08-orders-recovered.png).

## Database local, cleanup và review

- Trước migration: 13 migration hoàn tất, không bảng đơn mới; 16 bảng cũ khớp digest snapshot đầu Batch. Kiểm tra thật trước thao tác ghi, không áp lại migration cũ.
- Backup bằng `node scripts/backup-local.mjs`: `.local/backups/dashboard-logical-1792858423939.json`. Snapshot riêng tư có dữ liệu nhạy cảm, không xuất nội dung. Đây là snapshot hàng logic; không phải pg_dump hoặc kiểm chứng restore production.
- `npm run db:migrate` exit 0, chỉ áp **014/015/016**. Chỉ tạo schema/bảng/index/constraints/triggers, không sửa dữ liệu cũ. `.local/batch08-local-migration.log`.
- Sau migration: **16 bảng cũ giữ nguyên digest; 5 bảng mới customers/orders/order_items/inventory_reservations/order_create_keys trống; đủ 16 migration finished**, không rollback. `.local/batch08-pre-migration-state.json`, `.local/batch08-post-migration-state.json`. `npm run db:status` cuối lượt up to date.
- Database test/Next/API fixture 3110/4210 đã dừng; lock test đã rollback và process đã thoát. Không xóa cluster/log/bằng chứng để còn điều tra. Không ghi fixture, đơn hoặc xóa SIM vào DB local đang dùng.
- Kiểm tra cuối phát hiện 3100/4200 không lắng nghe; không kết luận nguyên nhân khi chưa có bằng chứng. Khởi động lại bằng `npm start` hiện hữu, không build lại hoặc đổi .env. Dashboard `/login` và API `/api/v1/health` HTTP 200; anonymous `/api/v1/admin/orders` HTTP 401. Log riêng `.local/batch08-local-start.log`.
- Review diff so với bản trước Batch và danh sách file; package/lock không đổi, không binary/dependency/credential trong source mới. Dashboard không Git nên không commit/push. Không sửa source Home/REA hoặc báo cáo Batch 07; giữ nguyên bằng chứng lịch sử. Không có PR hoặc tuyên bố nghiệm thu thay người dùng.

## Blocker còn lại và điều kiện Batch 09

1. STAFF upload: cần chủ dự án chốt nguồn số, mẫu input, ai ghi giá gốc, quyền giá, quy trình duyệt và trùng/retry. [STAFF_UPLOAD_DECISIONS.md](STAFF_UPLOAD_DECISIONS.md). Contract 501 không thay quyết định này.
2. Các blocker cũ P28/P30: nguồn/thẩm quyền/bằng chứng xác nhận lỗi vẫn chưa chốt. Batch này đã có schema đơn nhưng chưa tích hợp COMPLETED vào eligibility xóa; không tự mở quyền STAFF ngoài P31–P35.
3. Snapshot **đơn** qua edit/remove đã được kiểm chứng trong Batch 08; snapshot hoa hồng/tài chính chưa có module nên vẫn NOT RUN. Không suy từ fixture COMPLETED ra đã triển khai nghiệp vụ hoàn thành.
4. Chưa làm nhận/chuyển/đổi trạng thái đơn, timeout/release, duyệt lợi nhuận/hoa hồng hoặc checkout. Cần các đặc tả/phạm vi được giao tiếp theo trước khi triển khai.
5. Chỉ bắt đầu Batch 09 khi người dùng nghiệm thu kết quả Batch 08, chấp nhận carry-forward blocker P31/P28/P30 hoặc cung cấp quyết định cần thiết và giao file/phạm vi tiếp theo. Không tự thực hiện P36.

**DỪNG SAU BATCH 08.**
