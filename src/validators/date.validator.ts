import { and, type, match } from '@steroids/core';

export const dateValidator = and(type.string, match(/^\d{1,2}-\d{1,2}-\d{4}$/), validDate);

function validDate(value: string) {

  if (
    new Date(value).toTimeString() === 'Invalid Date' ||
    new Date(value).getTime() >= new Date().getTime()
  ) return {
    valid: false,
    error: 'Invalid date of birth!'
  };

  return true;

}
