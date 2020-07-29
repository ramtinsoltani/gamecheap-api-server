import { Request } from 'express';

export function gameSalePriceValidator(req: Request) {

  if ( req.body.hasOwnProperty('salePrice') && req.body.salePrice >= req.body.price )
    return { valid: false, error: 'Sale price must be less than price!' };

  return true;

}
