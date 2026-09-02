import { randomUUID } from 'node:crypto';

/** @type {import('express').RequestHandler} */
export function requestContext(request, response, next) {
  const supplied = request.get('x-request-id');
  const requestId = supplied && /^[a-zA-Z0-9._-]{1,100}$/.test(supplied) ? supplied : randomUUID();
  request.id = requestId;
  response.setHeader('x-request-id', requestId);
  return next();
}
