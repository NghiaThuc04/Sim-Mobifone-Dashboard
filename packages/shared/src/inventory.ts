export const SIM_STOCK_STATUSES = ['AVAILABLE','RESERVED','SOLD'] as const;
export type SimStockStatus = typeof SIM_STOCK_STATUSES[number];
export type SimListItem = {
  id:string; phoneNumber:string; carrier:{id:string;code:string;name:string}; category:{id:string;code:string;name:string};
  sellingPrice:string; grossProfit?:string; costPrice?:string; stockStatus:SimStockStatus;
  isVisible:boolean; visibilityRequested:boolean; hasPriceError:boolean; version:number; createdAt:string; updatedAt:string;
};
export type SimList = {items:SimListItem[];total:number;page:number;pageSize:number;totalPages:number;canViewCost:boolean;canViewProfit:boolean};
export type SimSnapshot={phoneNumber:string;carrierId:string;categoryId:string;costPrice:string;sellingPrice:string;stockStatus:SimStockStatus;visibilityRequested:boolean;isVisible:boolean;hasPriceError:boolean;version:number};
export type SimDetails={item:SimListItem;history:{id:string;actorId:string;before:SimSnapshot;after:SimSnapshot;createdAt:string}[];total:number;page:number;totalPages:number};
