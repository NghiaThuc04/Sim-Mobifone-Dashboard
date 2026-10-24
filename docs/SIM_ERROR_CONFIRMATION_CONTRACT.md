# Đề xuất contract trung lập — P28

**DRAFT / NON-EXECUTABLE / NOT AUTHORITY.** Không có migration hoặc endpoint đang hoạt động. Tên trường và trạng thái sau đây chỉ để chủ dự án duyệt; không đồng nghĩa nghiệp vụ đã chốt.

## Dữ liệu đề xuất

`sim_error_confirmations`: `id` UUID, `sim_id` FK RESTRICT, nguồn báo lỗi và tham chiếu nguồn, người báo, thời điểm báo; lý do, tham chiếu bằng chứng đã kiểm tra; quyết định, người quyết định, thời điểm và lý do quyết định. Chính sách nguồn, vai trò, bằng chứng và danh sách giá trị quyết định còn PENDING.

Các sự kiện quyết định nên append-only, có audit và ID liên kết; giữ chứng cứ khi SIM rời kho. Nếu cho phép thu hồi thì cần sự kiện riêng và quy tắc xác định quyết định có hiệu lực, không ghi đè lịch sử. Upload/bảo vệ dữ liệu bằng chứng chưa nằm trong batch này.

Không dùng `has_price_error`, `error_confirmed_at` đơn lẻ, checkbox client hoặc body `confirmed=true` để chứng minh confirmation hợp lệ. `sim_price_alerts` giữ nguyên mục đích cảnh báo giá, không đổi thành bảng confirmation.

## Biên cấp quyền tương lai

Backend phải lấy quyết định có hiệu lực từ nguồn server đã được duyệt và kiểm quyền tại thời điểm xóa. Cần transaction/lock chung với thay đổi confirmation để tránh sử dụng một quyết định vừa bị thu hồi. Chưa triển khai hàm cho phép nhận boolean `eligible` từ HTTP client.

Không trả bằng chứng riêng tư, actor nội bộ không cần thiết hoặc giá gốc cho STAFF. DTO phải whitelist; scope đọc evidence cần quyết định riêng. Audit không lưu mật khẩu, token hoặc toàn bộ upload.

## Điều kiện mở schema/API

1. Chủ dự án quyết định các câu hỏi trong `DECISION_SIM_ERROR.md`.
2. Cập nhật đặc tả và duyệt contract/state machine cụ thể.
3. Viết migration additive bảo toàn dữ liệu cũ; định nghĩa chính sách cho timestamp legacy (mặc định vẫn không đủ bằng chứng).
4. Triển khai authorization/validation/transaction/audit và chạy các ca NOT RUN đã liệt kê trước khi mở nhánh xóa.
