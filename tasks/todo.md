# P01 — Khởi tạo monorepo Dashboard

- [x] Đọc v1.6, P00, P01; xác minh Dashboard mới và P00 DONE.
- [x] Tạo npm workspaces apps/admin, apps/api, packages/shared; không sửa Home.
- [x] Tạo Next placeholder và Nest health, cấu hình install/dev/build/lint/test.
- [x] Install và đọc tài liệu Next phiên bản cài đặt; xử lý lỗi khởi tạo nếu có.
- [x] Build/typecheck/lint/test, khởi động dev/production và kiểm tra trình duyệt.
- [x] Review file thay đổi, README và báo cáo P01; giữ nguyên P00, dừng trước P02.

# Batch 02 — tuần tự P02 → P05

- [x] Đọc Master Spec v1.6, P02–P05 và audit scaffold P01.
- [x] P02: env validation, Prisma/PostgreSQL connector, DB health, Compose/hướng dẫn; 5/5 test, verify exit 0 trước P03.
- [x] P03: users ADMIN/STAFF, active/locked, migration và hash password; verify exit 0, 9/9 test trước P04.
- [x] P04: CLI init-admin an toàn/idempotent, hướng dẫn; verify exit 0, 14/14 test trước P05. Chủ dự án đã tạo Admin local, DB xác nhận ADMIN/active.
- [x] P05: login API, session cookie/TTL, brute force; verify exit 0, 27/27 test và regression. Kiểm tra phiên trên protected request thuộc P06/P07.
- [x] Review bảo mật, npm ci/full build/typecheck/lint/test, cập nhật README và BATCH_02_REPORT.md.
- [x] Dừng nghiệm thu; không làm P06–P10. Đã xác minh Admin local admin@khosimso.com sau khi chủ dự án chạy CLI.

# Batch 03 — tuần tự P06 → P10

- [x] Đọc v1.6, P06–P10 (trong New folder), source và báo cáo trước; baseline 27/27 test.
- [x] P06: me/logout/session validation; verify exit 0, 31/31 test trước P07. Browser Back sẽ kiểm ở P08.
- [x] P07: permissions/guards server-side; verify exit 0, 34/34 test trước P08.
- [x] P08: verify exit 0, 34/34 test; browser 10 routes/Admin, mobile 390px, tablet 768px, STAFF forbidden, logout/Back trước P09.
- [x] P09: immutable audit/migration/tích hợp hành động hiện có; verify exit 0, 37/37 test; snapshot riêng tư và migration local thành công trước P10.
- [x] P10: danh sách nhân viên chỉ đọc, filter/search/pagination ADMIN-only; verify exit 0, 42/42 test và kiểm tra UI.
- [x] Full verify, review thay đổi, README và BATCH_03_REPORT.md; launcher dev được sửa/khởi động kiểm chứng, dừng trước P11.

# Batch 04 — tuần tự P11 → P15

- [x] Đọc v1.6, P11–P15, source và báo cáo; baseline 42/42 test.
- [x] P11 tạo STAFF + form + audit; verify exit 0, 45/45 test.
- [x] P12 khóa/mở STAFF, thu hồi phiên + audit; verify exit 0, 48/48 test.
- [x] P13 reset mật khẩu STAFF, thu hồi phiên + audit; verify exit 0, 51/51 test.
- [x] P14 quyền cá nhân allowlist, guard/menu cập nhật + audit; verify exit 0, 54/54 test, browser form.
- [x] P15 chính sách tỷ lệ chính xác, lịch sử và lookup; verify 60/60, sửa timezone tại DB boundary và verify lại 61/61.
- [x] Browser 1440/768/390/320px, logout/Back, 27 proxy assertions, live DB digest giữ nguyên; review, README/BATCH_04_REPORT.md; local dev đã chạy lại. Dừng trước P16.







