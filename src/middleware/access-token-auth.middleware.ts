import { Response, NextFunction } from 'express';
import { ProtectedRequest, AuthenticatedRequest } from '@steroids/router/auth';
import { AuthService } from '@steroids/service/auth';

export function accessTokenAuth(auth: AuthService) {

  return (req: ProtectedRequest, res: Response, next: NextFunction) => {

    // Decode token
    auth.decodeAccessToken(req.token)
    .then(data => {

      (<AuthenticatedRequest>req).tokenData = data;
      next();

    })
    .catch(error => res.status(401).json(error));

  }

}
