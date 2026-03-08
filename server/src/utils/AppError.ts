/**
 * Custom error class for operational errors.
 * Extends the built-in Error class with an HTTP statusCode.
 */
class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export default AppError;
