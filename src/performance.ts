/**
 * Performance utilities for AutoSwagger
 */
export class PerformanceUtils {
  private static debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private static rateLimiters: Map<string, number> = new Map();

  /**
   * Debounce a function call
   */
  static debounce<T extends (...args: any[]) => void>(
    key: string,
    fn: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    return (...args: Parameters<T>) => {
      const existingTimer = this.debounceTimers.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(() => {
        fn(...args);
        this.debounceTimers.delete(key);
      }, delay);

      this.debounceTimers.set(key, timer);
    };
  }

  /**
   * Rate limit a function call
   */
  static rateLimit<T extends (...args: any[]) => void>(
    key: string,
    fn: T,
    minInterval: number
  ): (...args: Parameters<T>) => void {
    return (...args: Parameters<T>) => {
      const now = Date.now();
      const lastCall = this.rateLimiters.get(key) || 0;

      if (now - lastCall >= minInterval) {
        fn(...args);
        this.rateLimiters.set(key, now);
      }
    };
  }

  /**
   * Clear all timers and limiters
   */
  static reset(): void {
    this.debounceTimers.forEach((timer) => clearTimeout(timer));
    this.debounceTimers.clear();
    this.rateLimiters.clear();
  }
}
