import Link from 'next/link';
import { CatalogList,PERMISSIONS } from '@sim-dashboard/shared';
import { requireAccount } from '../../../lib/server-session';
import { serverApiRequest,redirectForAuthError } from '../../../lib/server-api';
import { CatalogManager } from '../../../components/catalog-manager';
export default async function CatalogPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  await requireAccount(PERMISSIONS.SETTINGS_ADMIN);const query=await searchParams;
  const requestQuery=(key:string)=>{const params=new URLSearchParams();const value=query[key];if(Array.isArray(value))value.forEach((item)=>params.append('page',item));else if(value)params.set('page',value);return params.toString();};
  const results=await Promise.all([serverApiRequest<CatalogList>('/admin/catalogs/carriers?'+requestQuery('carrierPage')),serverApiRequest<CatalogList>('/admin/catalogs/sim-categories?'+requestQuery('categoryPage'))]);
  results.forEach((result)=>redirectForAuthError(result.error));
  return <><div className="page-heading"><div><span className="eyebrow">DỮ LIỆU THAM CHIẾU</span><h1>Danh mục SIM</h1><p>Nhà mạng và loại SIM do Admin quản lý. Chưa có phân loại hoặc định giá tự động.</p></div><span className="status-badge">Chỉ ADMIN</span></div>
    <div className="employee-management-grid">{results.map((result,index)=>result.error ? <div key={index} role="alert" className="inline-error">{result.error} <Link href="/admin/catalogs" prefetch={false}>Thử lại</Link></div>:result.data && <CatalogManager key={index} kind={index===0?'carriers':'sim-categories'} title={index===0?'Nhà mạng':'Loại SIM'} pageKey={index===0?'carrierPage':'categoryPage'} result={result.data} />)}</div></>;
}
