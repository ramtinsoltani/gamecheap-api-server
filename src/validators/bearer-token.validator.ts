import { Request } from 'express';

/** Validates the authorization header for bearer token. */
export function bearerTokenHeaderValidator(req: Request) {

  const auth = req.header('authorization');

  if ( ! auth || auth.substr(0, 7) !== 'Bearer ' ) return {
    valid: false,
    error: 'Authorization header is not present or not bearer token!'
  };

  return true;

}
