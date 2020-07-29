import { and, type, match } from '@steroids/core';

export const emailValidator = and(type.string, match(/^[a-z0-9-_.+]+@[a-z0-9-.]+\.[a-z]+$/i));
