# Batch 08 — Contract đơn nội bộ và danh sách

## P31: STAFF upload

`POST /api/v1/admin/staff-sim-submissions`: cần session, sims.create, Origin/JSON hợp lệ; trả 501 NOT_IMPLEMENTED, không dùng body để ghi kho. [Quyết định đang chờ](../STAFF_UPLOAD_DECISIONS.md). Không thay đổi quyền nhập giá hoặc quy trình duyệt.

## P32: dữ liệu

Customer tối thiểu gồm fullName và phone (chuỗi, giữ số 0 và dấu + nếu có), không tự gộp khách theo số. Orders có UUID, orderCode duy nhất, customer, trạng thái, danh tính người được giao/nhận/hoàn thành và timestamps. Actor UUID giữ danh tính lịch sử như audit; không suy ra quyền từ một UUID do client gửi. Chưa có API gán/nhận/hoàn thành trong Batch này.

OrderStatus gồm PENDING/CONFIRMED/PROCESSING/COMPLETED/CANCELLED, độc lập trạng thái duyệt lợi nhuận chưa triển khai. Order items luôn có SIM UUID, số snapshot, hai giá NUMERIC(65,30) không null. Snapshot append-only, FK RESTRICT không cascade khi xóa SIM/customer/order. Snapshot số giúp lọc lịch sử khi SIM bị đổi số hoặc rời kho.

## P33: giữ hàng

`ReservationsService.reserve(tx, orderId, simId)` là service nội bộ, không có endpoint riêng. Caller sở hữu transaction tạo draft/snapshot. Khóa draft PENDING rồi khóa SIM; SIM phải còn hoạt động, visible, AVAILABLE, không cờ lỗi giá và giá bán thật phải cao hơn vốn. Ghi reservation, chuyển stock RESERVED và tăng version trong cùng transaction. Active = releasedAt null; unique theo cả SIM UUID và số snapshot, kể cả nhập lại số sau xóa logic. Không có TTL, tự giải phóng hoặc API release/cancel mới.

Admin vẫn được bỏ SIM RESERVED khỏi kho, giữ order/item/reservation và removal/audit. Không tự hủy đơn hoặc giải phóng lượt giữ cũ; việc giải quyết giữ hàng cần workflow được chốt ở phạm vi sau.

## P34: tạo đơn chỉ phục vụ nội bộ/test

`POST /api/v1/admin/internal-orders`, session ADMIN + Origin/JSON; `INTERNAL_ORDER_CREATION_ENABLED=true` ở API mới hoạt động. Mặc định false trả 404; STAFF bị guard từ chối 403. Config từ chối bật trong NODE_ENV=production. Không bật trong `.env` đang dùng; không có checkout public hoặc form tạo đơn thương mại.

```json
{
  "idempotencyKey": "<UUID do caller tạo>",
  "simId": "<UUID SIM>",
  "customer": { "fullName": "Tên khách kiểm thử", "phone": "00000001" }
}
```

Body strict, không nhận giá/status/actor/assignment. Tên 1–150 ký tự sau trim, không NUL; phone 1–32 chữ số, cho phép + đầu chuỗi. Đây là validation kỹ thuật tối thiểu, không phải xác minh danh tính/đầu số. UUID được canonicalize lowercase một lần trước hash/lock/lookup. Không thay đổi số điện thoại hoặc đoán lại số 0.

Transaction tạo customer và order PENDING, dùng reserve service, chụp giá/số đang khóa, ghi audit và idempotency record. orderCode = ORD-UUID là định danh hiển thị kỹ thuật, không phải quy tắc mã hóa đơn/đánh số kế toán. Không tự gán nhân viên, hoàn thành đơn hoặc tính hoa hồng.

Idempotency key theo actor từ session, không nhận actor từ body. Cùng key + payload đã normalize trả nguyên creation response `{ id, orderCode, status: "PENDING" }`, kể cả giá/stock hiện tại đã thay đổi. Payload khác cùng key trả 409. Key tồn tại theo lịch sử order, không TTL/xóa tự động. Hai key tranh cùng SIM chỉ một thành công; mọi lỗi rollback cả customer/order/items/hold/key/audit.

## P35: danh sách chỉ đọc

`GET /api/v1/admin/orders`: cần orders.view. Query strict: status, orderCode (chính xác, phân biệt hoa/thường), phoneNumber (chính xác theo snapshot), assignedStaffId (UUID), month=YYYY-MM, fromDate/toDate=YYYY-MM-DD, page/pageSize. Mặc định tháng hiện tại giờ Việt Nam; gửi đủ hai ngày hợp lệ sẽ thay khoảng tháng, gồm trọn ngày cuối. page 1–10000, pageSize 1–100, mặc định 1/20. Khoảng ngoài trang trả items rỗng cùng total thật.

Sort createdAt DESC/id ASC, repeatable-read cho count/rows/projection. Mỗi row có một preview SIM xác định theo item UUID và itemCount thật để chặn expansion không giới hạn; không coi giá SIM đầu là tổng đơn. Chưa có trang chi tiết đơn hoặc nút nhận. Khóa hiển thị theo assignedStaffId; tài khoản cũ không còn tìm thấy có fullName null thay vì mất danh tính.

ADMIN nhận giá vốn snapshot ở preview. STAFF không được query hoặc nhận trường giá vốn, customer phone, dữ liệu idempotency hoặc thông tin bảo mật tài khoản. STAFF có thể xem đơn được giao cho người khác nhưng không có mutation route.

## Phần còn chờ

P31 upload chưa được chốt. P30 xóa STAFF không được mở lại trong Batch 08, kể cả đã có schema COMPLETED; nguồn order chưa tích hợp với eligibility của Check SIM. Không triển khai nhận/chuyển/đổi trạng thái đơn, duyệt hoa hồng, timeout/release hoặc storefront. Snapshot đơn đã có test thực với API sửa/xóa SIM; hoa hồng/tài chính chưa có nguồn nên chưa kiểm chứng.