# Batch 05 — P16 → P20
- [x] Đọc yêu cầu/spec/prompts/báo cáo/schema, baseline 61/61; chốt phân bổ nghỉ từng tháng do ADMIN xác nhận.
- [x] P16: lương cứng có lịch sử hiệu lực; full verify exit 0, 65/65 test.
- [x] P17: nghỉ/phân bổ từng tháng, chống trùng; full verify exit 0, 70/70 test.
- [x] P18: self theo phiên/quyền; sửa lint DTO explicit, full verify 72/72 test.
- [x] P19: danh mục/CRUD; sửa mapping lỗi adapter raw SQL, verify exit 0, 75/75 test.
- [x] P20: schema SIM/constraints/test, sửa RESTRICT mapping; full verify exit 0, 81/81 test; không P21.
- [x] UI 1440/768/390/320px, 31 proxy assertions, ADMIN/STAFF logout/Back; snapshot + migration 006–009 local, digest cũ giữ nguyên/bảng mới trống; README/BATCH_05_REPORT.md và review source. Dev 3100/4200 chạy lại, fixture đã dừng; dừng P20.






# Batch 06 — P21 → P25
- [x] Audit spec/PROMPT_INDEX/source/P01–P20; baseline 81/81 và kế hoạch.
- [x] P21: pricing service/alerts/visibility/migration; verify exit 0, 84/84.
- [x] P22: API/DTO/UI kho + bộ chọn danh mục; sửa fixture unique và assertion API cũ, verify exit 0, 86/86.
- [x] P23: ADMIN tạo SIM/form/validation/audit, verify exit 0, 89/89.
- [x] P24: ADMIN edit/version/history/price alerts; tách default create khỏi PATCH và test bảo toàn, verify exit 0, 93/93. Integration order snapshot chưa thể xác minh vì chưa có module đơn.
- [x] P25: import CSV/XLSX, preview/mapping/chọn dòng/confirm, giới hạn/ZIP/NUL/idempotency; verify exit 0, 98/98.
- [x] UI 1440/768/390/320px, 28 proxy assertions; npm ci/final verify 98/98/audit 0; backup + migrate 010–012 local/digest giữ nguyên; README/BATCH_06_REPORT.md, dev 3100/4200 chạy lại; dừng P25.
- [ ] BLOCKED kiểm chứng riêng: UI outage bị automatic approval review chặn server phụ; không coi source review là runtime pass.
- [ ] BLOCKED kiểm chứng riêng: snapshot order/commission cũ, chờ module/schema đơn thực tế; không dựng thêm nghiệp vụ ở Batch 06.


# Batch 07 — P26 → P30 (chỉ phạm vi này)
- [x] Đọc spec/Batch 07, audit P21–P25; baseline 98/98; 12 migration current, không Git; hash/digest riêng tư.
- [x] P26: full verify exit 0, 100/100; UI production empty/error, ảnh đã lưu; giữ xử lý giá P21.
- [x] P27: full verify exit 0, 103/103; 18 Next proxy checks, UI loading/result/miss; nguồn đơn/xác nhận ghi unknown.
- [x] P28 phần an toàn: DECISION_SIM_ERROR.md/contract/fail-closed test; log trước ngắt kết nối full verify exit 0, 105/105. Xác nhận thực tế PARTIAL/BLOCKED chính sách, không bật endpoint.
- [x] P29: ADMIN xóa logic, removal log/transaction/version, UI xác nhận; build/typecheck/lint PASS. Gate ban đầu 110/111 do assertion version mới; sửa assertion, nhóm P29 đạt 6/6. UI và tích hợp cuối Batch bên dưới.
- [x] P30 phần an toàn: 2/2 test, STAFF fail-closed; COMPLETED/confirmation PARTIAL/BLOCKED vì thiếu nguồn. Không bật endpoint cho STAFF.
- [x] Review Astra độc lập: không finding P0–P2 trong source; giữ giới hạn coverage trong báo cáo.
- [x] Kiểm tra cuối theo yêu cầu khôi phục: full build/type/lint PASS, full test 112/113 rồi sửa riêng fixture P30 và nhóm 2/2 PASS; không chạy lại các nhóm đã PASS. P26/P27/P28/P29/P30 đều có test PASS tương ứng. 33 proxy checks, UI/responsive/STAFF, backup + chỉ migrate013, 15 digest cũ giữ nguyên. BATCH_07_REPORT.md, dừng P30.
- [ ] BLOCKED P28 xác nhận thực tế: cần nguồn/người xác nhận/bằng chứng/state machine được chủ dự án chốt.
- [ ] BLOCKED P27/P29/P30: thông tin đơn, bảo toàn snapshot đơn/hoa hồng, cho STAFF xóa theo COMPLETED hoặc confirmation có nguồn thật. Không triển khai P31 để vượt blocker.

