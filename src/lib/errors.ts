export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR')
    this.name = 'ValidationError'
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Çok fazla istek. Lütfen biraz bekleyin.') {
    super(message, 429, 'RATE_LIMIT')
    this.name = 'RateLimitError'
  }
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

export function logApiError(route: string, err: unknown): void {
  console.error(`[api/${route}]`, err)
}
