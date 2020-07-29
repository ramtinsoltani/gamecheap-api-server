import { and, len, type, match } from '@steroids/core';

export const passwordValidator = and(
  type.string,
  len.range(8, 32),
  match(/[a-z]/),
  match(/[A-Z]/),
  match(/\d/),
  match(/[!@#$%^&*()\-_=+,.<>/?\\|\[\]{}:;"'`~]/)
);
