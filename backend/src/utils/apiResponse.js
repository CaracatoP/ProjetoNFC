export function successResponse(res, data, meta = undefined, status = 200) {
  return res.status(status).json({
    success: true,
    data,
    ...(meta ? { meta } : {}),
  });
}

export function errorResponse(res, error) {
  return res.status(error.statusCode || 500).json({
    success: false,
    error: {
      code: error.code || 'internal_error',
      message: error.message || 'Erro interno do servidor',
      ...(error.details ? { details: error.details } : {}),
    },
  });
}

