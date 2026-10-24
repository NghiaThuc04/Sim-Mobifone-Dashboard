# P31 — Quy trình STAFF đăng SIM

Trạng thái **PARTIAL / BLOCKED BY POLICY**. Nguồn: Master Spec v1.6 mục 3/5/15 và Batch 08 P31. Không phải quyết định thay chủ dự án.

| Câu hỏi cần chốt | Hiện tại |
|---|---|
| Nguồn số, quyền sở hữu và cách xác minh nguồn | Chưa chốt |
| Nhập từng số, file hay tích hợp; cột/định dạng/giới hạn | Chưa chốt; không mặc nhiên dùng mẫu CSV/XLSX ADMIN |
| Ai nhập giá gốc, STAFF được nhập trường giá nào | Chưa chốt; STAFF không được sửa/ghi giá kho |
| Có duyệt trước đăng, ai duyệt, trạng thái khi chờ | Chưa chốt |
| Xử lý số trùng, tái gửi và phản hồi từng dòng | Chưa chốt; uniqueness của kho hoạt động hiện tại vẫn giữ |

## Contract tạm

`POST /api/v1/admin/staff-sim-submissions` yêu cầu session, quyền `sims.create`, Origin đúng và JSON. Đây là chỗ tích hợp **NOT_IMPLEMENTED**, luôn trả HTTP 501 với DTO `StaffSimUploadUnavailable` (`code`, `status`, `message`, `pendingDecisions`). Không có DTO input nghiệp vụ được chấp nhận; mọi body đều không được dùng để ghi dữ liệu, kể cả gửi costPrice/role/approved. Không có endpoint duyệt hoặc lưu draft.

`sims.create` tiếp tục nằm trong ma trận hiện hữu; không thêm `sims.price.manage` hoặc chuyển quyền ADMIN sang STAFF. Các endpoint ADMIN create/PATCH/import vẫn chặn STAFF. Placeholder trong kho hiển thị khi STAFF còn quyền `sims.create`.

## Điều kiện mở chức năng — NOT RUN

Chủ dự án chốt các câu hỏi trên, cập nhật đặc tả và contract input/state machine. Sau đó mới thêm validation, schema cần thiết, quyền/nguồn giá, audit/transaction, kiểm tra trùng/idempotency và kiểm thử quy trình thật. Không coi test HTTP 501 là kiểm thử upload thành công.
