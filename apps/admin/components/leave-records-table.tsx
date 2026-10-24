import type { LeaveRecord } from '@sim-dashboard/shared';
type Row = Pick<LeaveRecord, 'id' | 'fromDate' | 'toDate' | 'days' | 'daysInMonth' | 'reason' | 'notes'>;
export function LeaveRecordsTable({ items }: { items: Row[] }) {
  return items.length ? <div className="table-scroll"><table><thead><tr><th>Từ ngày → đến ngày</th><th>Ngày xác nhận tháng này</th><th>Tổng ngày của đợt</th><th>Lý do</th><th>Ghi chú cho nhân viên</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{item.fromDate} → {item.toDate}</td><td>{item.daysInMonth}</td><td>{item.days}</td><td className="wrap-cell">{item.reason}</td><td className="wrap-cell">{item.notes || '—'}</td></tr>)}</tbody></table></div> : <p>Không có ngày nghỉ được ghi nhận trong tháng này.</p>;
}
