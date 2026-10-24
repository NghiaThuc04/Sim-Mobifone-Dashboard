import { BadRequestException } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { parse } from 'csv-parse/sync';
import { fromBuffer,type Entry } from 'yauzl';
import { SIM_IMPORT_LIMITS as limits } from '@sim-dashboard/shared';
export type ImportCell={text:string;kind:'text'|'number'|'unsupported'};
export type ImportSheet={columns:string[];rows:{row:number;cells:ImportCell[]}[];sheets:string[]};

async function validateZip(buffer:Buffer) {
 await new Promise<void>((resolve,reject)=>fromBuffer(buffer,{lazyEntries:true,validateEntrySizes:true,strictFileNames:true,autoClose:true},(error,zip)=>{
  if(error){reject(error);return;}let entries=0;let declared=0;let actual=0;
  const fail=(error:unknown)=>{zip.close();reject(error);};zip.on('error',fail);zip.on('end',resolve);
  zip.on('entry',(entry:Entry)=>{
   if(++entries>limits.zipEntries||(declared+=entry.uncompressedSize)>limits.uncompressedBytes||(entry.generalPurposeBitFlag&1)||/vbaProject\.bin$/i.test(entry.fileName)){fail(new Error('Unsupported archive.'));return;}
   if(entry.fileName.endsWith('/')){zip.readEntry();return;}
   zip.openReadStream(entry,(error,stream)=>{
    if(error||!stream){fail(error);return;}
    (async()=>{for await(const chunk of stream){actual+=(chunk as Buffer).length;if(actual>limits.uncompressedBytes){stream.destroy();throw new Error('Expanded workbook exceeds limit.');}}zip.readEntry();})().catch(fail);
   });
  });zip.readEntry();
 }));
}

export async function parseImportFile(filename:string,buffer:Buffer,sheetIndex:number):Promise<ImportSheet> {
 try {
  if(!buffer.length||buffer.length>limits.fileBytes)throw new Error('File size limit.');
  let matrix:ImportCell[][];let sheets:string[];
  if(/\.csv$/i.test(filename)) {
   if(sheetIndex!==0)throw new Error('Invalid CSV sheet.');
   const text=new TextDecoder('utf-8',{fatal:true}).decode(buffer);
   const rows:unknown=parse(text,{bom:true,cast:false,skip_empty_lines:true,max_record_size:65536,relax_column_count:true});
   if(!Array.isArray(rows)||rows.some(row=>!Array.isArray(row)||row.some(cell=>typeof cell!=='string')))throw new Error('Invalid CSV.');
   matrix=(rows as string[][]).map(row=>row.map(text=>({text,kind:'text'})));sheets=['CSV'];
  }else if(/\.xlsx$/i.test(filename)) {
   if(buffer.readUInt32LE(0)!==0x04034b50)throw new Error('Invalid XLSX signature.');await validateZip(buffer);
   const workbook=new Workbook();await workbook.xlsx.load(Uint8Array.from(buffer).buffer);
   if(workbook.worksheets.length>10)throw new Error('Too many worksheets.');sheets=workbook.worksheets.map(sheet=>sheet.name);
   const sheet=workbook.worksheets[sheetIndex];if(!sheet||sheet.rowCount>limits.rows+1||sheet.columnCount>limits.columns)throw new Error('Worksheet size limit.');
   matrix=[];
   for(let row=1;row<=sheet.rowCount;row++) {
    const cells:ImportCell[]=[];
    for(let column=1;column<=sheet.columnCount;column++) {
     const value=sheet.getRow(row).getCell(column).value;
     if(value===null||value===undefined)cells.push({text:'',kind:'text'});
     else if(typeof value==='string')cells.push({text:value,kind:'text'});
     else if(typeof value==='number'&&Number.isSafeInteger(value)&&Math.abs(value)<1e15)cells.push({text:String(value),kind:'number'});
     else cells.push({text:'[Công thức hoặc kiểu ô không hỗ trợ; hãy dùng Text]',kind:'unsupported'});
    }matrix.push(cells);
   }
  }else throw new Error('Unsupported file type.');
  if(matrix.length<2||matrix.length>limits.rows+1||!matrix[0].length||matrix.some(row=>row.length>limits.columns||row.some(cell=>cell.text.length>limits.cellCharacters)))throw new Error('File size/shape limit.');
  matrix=matrix.map(row=>row.map(cell=>cell.text.includes('\u0000')?{text:'[Ô chứa NUL không hỗ trợ]',kind:'unsupported' as const}:cell));
  const width=Math.max(...matrix.map(row=>row.length));
  if(matrix[0].some(cell=>cell.kind==='unsupported'))throw new Error('Unsupported header.');
  return {columns:Array.from({length:width},(_,index)=>matrix[0][index]?.text.trim()||'Cột '+(index+1)),sheets,
   rows:matrix.slice(1).map((cells,index)=>({row:index+2,cells})).filter(row=>row.cells.some(cell=>cell.text.trim()))};
 }catch {throw new BadRequestException('Không đọc được file. Dùng CSV UTF-8 hoặc XLSX không mã hóa, tối đa 512 KiB / 500 dòng / 30 cột. Số SIM phải là Text.');}
}
