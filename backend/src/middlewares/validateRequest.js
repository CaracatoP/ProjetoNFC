import { ZodError } from 'zod';
import { AppError } from '../utils/appError.js';

function formatZodIssues(error) {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

function isZodLikeError(error) {
  return error instanceof ZodError || Array.isArray(error?.issues);
}

export function validateRequest(schemas) {
  return (req, _res, next) => {
    try {
      const validated = {};

      if (schemas.params) {
        validated.params = schemas.params.parse(req.params);
      }

      if (schemas.query) {
        validated.query = schemas.query.parse(req.query);
      }

      if (schemas.body) {
        validated.body = schemas.body.parse(req.body);
      }

      req.validated = validated;
      next();
    } catch (error) {
      if (isZodLikeError(error)) {
        next(new AppError('Falha de validação', 400, 'validation_error', formatZodIssues(error)));
        return;
      }

      next(error);
    }
  };
}
