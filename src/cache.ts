import { RouteInfo } from './types/index';

/**
 * Cache manager for AutoSwagger
 * Handles caching of routes and interfaces
 */
export class CacheManager {
  private routeCache: Map<string, RouteInfo[]> = new Map();
  private interfaceCache: Map<string, any> = new Map();
  private cacheTimestamp: number = 0;
  private cacheTimeout: number = 5 * 60 * 1000; // 5 minutes

  /**
   * Get cached routes
   */
  getRoutes(version: string): RouteInfo[] | undefined {
    if (this.isCacheValid()) {
      return this.routeCache.get(version);
    }
    return undefined;
  }

  /**
   * Set routes in cache
   */
  setRoutes(version: string, routes: RouteInfo[]): void {
    this.routeCache.set(version, routes);
    this.updateTimestamp();
  }

  /**
   * Get cached interfaces
   */
  getInterfaces(): Map<string, any> | undefined {
    if (this.isCacheValid()) {
      return this.interfaceCache;
    }
    return undefined;
  }

  /**
   * Set interfaces in cache
   */
  setInterfaces(interfaces: Map<string, any>): void {
    this.interfaceCache = interfaces;
    this.updateTimestamp();
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.routeCache.clear();
    this.interfaceCache.clear();
    this.cacheTimestamp = 0;
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(): boolean {
    return Date.now() - this.cacheTimestamp < this.cacheTimeout;
  }

  /**
   * Update cache timestamp
   */
  private updateTimestamp(): void {
    this.cacheTimestamp = Date.now();
  }
}
