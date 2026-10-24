# P28 — Cổng quyết định xác nhận SIM lỗi

Trạng thái: **PARTIAL — thiết kế đã có; thao tác xác nhận BLOCKED BY POLICY**.
Nguồn: Master Spec v1.6 mục 3, 5.2, 5.3, 15 và Batch 07 P28/P30. Không phải quyết định thay chủ dự án.

## Đã thống nhất

- Cảnh báo giá bán ≤ giá gốc là tự động; không chứng minh SIM đã được xác nhận lỗi.
- STAFF không được tự gắn lỗi để cấp điều kiện xóa.
- `SOLD` không chứng minh đơn `COMPLETED`.
- ADMIN được bỏ SIM khỏi kho hoạt động ở mọi trạng thái, giữ lịch sử.
- Trường `sims.error_confirmed_at` hiện có chỉ là timestamp cũ. Không có actor, nguồn, bằng chứng hoặc chính sách xác nhận tương ứng; không được dùng riêng trường này để cấp quyền.

## Cần chủ dự án chốt

| Quyết định | Hiện trạng | Phần bị chặn |
|---|---|---|
| Ai được báo lỗi, nguồn nào được chấp nhận? | CHƯA CHỐT: báo thủ công/đối tác/nguồn khác | Biểu mẫu, input và nguồn tin cậy |
| Ai có quyền xác nhận hoặc bác bỏ? Có tách người báo/người duyệt không? | CHƯA CHỐT; không tự gán ADMIN hoặc STAFF | Guard và endpoint xác nhận |
| Định nghĩa SIM lỗi và bằng chứng bắt buộc | CHƯA CHỐT: loại bằng chứng, nội dung, thời hạn, bảo mật | Validation, lưu bằng chứng |
| Trạng thái, sửa sai/thu hồi xác nhận, có cần tái duyệt không? | CHƯA CHỐT | State machine và hiệu lực quyền xóa |
| Có ảnh hưởng đơn đang xử lý/đã hoàn thành không? | CHƯA CHỐT; hiện chưa có schema đơn | Liên kết/đối soát với đơn |

## Phần đã triển khai an toàn

- Check SIM hiển thị nguồn xác nhận **UNVERIFIED**, gồm timestamp cũ nếu có, và không cho STAFF xóa.
- Không có endpoint ghi confirmation. PATCH SIM strict không chấp nhận `errorConfirmedAt`, `hasPriceError`, actor hoặc checkbox xác nhận từ client.
- Không tạo bảng confirmation rỗng khi chính sách chưa chốt. Contract trung lập nằm tại [SIM_ERROR_CONFIRMATION_CONTRACT.md](docs/SIM_ERROR_CONFIRMATION_CONTRACT.md); chỉ là đề xuất, không được sử dụng làm nguồn cấp quyền.
- P29 ADMIN độc lập với confirmation; P30 không bật nhánh confirmed-error. Nhánh đơn COMPLETED cũng chờ module đơn có thật; không dựng module đơn ở Batch 07.

## Kiểm thử có thể chạy hiện tại

`apps/api/test/sim-error-policy.test.ts`: gọi trực tiếp các đường xác nhận không tồn tại; chặn gắn xác nhận qua PATCH; giá sai không ghi confirmation; timestamp cũ vẫn UNVERIFIED.

## Ca kiểm thử tương lai — NOT RUN

| Ca | Điều kiện trước khi thực hiện |
|---|---|
| Người đúng thẩm quyền xác nhận với bằng chứng hợp lệ | Quyết định quyền + evidence + endpoint/schema đã được duyệt |
| Người báo không tự duyệt nếu yêu cầu tách nhiệm vụ | Chốt có/không quy tắc tách nhiệm vụ |
| Xác nhận/bác bỏ/thu hồi và audit atomic | Chốt state machine và tác động khi thu hồi |
| STAFF xóa theo confirmation hợp lệ | Confirmation có provenance được backend xác minh, điều kiện hiệu lực được chốt |
| Đồng thời thu hồi confirmation và xóa SIM | Chốt thu hồi, khóa các bản ghi liên quan trong transaction |

Không đánh dấu các ca trên PASS từ kiểm thử giá sai hoặc timestamp đơn lẻ. Chỉ mở chức năng sau quyết định rõ ràng được ghi vào đặc tả cập nhật.
