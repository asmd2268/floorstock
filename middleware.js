import { NextResponse } from 'next/server';

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };

const ALLOWED_COUNTRIES = new Set(['SA']);

const BLOCK_HTML = `<!doctype html><html lang="ar" dir="rtl">
<head><meta charset="utf-8"><title>غير متاح / Not Available</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
    font-family:Arial,Tahoma,sans-serif;background:#0d1117;color:#e6edf3}
  .card{max-width:480px;text-align:center;padding:48px 32px;
    background:#161b22;border:1px solid #30363d;border-radius:16px}
  .icon{font-size:56px;margin-bottom:16px}
  h1{font-size:22px;margin:0 0 12px;color:#f0f6fc}
  p{font-size:14px;color:#8b949e;line-height:1.6;margin:0}
</style>
</head>
<body><div class="card">
  <div class="icon">🇸🇦</div>
  <h1>هذا الموقع متاح داخل المملكة العربية السعودية فقط</h1>
  <p>This service is only available inside the Kingdom of Saudi Arabia.<br>
  يُرجى الاتصال بالمسؤول إذا كنت تعتقد أن هذا خطأ.</p>
</div></body></html>`;

export default function middleware(request) {
  const country = request.headers.get('x-vercel-ip-country') || '';
  if (country && !ALLOWED_COUNTRIES.has(country)) {
    return new NextResponse(BLOCK_HTML, {
      status: 403,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
  return NextResponse.next();
}
