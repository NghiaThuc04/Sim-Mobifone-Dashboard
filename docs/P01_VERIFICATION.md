# P01 — Khởi tạo monorepo Dashboard

**Hoàn tất kiểm chứng: 24/10/2026, Asia/Saigon. Phạm vi: chỉ P01.** Các bước install và kiểm tra production/mobile đầu tiên được thực hiện trong phiên 23/10; build/typecheck/lint/test được chạy lại thành công ngày 24/10.

## 1. Đầu vào và quyết định khởi tạo

- P00 đã DONE, xác minh từ `GAP_ANALYSIS.md`. Giữ nguyên file và SHA256 `AA27187EF81E85AFE99DCF373A3066B498939ACEBE3922586FA667EA7EBBAE71`.
- Đã đọc đầy đủ Master Spec v1.6 và prompt P01. Master Spec hiện nằm trong `C:/Users/nghia/Downloads/SIM_Dashboard_Prompts_Tung_Chuc_Nang_v1.6/SIM_Dashboard_Prompts_v1.6/`, thay vì đường dẫn Downloads cũ ghi trong P00. SHA256 vẫn là `2B7EA72F62CFD10E23043979C89C2B377194B53687743974F672B55D80FC9BA4`.
- Dashboard chỉ có README và placeholder P00, chưa có app để bảo toàn kiến trúc. Theo chỉ dẫn P01 của chủ dự án, khởi tạo **Next.js 16.4.3 + TypeScript** cho Admin và **NestJS 12.2.0 + TypeScript** cho API.
- Npm workspaces tối thiểu, Node 24.21.0/npm 11.19.0, một lockfile. Không thêm Turborepo, ORM, DB driver, auth hay mô hình nghiệp vụ.
- Toàn bộ file P01 nằm trong `SimMobile/Dashboard-Sim-Mobi`. Không sửa hoặc kết nối backend/database/source của `Home-Sim-Mobi`.

## 2. Cấu trúc cuối

```text
Dashboard-Sim-Mobi/
├── apps/
│   ├── admin/
│   │   ├── app/admin/dashboard/page.tsx
│   │   ├── app/layout.tsx, app/page.tsx, app/globals.css
│   │   ├── package.json, tsconfig.json, next.config.ts
│   │   ├── AGENTS.md         Next dev tự sinh
│   │   └── next-env.d.ts     Next tự sinh, Git ignore
│   └── api/
│       ├── src/app.module.ts, src/create-app.ts
│       ├── src/health.controller.ts, src/main.ts
│       ├── test/health.test.ts
│       └── package.json, tsconfig.json
├── packages/shared/
│   ├── src/index.ts
│   └── package.json, tsconfig.json
├── docs/P01_VERIFICATION.md, docs/screenshots/
├── tasks/todo.md
├── GAP_ANALYSIS.md          Không đổi
├── package.json, package-lock.json
├── tsconfig.base.json, eslint.config.mjs
├── .gitignore, .nvmrc, README.md
└── src/                    Thư mục rỗng cũ, không được build hoặc dùng
```

`node_modules`, `.next`, `dist` và `*.tsbuildinfo` là output/cache, đã Git ignore. Dashboard chưa có Git repository độc lập; không báo git diff sạch hoặc commit/push khi chưa có repo.

## 3. Danh sách file tạo/chỉnh sửa

Đường dẫn dưới tính từ root Dashboard.

