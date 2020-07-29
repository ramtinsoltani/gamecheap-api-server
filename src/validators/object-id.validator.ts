import { Types } from 'mongoose';
import { Request } from 'express';

export function objectIdParamValidator(req: Request) {

  if ( ! Types.ObjectId.isValid(req.params.id) ) return {
    valid: false,
    error: 'Invalid ID format!'
  };

  return true;

}

export function objectIdValidator(value: any) {

  if ( ! Types.ObjectId.isValid(value) ) return {
    valid: false,
    error: 'Invalid ID format!'
  };

  return true;

}
