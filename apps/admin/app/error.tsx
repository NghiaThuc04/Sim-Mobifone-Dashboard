'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="message-page"><h1>Chưa thể tải trang</h1><p>Kết nối có thể bị gián đoạn. Vui lòng thử lại.</p><button onClick={reset}>Thử lại</button></main>;
}
