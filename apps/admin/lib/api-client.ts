export class ApiError extends Error {
  constructor(readonly status: number,readonly fields:Record<string,string>={}) { super('Yêu cầu không thành công.'); }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch('/api/v1' + path, { ...options, credentials: 'include', cache: 'no-store' });
  if (!response.ok) {
    const body:unknown=await response.json().catch(()=>null);
    const fields:Record<string,string>={};
    if(body&&typeof body==='object'&&'fields'in body&&body.fields&&typeof body.fields==='object')for(const [key,value]of Object.entries(body.fields)){if(typeof value==='string')fields[key]=value;}
    throw new ApiError(response.status,fields);
  }
  return response.status === 204 ? undefined as T : await response.json() as T;
}
