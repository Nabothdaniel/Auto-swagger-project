/**
 * Custom error class for Express Auto Swagger
 */
export class AutoSwaggerError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AutoSwaggerError';
    Object.setPrototypeOf(this, AutoSwaggerError.prototype);
  }

  static CODES = {
    INITIALIZATION_ERROR: 'INIT_ERROR',
    ROUTE_SCAN_ERROR: 'ROUTE_SCAN_ERROR',
    INTERFACE_SCAN_ERROR: 'INTERFACE_SCAN_ERROR',
    FILE_WATCH_ERROR: 'FILE_WATCH_ERROR',
    INVALID_CONFIG: 'INVALID_CONFIG',
    CONFIGURATION_ERROR: 'CONFIG_ERROR',
    SWAGGER_UI_ERROR: 'SWAGGER_UI_ERROR',
  } as const;
}
