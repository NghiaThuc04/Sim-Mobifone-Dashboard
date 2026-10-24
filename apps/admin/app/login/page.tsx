import { redirect } from 'next/navigation';
import { currentAccount } from '../../lib/server-session';
import { LoginForm } from '../../components/login-form';

export default async function LoginPage() {
  if (await currentAccount()) redirect('/admin/dashboard');
  return <main className="login-page"><section className="login-story"><div className="brand"><span className="brand-symbol">S</span><span>SIM Management<small>KHÔNG GIAN QUẢN TRỊ</small></span></div><div><span className="eyebrow">MỘT KHÔNG GIAN. MỌI KẾT NỐI.</span><h1>Quản lý tập trung.<br />Vận hành rõ ràng.</h1><p>Không gian làm việc riêng dành cho đội ngũ quản lý và nhân viên.</p><div className="login-illustration" aria-hidden="true"><div className="illustration-card"><span>SIM</span><i /></div><div className="illustration-ring" /></div></div><small>SIM Management Dashboard · Truy cập nội bộ</small></section><section className="login-form-panel"><div className="login-form-wrap"><span className="status-badge">CỔNG TRUY CẬP NỘI BỘ</span><h2>Chào mừng trở lại</h2><p>Đăng nhập bằng tài khoản đã được cấp.</p><LoginForm /><div className="login-help">Cần hỗ trợ tài khoản? Liên hệ quản trị viên của bạn.</div></div></section></main>;
}
