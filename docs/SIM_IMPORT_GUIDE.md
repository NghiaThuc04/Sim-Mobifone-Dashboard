# Nhập kho SIM — ADMIN

Mở Kho SIM → Import SIM CSV/XLSX. Tạo nhà mạng và loại SIM trong Danh mục SIM trước; lấy **code**, không dùng tên hoặc ID trong file.

1. Chọn CSV UTF-8 phân cách bằng dấu phẩy hoặc XLSX, Upload và xem cột. CSV hỗ trợ BOM, ô được quote và xuống dòng trong ô. XLSX chọn sheet rồi bấm Đọc sheet đã chọn nếu cần.
2. Mapping 5 cột bắt buộc: số SIM, mã nhà mạng, mã loại SIM, giá gốc và giá bán. Hai cột tùy chọn là tồn kho và ý định hiển thị. Mỗi cột chỉ mapping một trường.
3. Kiểm tra dữ liệu theo mapping. Xem lỗi của từng dòng; chưa ghi SIM vào kho ở bước preview.
4. Chọn rõ các dòng hợp lệ muốn nhập. Dòng giá bán ≤ giá gốc có thể được chọn nhưng phải tích xác nhận nhập ở trạng thái ẩn. Không tự xác nhận SIM lỗi đủ điều kiện xóa.
5. Xác nhận import. Báo cáo từng dòng: IMPORTED, FAILED hoặc SKIPPED. FAILED gồm các dòng lỗi trong file và các xung đột mới xuất hiện lúc xác nhận; SKIPPED là dòng hợp lệ không được chọn. Tổng ba nhóm bằng tổng số bản ghi dữ liệu được đọc.

Số SIM phải là **Text** trong Excel. Nếu Excel đã lưu thành số và làm mất số 0, hệ thống từ chối dòng đó; không tự thêm số 0 hoặc suy đoán độ dài. Giá nhận Text decimal chính xác, không dấu phân cách hàng nghìn; ô số Excel chỉ nhận số nguyên an toàn dưới 10^15. Phần thập phân/giá lớn cần Text. Không chấp nhận công thức, lỗi ô, ngày hoặc object Excel tại cột được mapping. Không thực thi công thức hoặc macro. Header/dữ liệu luôn hiển thị dạng text, không HTML.

Ví dụ cấu trúc (các mã và số dưới chỉ minh họa định dạng, không được seed vào database):

```csv
phone,carrier,category,cost,price,status,visible
0012345678,ma-nha-mang-cua-ban,ma-loai-sim-cua-ban,70000,100000,AVAILABLE,false
```

Không mapping tồn kho thì mặc định AVAILABLE; không mapping hiển thị thì mặc định false. Nếu mapping: tồn kho chỉ AVAILABLE/RESERVED/SOLD, hiển thị chỉ true/false. Giá không âm, tối đa 35 chữ số nguyên và 30 chữ số thập phân. Dòng lỗi giá được chấp nhận nhập luôn bị ẩn bất kể cột visible.

## Giới hạn và tính nhất quán

- File tối đa **512 KiB**, **500 bản ghi dữ liệu**, **30 cột**, **1.000 ký tự/ô**; XLSX tối đa 10 sheet, ZIP tối đa 200 entry và tổng sau giải nén 10 MiB. File hỏng/mã hóa, định dạng khác, archive có macro bị từ chối. Giới hạn là biện pháp tài nguyên, không phải quy tắc kinh doanh.
- Dòng đánh số từ 2 sau header; CSV dùng số thứ tự bản ghi logic, không phải số dòng vật lý khi có ô nhiều dòng. Bỏ các bản ghi hoàn toàn rỗng. XLSX đánh số theo vị trí hàng; header ở hàng 1.
- Preview có hiệu lực **30 phút**, thuộc Admin đã tạo; tối đa 5 preview chưa xác nhận mỗi Admin. Preview hết hạn chưa xác nhận được dọn khi Admin đó tạo preview mới. Đổi file/mapping cần kiểm tra lại, không sửa payload đã lưu từ client.
- Khi xác nhận: khóa batch, kiểm tra lại tham chiếu/unique trong DB và tạo SIM + cảnh báo + audit trong transaction. Xung đột số mới phát sinh được báo FAILED theo dòng; lỗi hạ tầng/audit rollback toàn bộ batch.
- Xác nhận lại cùng batch/cùng lựa chọn trả kết quả đã lưu, không tạo SIM hoặc audit lần hai; lựa chọn khác trả 409. Nếu kết nối gián đoạn, giữ nguyên lựa chọn và thử lại để nhận kết quả đó, không upload lại theo phỏng đoán.
- Không có cập nhật/ghi đè SIM trùng khi import. Sửa SIM phải dùng form quản trị riêng và version hiện tại.
- Upload truyền JSON base64 qua proxy nội bộ; không ghi file upload vào filesystem hoặc gọi dịch vụ bên ngoài. Body lớn chỉ được phép ở hai route import; auth và route khác vẫn giới hạn 8 KiB. Không cung cấp API public bán SIM trong Batch này.

## Triển khai và phụ thuộc

Parser sử dụng [ExcelJS](https://github.com/exceljs/exceljs), [csv-parse](https://csv.js.org/parse/options/) với cast=false và [yauzl](https://github.com/thejoshwolfe/yauzl) với lazyEntries/validateEntrySizes. ZIP được kiểm tổng metadata và tổng byte thực trước khi ExcelJS đọc workbook. Dependency đã pin trong lockfile; overrides chỉ vá multer và uuid, không hạ cấp NestJS. Kiểm chứng audit và compatibility ở BATCH_06_REPORT.md.

Chưa có hàng đợi import nền hoặc thử tải nhiều Admin đồng thời. Chỉ vận hành nội bộ theo giới hạn hiện tại; không coi test 500 dòng là bằng chứng chịu tải production. Không nhập dữ liệu thật trước khi chủ dự án nghiệm thu và tự cung cấp file phù hợp.
