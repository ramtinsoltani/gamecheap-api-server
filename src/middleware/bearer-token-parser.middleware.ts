import { Request, Response, NextFunction } from 'express';
import { ServerError } from '@steroids/core';
import { ProtectedRequest } from '@steroids/router/auth';

export function bearerTokenParser(req: Request, res: Response, next: NextFunction) {

  // Extract the token from authorization header into request object
  const token = req.header('authorization')?.match(/^Bearer (?<token>.+)$/i).groups.token;

  if ( ! token ) return res.status(400).json(new ServerError('Authorization header must be a valid bearer token!', 'auth-token-missing'));

  (<ProtectedRequest>req).token = token;

  next();

}
