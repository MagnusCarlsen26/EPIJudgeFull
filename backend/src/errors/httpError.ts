export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNKNOWN_PROBLEM"
  | "UNSUPPORTED_LANGUAGE"
  | "CODE_TOO_LARGE"
  | "TEST_DATA_NOT_FOUND"
  | "RUN_NOT_FOUND"
  | "JUDGE0_UNAVAILABLE"
  | "JUDGE0_REJECTED"
  | "INTERNAL_ERROR";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    message: string
  ) {
    super(message);
  }
}

export function toApiError(error: unknown): { code: ApiErrorCode; message: string } {
  if (error instanceof HttpError) return { code: error.code, message: error.message };
  if (error instanceof Error) return { code: "INTERNAL_ERROR", message: error.message };
  return { code: "INTERNAL_ERROR", message: "Unexpected internal error." };
}
