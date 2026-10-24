# File audit Batch 08

So với `.local/batch08-baseline.json` và bản copy trước sửa; Dashboard không có Git. Không liệt kê .local/.env/dependencies/build/generated. Diff nội dung file có sẵn lưu riêng tại `.local/batch08-changes.patch`.

## Đã sửa

- `.env.example`
- `README.md`
- `apps/admin/app/admin/check-sim/page.tsx`
- `apps/admin/app/admin/inventory/page.tsx`
- `apps/admin/app/api/v1/[...path]/route.ts`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/app.module.ts`
- `apps/api/src/audit/audit.service.ts`
- `apps/api/src/common/calendar.ts`
- `apps/api/src/config.ts`
- `apps/api/test/employee-permissions.test.ts`
- `apps/api/test/health.test.ts`
- `apps/api/test/helpers/http-fixture.ts`
- `packages/shared/src/index.ts`
- `scripts/backup-local.mjs`
- `tasks/todo.md`

## Đã thêm

- `BATCH_08_REPORT.md`
- `STAFF_UPLOAD_DECISIONS.md`
- `apps/admin/app/admin/orders/page.tsx`
- `apps/api/prisma/migrations/202610240014_orders/migration.sql`
- `apps/api/prisma/migrations/202610240015_reservations/migration.sql`
- `apps/api/prisma/migrations/202610240016_order_create_keys/migration.sql`
- `apps/api/src/inventory/staff-sim-submissions.controller.ts`
- `apps/api/src/orders/order-create.controller.ts`
- `apps/api/src/orders/order-create.repository.ts`
- `apps/api/src/orders/order-create.service.ts`
- `apps/api/src/orders/orders.controller.ts`
- `apps/api/src/orders/orders.input.ts`
- `apps/api/src/orders/orders.repository.ts`
- `apps/api/src/orders/orders.service.ts`
- `apps/api/src/orders/reservations.service.ts`
- `apps/api/test/calendar.test.ts`
- `apps/api/test/helpers/order-data.ts`
- `apps/api/test/order-create.test.ts`
- `apps/api/test/order-schema.test.ts`
- `apps/api/test/orders-list.test.ts`
- `apps/api/test/reservations.test.ts`
- `apps/api/test/staff-sim-upload.test.ts`
- `docs/BATCH_08_FILES.md`
- `docs/INTERNAL_ORDERS.md`
- `docs/screenshots/batch08-orders-320.png`
- `docs/screenshots/batch08-orders-admin-desktop.png`
- `docs/screenshots/batch08-orders-empty.png`
- `docs/screenshots/batch08-orders-error.png`
- `docs/screenshots/batch08-orders-filter.png`
- `docs/screenshots/batch08-orders-loading.txt`
- `docs/screenshots/batch08-orders-mobile.png`
- `docs/screenshots/batch08-orders-pagination.png`
- `docs/screenshots/batch08-orders-recovered.png`
- `docs/screenshots/batch08-orders-service-error.png`
- `docs/screenshots/batch08-orders-staff.png`
- `docs/screenshots/batch08-orders-tablet.png`
- `docs/screenshots/batch08-staff-upload-placeholder.png`
- `packages/shared/src/orders.ts`
- `packages/shared/src/staff-sim-upload.ts`
- `scripts/batch08-ui-api-check.mjs`

## Không còn thấy

Không có.
