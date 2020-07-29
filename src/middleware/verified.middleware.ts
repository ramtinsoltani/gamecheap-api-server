import { ServerError } from '@steroids/core';
import { AuthenticatedRequest } from '@steroids/router/auth';
import { Response, NextFunction } from 'express';

export function verified(req: AuthenticatedRequest, res: Response, next: NextFunction) {

  if ( ! req.tokenData.verified )
    return res.status(401).json(new ServerError('Account must be verified!', 'access-denied'));

  next();

}
