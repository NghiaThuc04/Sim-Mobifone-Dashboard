import type { DashboardModule } from '@sim-dashboard/shared';

export function ModulePlaceholder({ module }: { module: DashboardModule }) {
  return <>
    <div className="page-heading"><div><span className="eyebrow">KHÔNG GIAN LÀM VIỆC</span><h1>{module.label}</h1><p>{module.description}</p></div><span className="status-badge">Chưa triển khai</span></div>
    <section className="empty-panel"><div className="placeholder-graphic" aria-hidden="true"><span /><span /><span /></div><span className="eyebrow">SẴN SÀNG CHO BƯỚC TIẾP THEO</span><h2>Không gian này đang được chuẩn bị</h2><p>Chức năng {module.label.toLowerCase()} sẽ được bổ sung theo từng bước triển khai đã thống nhất.</p><div className="empty-note">Chưa có dữ liệu nghiệp vụ được hiển thị tại đây.</div></section>
  </>;
}
