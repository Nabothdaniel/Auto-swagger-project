export interface AutoSwaggerOptions {
  title?: string;
  version?: string;
  description?: string;
  docsRoute?: string;
  debugMode?: boolean;
  routesDir?: string;
  servers?: ServerConfig[];
  watchForChanges?: boolean;
  apiVersions?: ApiVersion[];
  excludePaths?: string[];
  includeOnly?: string[];
  customSchemas?: Record<string, any>;
  securitySchemes?: Record<string, any>;
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
}

export interface SwaggerSpec {
  openapi: string;
  info: any;
  servers: ServerConfig[];
  paths: Record<string, any>;
  components?: any;
}
