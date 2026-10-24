# File audit Batch 07

So với hash baseline `.local/batch07-baseline.json` trước P26. Bao gồm việc đã làm trước ngắt kết nối và phần tiếp tục; không có Git để tạo diff từng dòng. Không liệt kê generated/build/dependency/.env/.local.

## File có sẵn đã thay đổi

- `README.md`
- `apps/admin/app/api/v1/[...path]/route.ts`
- `apps/admin/app/globals.css`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/app.module.ts`
- `apps/api/src/audit/audit.service.ts`
- `apps/api/src/inventory/inventory.controller.ts`
- `apps/api/src/inventory/inventory.input.ts`
- `apps/api/src/inventory/inventory.service.ts`
- `apps/api/src/inventory/sim-write.repository.ts`
- `apps/api/test/sim-pricing.test.ts`
- `apps/api/test/sims.test.ts`
- `packages/shared/src/index.ts`
- `scripts/batch06-ui-api-check.mjs`
- `tasks/todo.md`

## File hiện có nhưng không nằm trong baseline

Không mặc nhiên coi mọi file dưới đây được tạo mới trong Batch. `.env.example`, `.gitignore`, `.nvmrc` đã tồn tại lúc khôi phục; baseline trước Batch không chứa hash của chúng, không đủ bằng chứng xác định thay đổi trước đó. Không sửa ba file này trong lượt tiếp tục. Những file triển khai mới có nguồn gốc cụ thể được mô tả trong BATCH_07_REPORT.md.

- `.env.example`
- `.gitignore`
- `.nvmrc`
- `BATCH_07_REPORT.md`
- `DECISION_SIM_ERROR.md`
- `apps/admin/app/admin/alerts/sim-pricing/page.tsx`
- `apps/admin/app/admin/check-sim/page.tsx`
- `apps/admin/components/remove-sim-action.tsx`
- `apps/api/prisma/migrations/202610240013_sim_removals/migration.sql`
- `apps/api/src/inventory/check-sim.controller.ts`
- `apps/api/src/inventory/check-sim.repository.ts`
- `apps/api/src/inventory/check-sim.service.ts`
- `apps/api/src/inventory/price-alerts.controller.ts`
- `apps/api/src/inventory/sim-removal.policy.ts`
- `apps/api/test/check-sim.test.ts`
- `apps/api/test/price-alerts.test.ts`
- `apps/api/test/sim-error-policy.test.ts`
- `apps/api/test/sim-remove-policy.test.ts`
- `apps/api/test/sim-remove.test.ts`
- `docs/BATCH_07_FILES.md`
- `docs/SIM_ERROR_CONFIRMATION_CONTRACT.md`
- `docs/screenshots/batch07-archived-alerts.png`
- `docs/screenshots/batch07-p26-empty.png`
- `docs/screenshots/batch07-p27-desktop.png`
- `docs/screenshots/batch07-p27-loading.txt`
- `docs/screenshots/batch07-remove-confirm-320.png`
- `docs/screenshots/batch07-remove-confirm-desktop.png`
- `docs/screenshots/batch07-remove-confirm-mobile.png`
- `docs/screenshots/batch07-remove-confirm-tablet.png`
- `docs/screenshots/batch07-remove-conflict.png`
- `docs/screenshots/batch07-remove-result.png`
- `docs/screenshots/batch07-staff-alerts-mobile.png`
- `docs/screenshots/batch07-staff-check-sim.png`
- `packages/shared/src/sim-inspection.ts`
- `scripts/batch07-removal-proxy-check.mjs`
- `scripts/batch07-ui-api-check.mjs`

## Baseline file không còn thấy trong tập đã quét

Không có.
