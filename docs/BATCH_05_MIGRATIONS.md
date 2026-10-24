# Batch 05 — migrations và rollback

Áp dụng tuần tự sau khi backup riêng tư: `npm run db:generate`, `npm run db:migrate`, `npm run db:status`. API không tự migrate lúc khởi động. Không dùng db push/migrate reset trên dữ liệu hiện hữu.

- 006: employee_salaries, append-only lịch sử lương, thời điểm unique.
- 007: employee_leave_records + employee_leave_allocations, checksum phân bổ deferred trong transaction, chống trùng khoảng nghỉ.
- 008: carriers + sim_categories, code unique.
- 009: sims + SimStockStatus, partial unique số đang hoạt động (`deleted_at IS NULL`), FK RESTRICT, CHECK giá/trạng thái hiển thị/version.

Partial unique/CHECK/trigger do SQL migration sở hữu; không thay phone_number thành unique toàn bảng trong Prisma vì sẽ ngăn lưu lịch sử. Không dùng db push để tái tạo các ràng buộc này.

Rollback ưu tiên **đưa ứng dụng về bản trước và giữ các bảng bổ sung**; các bảng cũ không bị đổi dữ liệu. Trước rollback dừng writer, backup và xác minh bản phục hồi riêng; snapshot JSON hiện tại chưa phải quy trình restore production đã kiểm thử.

Prisma không chạy down migration tự động. Nếu cần đảo P20, tạo một migration tiến mới được review, chỉ khi sims rỗng, chưa có bảng giai đoạn sau tham chiếu và schema/app được đưa về trạng thái trước P20. SQL tham khảo cho migration mới, **không tự thực thi**:

```sql
BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM sims) THEN
    RAISE EXCEPTION 'Refuse rollback with existing SIM data';
  END IF;
END $$;
DROP TABLE sims; -- RESTRICT mặc định: dừng nếu có dependency chưa xử lý.
DROP TYPE "SimStockStatus";
COMMIT;
```

Không sửa lịch sử `_prisma_migrations`, không tự xóa bảng lương/nghỉ/catalog để quay về P15. Nếu đã có dữ liệu phải có phương án chuyển/khôi phục được chủ dự án duyệt trước. Rollback destructive và restore production chưa được chạy trong Batch này.

`version` chỉ là nền tảng cập nhật điều kiện; chưa có đặt/giữ SIM, đơn hàng, price history, nhập kho, Check SIM hoặc cảnh báo tự động. P21 phải ẩn SIM lỗi giá và tạo cảnh báo trong workflow riêng; CHECK hiển thị an toàn ở P20 không thay thế P21. Chưa có API public bán SIM để vượt điều kiện an toàn.
