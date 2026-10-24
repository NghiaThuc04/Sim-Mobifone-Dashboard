import type { NextRequest } from 'next/server';
import { apiOrigin } from '../../../../lib/api-origin';
import { SIM_IMPORT_LIMITS } from '@sim-dashboard/shared';

const allowed = new Set(['GET auth/me', 'POST auth/login', 'POST auth/logout', 'GET admin/employees', 'POST admin/employees', 'GET me/leaves','GET admin/sims','POST admin/sims', 'GET admin/alerts/sim-pricing', 'GET admin/check-sim', 'POST admin/staff-sim-submissions', 'POST admin/internal-orders', 'GET admin/orders']);
export const dynamic = 'force-dynamic';

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const path = (await context.params).path.join('/');
  const orderAssign = request.method === 'POST' && /^admin\/orders\/[0-9a-f-]{36}\/assign$/i.test(path);
  const orderStatus = request.method === 'PATCH' && /^admin\/orders\/[0-9a-f-]{36}\/status$/i.test(path);
  const orderClaim = request.method === 'POST' && /^admin\/orders\/[0-9a-f-]{36}\/claim$/i.test(path);
  const orderDetail = request.method === 'GET' && /^admin\/orders\/[0-9a-f-]{36}$/i.test(path);
  const statusRoute = request.method === 'PATCH' && /^admin\/employees\/[0-9a-f-]{36}\/status$/i.test(path);
  const simRoute = ['GET','PATCH','DELETE'].includes(request.method) && /^admin\/sims\/[0-9a-f-]{36}$/i.test(path);
  const importPreview=request.method==='POST'&&path==='admin/sim-imports/preview';
  const importConfirm=request.method==='POST'&&/^admin\/sim-imports\/[0-9a-f-]{36}\/confirm$/i.test(path);
  const detailRoute = request.method === 'GET' && /^admin\/employees\/[0-9a-f-]{36}$/i.test(path);
  const resetRoute = request.method === 'POST' && /^admin\/employees\/[0-9a-f-]{36}\/reset-password$/i.test(path);
  const permissionsRoute = ['GET', 'PUT'].includes(request.method) && /^admin\/employees\/[0-9a-f-]{36}\/permissions$/i.test(path);
  const commissionRoute = ['GET', 'PUT'].includes(request.method) && /^admin\/employees\/[0-9a-f-]{36}\/commission-policy$/i.test(path);
  const salaryRoute = ['GET', 'PUT'].includes(request.method) && /^admin\/employees\/[0-9a-f-]{36}\/salary$/i.test(path);
  const leaveRoute = ['GET', 'POST'].includes(request.method) && /^admin\/employees\/[0-9a-f-]{36}\/leaves$/i.test(path);
  const catalogRoute = (['GET','POST'].includes(request.method) && /^admin\/catalogs\/(carriers|sim-categories)$/.test(path)) ||
    (['PUT','DELETE'].includes(request.method) && /^admin\/catalogs\/(carriers|sim-categories)\/[0-9a-f-]{36}$/i.test(path));
  if (!allowed.has(request.method + ' ' + path) && !orderAssign && !orderStatus && !orderClaim && !orderDetail && !importPreview && !importConfirm && !simRoute && !statusRoute && !detailRoute && !resetRoute && !permissionsRoute && !commissionRoute && !salaryRoute && !leaveRoute && !catalogRoute) return new Response(null, { status: 404 });
  const bodyLimit=importPreview?SIM_IMPORT_LIMITS.jsonBytes:importConfirm?SIM_IMPORT_LIMITS.confirmBytes:8192;
  let body: Uint8Array | undefined;
  if (['POST', 'PATCH', 'PUT','DELETE'].includes(request.method) && request.body) {
    const reader = request.body.getReader();
    const parts: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > bodyLimit) { await reader.cancel(); return Response.json({ message: 'Body quá lớn.' }, { status: 413 }); }
      parts.push(chunk.value);
    }
    body = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) { body.set(part, offset); offset += part.length; }
  }
  try {
    const upstream = await fetch(apiOrigin() + '/api/v1/' + path + request.nextUrl.search, {
      method: request.method, headers: {
        Cookie: request.headers.get('cookie') ?? '', Origin: request.headers.get('origin') ?? '',
        'Content-Type': request.headers.get('content-type') ?? '',
      }, body: body as BodyInit | undefined, cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(importPreview||importConfirm?65000:5000),
    });
    const headers = new Headers({ 'Cache-Control': 'no-store', 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' });
    for (const cookie of upstream.headers.getSetCookie()) headers.append('Set-Cookie', cookie);
    const retry = upstream.headers.get('retry-after');
    if (retry) headers.set('Retry-After', retry);
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch { return Response.json({ message: 'Dịch vụ tạm thời không khả dụng.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
