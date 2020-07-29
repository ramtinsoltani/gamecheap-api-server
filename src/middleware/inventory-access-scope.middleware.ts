import { ServerError } from '@steroids/core';
import { AuthenticatedRequest } from '@steroids/router/auth';
import { Response, NextFunction } from 'express';
import { AccessScopes } from '@steroids/model/user';

export function inventoryAccessScope(req: AuthenticatedRequest, res: Response, next: NextFunction) {

  if ( ! req.tokenData.access?.includes(AccessScopes.InventoryManagement) )
    return res.status(401).json(new ServerError('Insufficient access rights!', 'access-denied'));

  next();

}
