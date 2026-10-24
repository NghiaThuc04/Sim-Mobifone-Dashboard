export const SIM_IMPORT_LIMITS={fileBytes:524288,rows:500,columns:30,cellCharacters:1000,uncompressedBytes:10485760,zipEntries:200,jsonBytes:720896,confirmBytes:16384,previewMinutes:30} as const;
export const SIM_IMPORT_FIELDS=['phoneNumber','carrierCode','categoryCode','costPrice','sellingPrice','stockStatus','visibilityRequested'] as const;
export type SimImportField=typeof SIM_IMPORT_FIELDS[number];
export type SimImportRow={row:number;phoneNumber:string;costPrice:string;sellingPrice:string;errors:string[];priceWarning:boolean};
export type SimImportMapping={phase:'mapping';columns:string[];sample:string[][];rowsCount:number;sheets:string[]};
export type SimImportPreview={phase:'preview';id:string;expiresAt:string;rows:SimImportRow[]};
export type SimImportResult={success:number;failed:number;skipped:number;items:{row:number;outcome:'IMPORTED'|'FAILED'|'SKIPPED';message:string;simId?:string}[]};
