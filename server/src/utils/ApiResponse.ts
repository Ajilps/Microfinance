import { Response } from "express";

interface ApiResponseData {
  success: boolean;
  message: string;
  data?: any;
  error?: any;
}

/**
 * Centralized utility for sending consistent JSON API responses.
 */
export class ApiResponse {
  /**
   * Send a successful response.
   */
  static success(
    res: Response,
    message: string,
    data: any = null,
    statusCode: number = 200,
  ): Response {
    const body: ApiResponseData = {
      success: true,
      message,
      data,
    };
    return res.status(statusCode).json(body);
  }

  /**
   * Send an error response.
   */
  static error(
    res: Response,
    message: string,
    error: any = null,
    statusCode: number = 500,
  ): Response {
    const body: ApiResponseData = {
      success: false,
      message,
      error: error || null,
    };
    return res.status(statusCode).json(body);
  }

  /**
   * Send a created (201) response.
   */
  static created(res: Response, message: string, data: any = null): Response {
    return ApiResponse.success(res, message, data, 201);
  }

  /**
   * Send a not found (404) response.
   */
  static notFound(
    res: Response,
    message: string = "Resource not found",
  ): Response {
    return ApiResponse.error(res, message, null, 404);
  }

  /**
   * Send an unauthorized (401) response.
   */
  static unauthorized(
    res: Response,
    message: string = "Unauthorized",
  ): Response {
    return ApiResponse.error(res, message, null, 401);
  }

  /**
   * Send a forbidden (403) response.
   */
  static forbidden(res: Response, message: string = "Forbidden"): Response {
    return ApiResponse.error(res, message, null, 403);
  }

  /**
   * Send a bad request (400) response.
   */
  static badRequest(
    res: Response,
    message: string,
    error: any = null,
  ): Response {
    return ApiResponse.error(res, message, error, 400);
  }
}

export default ApiResponse;
