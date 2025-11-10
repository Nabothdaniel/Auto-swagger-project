/**
 * Logger utility for Express Auto Swagger
 */
export class Logger {
  private debugMode: boolean;

  constructor(debugMode: boolean = false) {
    this.debugMode = debugMode;
  }

  info(message: string, ...args: any[]) {
    console.log(`[AutoSwagger] ${message}`, ...args);
  }

  debug(message: string, ...args: any[]) {
    if (this.debugMode) {
      console.debug(`[AutoSwagger Debug] ${message}`, ...args);
    }
  }

  error(message: string, error?: any) {
    console.error(`[AutoSwagger Error] ${message}`);
    if (error && this.debugMode) {
      console.error(error);
    }
  }

  warn(message: string, ...args: any[]) {
    console.warn(`[AutoSwagger Warning] ${message}`, ...args);
  }
}