# Batch 08 — P31 → P35 (ủy quyền mới, chỉ phạm vi này)
- [x] Đọc Batch 08/v1.6, kiểm tra Batch 07/source; ghi nhận PARTIAL/BLOCKED độc lập. DB 13 migration current; Dashboard không Git; lưu hash và bản source trước Batch.
- [x] P31 phần an toàn: quyết định upload/DTO/contract501/placeholder; build/typecheck/lint + 2/2 test PASS. Upload thật PARTIAL/BLOCKED chính sách.
- [x] P32: schema customer/order/item, snapshots bất biến/FK/index/constraints; build/typecheck/lint và 2/2 test PostgreSQL PASS. Migration014 mới chỉ áp trên test.
- [x] P33: reservation atomic/row lock, uniqueness SIM và số snapshot; contention/orphan/rollback/Admin remove + nhập lại cùng số: build/typecheck/lint + 4/4 PASS. Không TTL/release tự động.
- [x] P34: ADMIN-only/config mặc định false, không bật production; canonical UUID/idempotency/transaction/audit; build/typecheck/lint + 6/6 test PASS.
- [x] P35: API/UI read-only filters/projection/paging/giờ VN; build/typecheck/lint + 4/4 test PASS. Không nhận hoặc đổi trạng thái đơn.
- [x] Tích hợp cuối: từng Pxx PASS; full verify exit0 132/132/build/type/lint; 31 proxy checks, UI/loading/error/recovery/empty/responsive/STAFF. Backup + migrate014–016; 16 digest cũ giữ nguyên, 5 bảng mới trống. Fixture/lock test dừng, npm start local 3100/4200 HTTP200; BATCH_08_REPORT.md, review diff và dừng P35.
- [ ] BLOCKED P31 upload thật: nguồn/input/quyền giá/duyệt/trùng chưa chốt. Không dùng quy trình ADMIN cho STAFF.
- [ ] Carry-forward P28/P30 confirmation/eligibility; chưa mở lại trong Batch08. Hoa hồng/tài chính NOT RUN do chưa có module; không làm P36.



# Batch 09 — P36 → P40
- [x] Đọc Batch/spec v1.6/P35; DB16 migrations current; source snapshot301 file, baseline21 bảng; Dashboard không Git.
- [x] P36 build/type/lint + 1/1 API/DB PASS (`.local/batch09-p36-gate.log`); chi tiết chỉ đọc; gate build/type/lint/API.
- [x] P37 build/type/lint + 3/3 API/DB PASS;20 STAFF một winner/rollback/permission; claim atomic/history/audit; gate20 request.
- [x] P38 build/type/lint + 2/2 API/DB PASS; trạng thái provisional/ownership; gate.
- [x] P39 build/type/lint + 2/2 API/DB PASS; ADMIN chuyển owner/beneficiary unresolved; gate.
- [x] P40 build/type/lint + 3/3 API/DB PASS; completion/rate snapshot; gate.
- [ ] Astra review, integration/UI, kiểm tra dữ liệu, báo cáo và dừng P40.
