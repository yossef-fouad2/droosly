

export type ErrorCode =
  | "VALIDATION_FAILED"
  | "UNAUTHENTICATED"
  | "INVALID_CREDENTIALS"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL";

export interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, string[]>;
  };
}

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  INVALID_CREDENTIALS: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL: 500,
};

export class AppError extends Error {
  public readonly status: number;
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "AppError";
    // Status is a function of code — defined once, in STATUS_BY_CODE.
    this.status = STATUS_BY_CODE[code];
  }
}

/** The only place an ErrorBody is constructed. */
export function toErrorBody(
  code: ErrorCode,
  message: string,
  details?: Record<string, string[]>,
): ErrorBody {
  // `details: undefined` is rejected under exactOptionalPropertyTypes — spread instead.
  return { error: { code, message, ...(details ? { details } : {}) } };
}