| Loại | File | Mục đích |
|---|---|---|
| Tạo | `package.json`, `package-lock.json` | Ba npm workspace, dependency khóa phiên bản, scripts install/dev/build/lint/test |
| Tạo | `.gitignore`, `.nvmrc`, `tsconfig.base.json`, `eslint.config.mjs` | Bỏ output/secret khỏi Git, toolchain và kiểm tra TypeScript/Next |
| Tạo | `apps/admin/package.json`, `apps/admin/tsconfig.json`, `apps/admin/next.config.ts` | Next App Router và transpile package shared trong monorepo |
| Tạo | `apps/admin/app/layout.tsx`, `apps/admin/app/page.tsx` | Layout tối thiểu và chuyển `/` sang `/admin/dashboard` |
| Tạo | `apps/admin/app/admin/dashboard/page.tsx`, `apps/admin/app/globals.css` | Placeholder responsive, không KPI hoặc dữ liệu kinh doanh giả |
| Tự sinh bởi Next | `apps/admin/next-env.d.ts`, `apps/admin/AGENTS.md` | Kiểu Next và hướng dẫn agent theo phiên bản; giữ AGENTS, ignore next-env |
| Tạo | `apps/api/package.json`, `apps/api/tsconfig.json` | Build/watch/start Nest bằng TypeScript compiler |
| Tạo | `apps/api/src/app.module.ts`, `apps/api/src/create-app.ts`, `apps/api/src/main.ts` | Bootstrap Nest, prefix API, bind localhost và shutdown hooks |
| Tạo | `apps/api/src/health.controller.ts`, `apps/api/test/health.test.ts` | Health cơ bản và kiểm thử HTTP thực |
| Tạo | `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/src/index.ts` | Chỉ contract/constant health, dùng trong hai app |
| Sửa | `README.md` | Cài đặt/chạy local, cấu trúc, lệnh, giới hạn và điểm dừng P01 |
| Tạo | `tasks/todo.md`, `docs/P01_VERIFICATION.md` | Tiến độ và kết quả nghiệm thu |
| Tạo | `docs/screenshots/p01-desktop.png`, `docs/screenshots/p01-mobile.png` | Ảnh kiểm tra placeholder |
| Bỏ file placeholder cũ | `src/.gitkeep` | Đã có apps/admin thực; root src rỗng không dùng. Không xóa dữ liệu/source nghiệp vụ |

Không chỉnh `GAP_ANALYSIS.md`, không tạo migration/schema/seed hoặc file chức năng P02.

## 4. Hành vi đã xây

- Admin `/` chuyển tới `/admin/dashboard`, trang ghi rõ chỉ là khung khởi tạo, chưa có dữ liệu nghiệp vụ.
- `GET /api/v1/health` trả HTTP 200, JSON `{"status":"ok"}`, `Cache-Control: no-store`. Đây là health của tiến trình, không kiểm tra DB.
- API bind `127.0.0.1`, mặc định port 4200; biến PORT của process được kiểm tra kiểu số nguyên/phạm vi. Admin dùng 127.0.0.1:3100, không chiếm cổng Home 5180/4110.
- Root scripts build theo shared → API → Admin; dev build shared/API trước rồi chạy Next, Node watch và TypeScript watch bằng concurrently.
- Typecheck Admin có `next typegen` trước `tsc --noEmit`, không phụ thuộc việc đã chạy Next build trước đó.
- Không endpoint SIM/đơn/nhân viên/tài chính, không tài khoản/mật khẩu mặc định, không database và không API từ website tham chiếu. Chưa có auth/RBAC là đúng phạm vi P01, không phải chức năng đã nghiệm thu.

## 5. Kết quả kiểm tra thực tế

| Kiểm tra | Kết quả |
|---|---|
| `npm install` và `npm ci` với lockfile cuối | Đạt; npm ci kiểm tra khả năng cài lại các workspace |
| `npm ls --depth=0` | Đạt, ba workspace liên kết đúng, không còn cây dependency invalid |
| `npm run build` | Đạt: shared/API TypeScript và Next production build; routes `/`, `/_not-found`, `/admin/dashboard` |
| `npm run typecheck` | Đạt cả ba workspace; route typegen thành công |
| `npm run lint` | Đạt, ESLint 10 + TypeScript recommended + Next recommended/Core Web Vitals, max-warnings=0 |
| `npm test` | **2/2 test HTTP đạt**, không dùng DB |
| `npm run verify` lần kiểm tra cuối 24/10 | **Exit 0**: build + typecheck + lint + test |
| `npm start`, production local | Đã khởi động cả Next/Nest; `/` redirect 307/308 đúng location, placeholder HTTP 200, health HTTP 200 đúng JSON. Đã dừng nhóm production sau kiểm tra |
| `npm run dev` | Đang chạy local để review; kiểm tra lại ngày 24/10: placeholder và health HTTP 200, health JSON đúng, cả hai cổng bind 127.0.0.1 |
| Trình duyệt desktop | Placeholder hiển thị đúng, không có dữ liệu mẫu; kiểm tra lại 1440px ngày 24/10: scrollWidth = innerWidth = 1440, ảnh desktop đã cập nhật |
| Trình duyệt 390px và 320px | Không tràn ngang; đã trả viewport về mặc định sau kiểm tra |
| Baseline P00 | SHA256 khớp trước/sau P01 |

