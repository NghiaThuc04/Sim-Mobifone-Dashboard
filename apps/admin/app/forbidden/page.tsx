import Link from 'next/link';
export default function ForbiddenPage() {
  return <main className="message-page"><span className="status-badge">403 · KHÔNG ĐỦ QUYỀN</span><h1>Bạn chưa có quyền truy cập</h1><p>Trang này chỉ dành cho tài khoản được phân quyền phù hợp.</p><Link href="/admin/dashboard" prefetch={false}>Về Tổng quan →</Link></main>;
}
