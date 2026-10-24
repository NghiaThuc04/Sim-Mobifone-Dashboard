import { decimalUnits,decimalStringFromUnits } from '@sim-dashboard/shared';

export function calculateGrossProfit(costPrice:string,sellingPrice:string):string {
  const cost=decimalUnits(costPrice); const selling=decimalUnits(sellingPrice);
  if(cost===null || selling===null) throw new RangeError('Prices must be exact nonnegative decimal strings.');
  return decimalStringFromUnits(selling-cost);
}
