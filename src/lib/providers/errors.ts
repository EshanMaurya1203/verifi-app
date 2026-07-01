export interface ProviderApiErrorShape {
  statusCode: number;
  message: string;
  originalError: any;
}

export function normalizeProviderError(error: any): ProviderApiErrorShape {
  let statusCode = 500;
  if (error && typeof error === "object") {
    if (typeof error.statusCode === "number") {
      statusCode = error.statusCode;
    } else if (typeof error.status === "number") {
      statusCode = error.status;
    }
  }

  let message = "Provider verification failed";
  if (error instanceof Error) {
    message = error.message;
  } else if (error && typeof error === "object") {
    if (typeof error.description === "string") {
      message = error.description;
    } else if (typeof error.message === "string") {
      message = error.message;
    } else if (typeof error.code === "string") {
      message = error.code;
    } else {
      try {
        message = JSON.stringify(error);
      } catch (e) {
        message = String(error);
      }
    }
  } else if (typeof error === "string") {
    message = error;
  }

  return {
    statusCode,
    message,
    originalError: error,
  };
}

export class ProviderError extends Error {
  public statusCode: number;
  public originalError: any;

  constructor(normalized: ProviderApiErrorShape) {
    super(normalized.message);
    this.name = "ProviderError";
    this.statusCode = normalized.statusCode;
    this.originalError = normalized.originalError;
  }
}
