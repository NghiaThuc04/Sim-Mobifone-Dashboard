import Link from 'next/link';
export default function MissingOrder() { return <><h1>Không tìm thấy đơn hàng</h1><Link href="/admin/orders">Về danh sách đơn</Link></>; }