Hai test kiểm tra health response/status/no-store và 404 trên các đường dẫn nghiệp vụ chưa xây. Không suy rộng thành test auth, database, tài chính hoặc các tiêu chí Dashboard v1.6 thuộc prompt sau. Admin được kiểm tra bằng build và quan sát trình duyệt, chưa có bộ test UI tự động.

## 6. Lỗi đã xử lý và giới hạn

- ESLint 9 ban đầu cài được nhưng đã bị cảnh báo hết hỗ trợ. Khi thử ESLint 10 cùng `eslint-config-next`, lint chạy được nhưng `npm ls` báo `ELSPROBLEMS` do peer constraints của các plugin React/import/a11y chưa khai báo ESLint 10.
- Đã thay riêng cấu hình khởi tạo bằng plugin chính thức `@next/eslint-plugin-next@16.4.3` trực tiếp cùng `typescript-eslint@8.72.0`, giữ rules Next recommended/Core Web Vitals. Loại bộ config gây xung đột, không dùng `--force`, `--legacy-peer-deps` hoặc tắt lint/test. Sau đó cài lại bằng npm ci, npm ls và verify đều đạt.
- Rà soát cuối đã bỏ dependency `@nestjs/testing` không dùng vì test HTTP sử dụng Node test runner và app Nest thực. Sau cập nhật lockfile, chạy lại API build, 2 test HTTP, lint và npm ls đều đạt. Không thay đổi mã nguồn ứng dụng sau lần full verify.
- Đường dẫn Master Spec cũ không tồn tại; đã tìm được bản cùng hash trong bộ prompt v1.6, không tự dùng đặc tả khác.
- Không có lỗi build/lint/test chưa xử lý tại thời điểm báo cáo. Framework AGENTS/next-env tự sinh được giữ đúng vai trò; root src rỗng cũ không ảnh hưởng ứng dụng.
- Chưa chạy Docker/deploy, chưa có DB, tài khoản, phân quyền hoặc kết nối Home. Không tuyên bố sẵn sàng vận hành Dashboard nghiệp vụ.

Đã đối chiếu tài liệu cài đặt [Next.js](https://nextjs.org/docs/app/getting-started/installation), [NestJS](https://docs.nestjs.com/first-steps), đồng thời đọc tài liệu Next 16.4.3 đóng gói trong `node_modules/next/dist/docs/`, đặc biệt cấu hình ESLint trực tiếp và `next typegen`. Không dựa vào cú pháp Next lint cũ đã bị loại bỏ.

## 7. Nghiệm thu và điều kiện P02

**P01 hoàn tất trong phạm vi khung dự án. Dừng tại đây để chủ dự án nghiệm thu.**

Để bắt đầu P02: chủ dự án review README, placeholder, health và kết quả lệnh, rồi giao P02. Khi đó mới đọc/áp dụng các yêu cầu môi trường và database của P02, chuẩn bị quyền/thông số kết nối phù hợp; không tự sử dụng secret hoặc database Home. Các quy tắc nghiệp vụ còn mở trong v1.6 vẫn chưa được tự chốt.

Ảnh bằng chứng: [desktop](screenshots/p01-desktop.png), [mobile](screenshots/p01-mobile.png).
