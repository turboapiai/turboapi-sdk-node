import type { BackendResponse } from './types';

/** Base error for all TurboAPI SDK errors. */
export class TurboAPIError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly errorCode: string = 'UNKNOWN',
    public readonly details?: Record<string, unknown>,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'TurboAPIError';
  }
}

export class AuthenticationError extends TurboAPIError {
  constructor(
    message: string,
    statusCode?: number,
    errorCode?: string,
    details?: Record<string, unknown>,
    requestId?: string,
  ) {
    super(message, statusCode, errorCode ?? 'UNAUTHORIZED', details, requestId);
    this.name = 'AuthenticationError';
  }
}

export class RateLimitError extends TurboAPIError {
  constructor(
    message: string,
    statusCode?: number,
    errorCode?: string,
    details?: Record<string, unknown>,
    requestId?: string,
  ) {
    super(message, statusCode, errorCode ?? 'RATE_LIMITED', details, requestId);
    this.name = 'RateLimitError';
  }

  get retryAfter(): number | undefined {
    if (this.details?.retry_after != null) {
      return Number(this.details.retry_after);
    }
    return undefined;
  }
}

export class NotFoundError extends TurboAPIError {
  constructor(
    message: string,
    statusCode?: number,
    errorCode?: string,
    details?: Record<string, unknown>,
    requestId?: string,
  ) {
    super(message, statusCode, errorCode ?? 'NOT_FOUND', details, requestId);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends TurboAPIError {
  constructor(
    message: string,
    statusCode?: number,
    errorCode?: string,
    details?: Record<string, unknown>,
    requestId?: string,
  ) {
    super(message, statusCode, errorCode ?? 'VALIDATION_ERROR', details, requestId);
    this.name = 'ValidationError';
  }
}

export class TaskError extends TurboAPIError {
  constructor(
    message: string,
    statusCode?: number,
    errorCode?: string,
    details?: Record<string, unknown>,
    requestId?: string,
  ) {
    super(message, statusCode, errorCode ?? 'TASK_ERROR', details, requestId);
    this.name = 'TaskError';
  }
}

export class ServerError extends TurboAPIError {
  constructor(
    message: string,
    statusCode?: number,
    errorCode?: string,
    details?: Record<string, unknown>,
    requestId?: string,
  ) {
    super(message, statusCode, errorCode ?? 'INTERNAL_ERROR', details, requestId);
    this.name = 'ServerError';
  }
}

export class NetworkError extends TurboAPIError {
  constructor(message: string) {
    super(message, undefined, 'NETWORK_ERROR');
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends TurboAPIError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, undefined, 'TIMEOUT', details);
    this.name = 'TimeoutError';
  }
}

const ERROR_CLASS_MAP: Record<string, new (...args: ConstructorParameters<typeof TurboAPIError>) => TurboAPIError> = {
  UNAUTHORIZED: AuthenticationError,
  AUTH_TOKEN_EXPIRED: AuthenticationError,
  AUTH_INVALID_TOKEN: AuthenticationError,
  FORBIDDEN: AuthenticationError,
  NOT_FOUND: NotFoundError,
  API_NOT_FOUND: NotFoundError,
  USER_NOT_FOUND: NotFoundError,
  RATE_LIMITED: RateLimitError,
  RATE_LIMIT: RateLimitError,
  VALIDATION_ERROR: ValidationError,
  BAD_REQUEST: ValidationError,
  CALL_FAILED: TaskError,
  POINTS_INSUFFICIENT: TaskError,
  INTERNAL_ERROR: ServerError,
};

export function createErrorFromResponse(
  statusCode: number,
  body: BackendResponse<unknown>,
): TurboAPIError {
  const errResp = body.error ?? { code: 'UNKNOWN', message: 'Unknown error' };
  const requestId = body.meta?.request_id;
  const Klass = ERROR_CLASS_MAP[errResp.code] ?? suggestClass(errResp.code, TurboAPIError);
  return new Klass(
    errResp.message,
    statusCode,
    errResp.code,
    errResp.details,
    requestId,
  );
}

function suggestClass(
  code: string,
  fallback: typeof TurboAPIError,
): typeof TurboAPIError {
  if (code.startsWith('AUTH_')) return AuthenticationError;
  if (code.startsWith('CALL_')) return TaskError;
  if (code.startsWith('INTERNAL')) return ServerError;
  if (code.startsWith('VALIDATION')) return ValidationError;
  return fallback;
}
