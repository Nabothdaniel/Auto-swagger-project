export interface AutoSwaggerOptions {
  title?: string;
  version?: string;
  description?: string;
  docsRoute?: string;
  debugMode?: boolean;
  routesDir?: string;
  /** Extra directories to scan for interfaces and type aliases, besides routesDir. */
  typesDir?: string | string[];
  servers?: ServerConfig[];
  watchForChanges?: boolean;
  apiVersions?: ApiVersion[];
  excludePaths?: string[];
  includeOnly?: string[];
  customSchemas?: Record<string, any>;
  securitySchemes?: Record<string, any>;
  inferHandlerTypes?: boolean;
}

export interface ServerConfig {
  url: string;
  description: string;
}

export interface ApiVersion {
  version: string;
  basePath: string;
  description?: string;
}

export interface RouteInfo {
  path: string;
  method: string;
  file?: string;
  version?: string;
  requestSchema?: Record<string, any>;
  responseSchema?: Record<string, any>;
  /**
   * OpenAPI schemas for the route's path parameters, keyed by parameter name.
   * Derived from the handler's `Request<Params, ...>` (or `RequestHandler<...>`)
   * type argument. Missing entries fall back to `{ type: 'string' }`.
   */
  paramSchemas?: Record<string, any>;
  /** Status codes the handler sends, read from numeric literals. Defaults to 200. */
  statusCodes?: number[];
}

export interface SwaggerSpec {
  openapi: string;
  info: any;
  servers: ServerConfig[];
  paths: Record<string, any>;
  components?: any;
}
