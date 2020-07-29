import { Request } from 'express';

/** Validates the authorization header for basic auth. */
export function basicAuthHeaderValidator(req: Request) {

  const auth = req.header('authorization');

  if ( ! auth || auth.substr(0, 6) !== 'Basic ' ) return {
    valid: false,
    error: 'Authorization header is not present or not basic auth!'
  };

  return true;

}
