/**
 * Express Auto Swagger
 * Automatically generates OpenAPI/Swagger documentation from Express routes
 *
 * @class AutoSwagger
 * @extends {EventEmitter}
 * @version 1.1.1
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { AutoSwagger } from '@nabothdaniel/express-auto-doc-ts';
 *
 * const app = express();
 *
 * const swagger = new AutoSwagger(app, {
 *   title: 'My API',
 *   version: '1.0.0',
 *   docsRoute: '/api-docs',
 *   watchForChanges: true
 * });
 *
 * swagger.initialize();
 * ```
 *
 * @fires AutoSwagger#fileChange - Emitted when a watched file changes
 * @fires AutoSwagger#routeUpdate - Emitted when routes are updated
 * @fires AutoSwagger#error - Emitted when an error occurs
 *
 * @throws {AutoSwaggerError} When initialization fails
 * @throws {AutoSwaggerError} When route scanning fails
 * @throws {AutoSwaggerError} When interface scanning fails
 */

import { Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import { Project, Type } from 'ts-morph';
import path from 'path';
import fs from 'fs';
import { EventEmitter } from 'events';
import { Logger } from './logger';
import { AutoSwaggerError } from './errors';
import { CacheManager } from './cache';
import { MountTable, joinRoutePath, resolveMounts } from './mounts';
import { HandlerTypeTable, resolveHandlerTypes } from './handlers';
import { createSyntaxProject, findRouteCalls } from './routes';
import { SchemaConverter, isValidSchemaName } from './schema';
import type { AutoSwaggerOptions, RouteInfo, SwaggerSpec } from './types';

export { AutoSwaggerError } from './errors';
export type { ApiVersion, AutoSwaggerOptions, RouteInfo, ServerConfig, SwaggerSpec } from './types';

// ============================================================================
// Core Class
// ============================================================================

export class AutoSwagger extends EventEmitter {
  private app: Express;
  private options: Required<AutoSwaggerOptions>;
  private watcherInitialized = false;
  private watchers: fs.FSWatcher[] = [];
  private refreshTimer?: NodeJS.Timeout;
  private lastScanTime = 0;
  private swaggerUiInitialized = false;
  private currentSpec: SwaggerSpec | null = null;
  private logger: Logger;
  private cache: CacheManager;
  private handlerSchemas = new Map<string, any>();

  /**
   * Create a new instance of AutoSwagger
   * @param app Express application instance
   * @param options Configuration options
   */
  constructor(app: Express, options: AutoSwaggerOptions = {}) {
    super();
    this.app = app;
    this.validateApp();
    this.validateOptions(options);
    this.options = this.normalizeOptions(options);
    this.logger = new Logger(this.options.debugMode);
    this.cache = new CacheManager();
  }

  private validateOptions(options: AutoSwaggerOptions): void {
    if (options.docsRoute === '') {
      throw new AutoSwaggerError(
        'Invalid docsRoute: cannot be empty string',
        AutoSwaggerError.CODES.CONFIGURATION_ERROR
      );
    }

    if (options.apiVersions?.some((v) => !v.version || v.version.trim() === '')) {
      throw new AutoSwaggerError(
        'Invalid API version configuration: version cannot be empty',
        AutoSwaggerError.CODES.CONFIGURATION_ERROR
      );
    }
  }

  /**
   * Validates the Express application instance
   * @private
   */
  private validateApp(): void {
    if (!this.app || typeof this.app.use !== 'function') {
      throw new AutoSwaggerError(
        'Invalid Express application instance provided',
        AutoSwaggerError.CODES.INITIALIZATION_ERROR
      );
    }
  }

  /**
   * Initialize and generate documentation
   * @throws {AutoSwaggerError} If initialization fails
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing AutoSwagger...');

      let routes = this.cache.getRoutes('default');
      let interfaces = this.cache.getInterfaces();

      if (!routes || !interfaces) {
        try {
          routes = await this.scanRoutes();
        } catch (error: any) {
          if (
            error instanceof AutoSwaggerError ||
            error.code === AutoSwaggerError.CODES.ROUTE_SCAN_ERROR
          ) {
            throw error;
          }
          throw new AutoSwaggerError(
            'Failed to scan routes',
            AutoSwaggerError.CODES.ROUTE_SCAN_ERROR,
            error
          );
        }

        try {
          interfaces = await this.scanInterfaces();
        } catch (error: any) {
          throw new AutoSwaggerError(
            'Failed to scan interfaces',
            AutoSwaggerError.CODES.INTERFACE_SCAN_ERROR,
            error
          );
        }

        this.cache.setRoutes('default', routes);
        this.cache.setInterfaces(interfaces);
      }

      const spec = this.buildOpenApiSpec(routes, interfaces);
      this.serveSwaggerUI(spec);

      this.printSummary(routes, interfaces);

      if (this.options.watchForChanges) {
        this.setupFileWatcher();
      }

      this.emit('initialized', { routes, interfaces });
    } catch (error) {
      this.emit('error', error);
      console.error('Failed to initialize AutoSwagger:', error);
      throw error;
    }
  }

  /**
   * Refresh documentation (useful after adding new routes)
   */
  async refresh(): Promise<void> {
    if (this.options.debugMode) {
      console.log('\nRefreshing documentation...\n');
    }
    this.cache.clearCache();
    await this.initialize();
  }

  /**
   * Stop file watchers and pending refreshes.
   */
  close(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = undefined;
    }

    this.watchers.forEach((watcher) => watcher.close());
    this.watchers = [];
    this.watcherInitialized = false;
  }

  /**
   * Get current OpenAPI spec
   */
  getSpec(): SwaggerSpec | null {
    const routes = this.cache.getRoutes('default') || [];
    if (routes.length === 0) return null;

    const interfaces = this.cache.getInterfaces() || new Map();
    return this.buildOpenApiSpec(routes, interfaces);
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private normalizeOptions(options: AutoSwaggerOptions): Required<AutoSwaggerOptions> {
    return {
      title: options.title || 'API Documentation',
      version: options.version || '1.0.0',
      description: options.description || 'Auto-generated API documentation',
      docsRoute: options.docsRoute || '/docs',
      debugMode: options.debugMode || false,
      routesDir: options.routesDir || '',
      servers: options.servers || [
        { url: 'http://localhost:3000', description: 'Development server' },
      ],
      watchForChanges: options.watchForChanges || false,
      apiVersions: options.apiVersions || [],
      excludePaths: options.excludePaths || [],
      includeOnly: options.includeOnly || [],
      customSchemas: options.customSchemas || {},
      securitySchemes: options.securitySchemes || {},
      inferHandlerTypes: options.inferHandlerTypes ?? true,
    };
  }

  private async scanRoutes(): Promise<RouteInfo[]> {
    const scanner = new RouteScanner(this.options);
    const routes = scanner.scan();
    this.handlerSchemas = scanner.discoveredSchemas;
    return routes;
  }

  private async scanInterfaces(): Promise<Map<string, any>> {
    const scanner = new InterfaceScanner(this.options);
    const interfaces = scanner.scan();

    // Types reached through handlers are resolved with full import
    // information, so they take precedence over the directory scan.
    this.handlerSchemas.forEach((schema, name) => interfaces.set(name, schema));
    return interfaces;
  }

  private buildOpenApiSpec(routes: RouteInfo[], interfaces: Map<string, any>): SwaggerSpec {
    const builder = new SpecBuilder(this.options, routes, interfaces);
    return builder.build();
  }

  private serveSwaggerUI(spec: SwaggerSpec): void {
    this.currentSpec = spec;
    if (this.swaggerUiInitialized) return;

    this.app.use(
      this.options.docsRoute,
      swaggerUi.serve,
      (req: any, _res: any, next: () => void) => {
        req.swaggerDoc = this.currentSpec;
        next();
      },
      swaggerUi.setup(undefined, {
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: this.options.title,
        swaggerOptions: {
          persistAuthorization: true,
        },
      })
    );
    this.swaggerUiInitialized = true;
  }

  private setupFileWatcher(): void {
    if (this.watcherInitialized) return;

    const searchDirs = this.getSearchDirectories();

    searchDirs.forEach((dir) => {
      if (fs.existsSync(dir)) {
        const watcher = fs.watch(dir, { recursive: true }, (_event, filename) => {
          if (filename && /\.(ts|js)$/.test(filename)) {
            const now = Date.now();
            if (now - this.lastScanTime <= 1000) return;

            this.lastScanTime = now;
            if (this.refreshTimer) clearTimeout(this.refreshTimer);
            this.refreshTimer = setTimeout(() => {
              this.refreshTimer = undefined;
              if (this.options.debugMode) {
                console.log(`File changed: ${filename}, refreshing docs...`);
              }
              this.refresh().catch((error) => {
                this.logger.error('Failed to refresh documentation after file change', error);
              });
            }, 100);
            this.refreshTimer.unref();
          }
        });

        watcher.on('error', (error) => {
          this.logger.error(`File watcher failed for ${dir}`, error);
        });
        watcher.unref();
        this.watchers.push(watcher);
      }
    });

    this.watcherInitialized = true;
    if (this.options.debugMode) {
      console.log('File watcher enabled');
    }
  }

  private getSearchDirectories(): string[] {
    if (this.options.routesDir) {
      return [path.resolve(process.cwd(), this.options.routesDir)];
    }
    return [
      path.join(process.cwd(), 'routes'),
      path.join(process.cwd(), 'src', 'routes'),
      path.join(process.cwd(), 'src', 'api'),
      path.join(process.cwd(), 'api'),
    ];
  }

  private printSummary(routes: RouteInfo[], interfaces: Map<string, any>): void {
    console.log('\nSwagger Documentation Generated');
    console.log(`Documentation: ${this.options.docsRoute}`);
    console.log(`Routes: ${routes.length}`);

    if (this.options.apiVersions.length > 0) {
      console.log('\nAPI Versions:');
      this.options.apiVersions.forEach((v) => {
        console.log(`   v${v.version} - ${v.basePath}`);
      });
    }

    const grouped = this.groupRoutesByTag(routes);
    Object.keys(grouped)
      .sort()
      .forEach((tag) => {
        console.log(`\n  [${tag}]`);
        grouped[tag].forEach((route) => console.log(`   ${route}`));
      });

    if (interfaces.size > 0) {
      console.log(`\nInterfaces: ${interfaces.size}`);
    }

    console.log('\n');
  }

  private groupRoutesByTag(routes: RouteInfo[]): Record<string, string[]> {
    const grouped: Record<string, string[]> = {};
    routes.forEach((r) => {
      const method = r.method.toUpperCase().padEnd(6);
      const routeStr = `${method} ${r.path}`;
      const tag = r.path.split('/')[1] || 'default';
      if (!grouped[tag]) grouped[tag] = [];
      grouped[tag].push(routeStr);
    });
    return grouped;
  }
}

// ============================================================================
// Route Scanner Module
// ============================================================================

class RouteScanner {
  /** Named schemas found while resolving handler types. */
  readonly discoveredSchemas = new Map<string, any>();

  constructor(private options: Required<AutoSwaggerOptions>) {}

  scan(): RouteInfo[] {
    const searchDirs = this.getSearchDirectories();
    let routeFiles: string[] = [];
    let foundDir = '';

    for (const dir of searchDirs) {
      if (this.options.debugMode) {
        console.log(`Searching: ${dir}`);
      }
      const files = this.findFiles(dir);
      if (files.length > 0) {
        routeFiles = files;
        foundDir = dir;
        break;
      }
    }

    if (routeFiles.length === 0) {
      if (this.options.routesDir && !fs.existsSync(searchDirs[0])) {
        throw new AutoSwaggerError(
          `Route directory not found: ${searchDirs[0]}`,
          AutoSwaggerError.CODES.ROUTE_SCAN_ERROR
        );
      }
      console.warn('No route files found');
      return [];
    }

    if (this.options.debugMode) {
      console.log(`\nFound ${routeFiles.length} file(s) in ${foundDir}\n`);
    }

    const mounts = this.resolveMountTable(routeFiles, foundDir);
    const handlerTypes = this.resolveHandlerTypeTable(routeFiles);

    const project = createSyntaxProject();
    const allRoutes: RouteInfo[] = [];
    for (const file of routeFiles) {
      const routes = this.extractRoutesFromFile(file, project, mounts, handlerTypes);
      allRoutes.push(...routes);
    }

    return this.filterRoutes(allRoutes);
  }

  private resolveHandlerTypeTable(routeFiles: string[]): HandlerTypeTable {
    if (!this.options.inferHandlerTypes) return new HandlerTypeTable();

    try {
      return resolveHandlerTypes(routeFiles, this.discoveredSchemas, process.cwd());
    } catch (error) {
      if (this.options.debugMode) {
        console.log('  Could not resolve handler types');
      }
      return new HandlerTypeTable();
    }
  }

  private resolveMountTable(routeFiles: string[], routesRoot: string): MountTable {
    try {
      return resolveMounts(routeFiles, routesRoot, process.cwd());
    } catch (error) {
      if (this.options.debugMode) {
        console.log('  Could not resolve router mount prefixes');
      }
      return new MountTable();
    }
  }

  private getSearchDirectories(): string[] {
    if (this.options.routesDir) {
      return [path.resolve(process.cwd(), this.options.routesDir)];
    }
    return [
      path.join(process.cwd(), 'routes'),
      path.join(process.cwd(), 'src', 'routes'),
      path.join(process.cwd(), 'src', 'api'),
      path.join(process.cwd(), 'api'),
    ];
  }

  private findFiles(dir: string): string[] {
    const files: string[] = [];

    try {
      if (!fs.existsSync(dir)) return files;

      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        try {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            const skipDirs = [
              'node_modules',
              'dist',
              'build',
              '.git',
              '.next',
              '.cache',
              'coverage',
            ];
            if (skipDirs.includes(entry.name) || entry.name.startsWith('.')) {
              continue;
            }
            files.push(...this.findFiles(fullPath));
          } else if (entry.isFile() && /\.(ts|js)$/.test(entry.name)) {
            if (
              entry.name.endsWith('.d.ts') ||
              entry.name.includes('.test.') ||
              entry.name.includes('.spec.')
            ) {
              continue;
            }
            files.push(fullPath);
          }
        } catch (error) {
          // Skip inaccessible files
        }
      }
    } catch (error) {
      // Skip inaccessible directories
    }

    return files;
  }

  private extractRoutesFromFile(
    filePath: string,
    project: Project,
    mounts: MountTable,
    handlerTypes: HandlerTypeTable
  ): RouteInfo[] {
    const routes: RouteInfo[] = [];

    try {
      const sourceFile = project.addSourceFileAtPath(filePath);

      findRouteCalls(sourceFile).forEach(({ receiver, method, path: declaredPath }) => {
        const handler = handlerTypes.get(filePath, receiver, method, declaredPath);

        // A router mounted more than once is reachable under every prefix
        mounts.prefixesFor(path.normalize(filePath), receiver).forEach((prefix) => {
          const routePath = joinRoutePath(prefix, declaredPath);

          // Detect version from path
          const versionMatch = routePath.match(/^\/(v\d+)\//);
          const version = versionMatch ? versionMatch[1] : undefined;

          routes.push({
            method,
            path: routePath.replace(/:([^/]+)/g, '{$1}'),
            file: path.basename(filePath),
            version,
            ...(handler?.request && { requestSchema: handler.request }),
            ...(handler?.response && { responseSchema: handler.response }),
          });

          if (this.options.debugMode) {
            console.log(`  Found: ${method.toUpperCase()} ${routePath}`);
          }
        });
      });
    } catch (error) {
      if (this.options.debugMode) {
        console.log(`  Could not read: ${path.basename(filePath)}`);
      }
    }

    return routes;
  }

  private filterRoutes(routes: RouteInfo[]): RouteInfo[] {
    let filtered = routes;

    // Apply includeOnly filter
    if (this.options.includeOnly.length > 0) {
      filtered = filtered.filter((r) =>
        this.options.includeOnly.some((pattern) => r.path.includes(pattern))
      );
    }

    // Apply excludePaths filter
    if (this.options.excludePaths.length > 0) {
      filtered = filtered.filter(
        (r) => !this.options.excludePaths.some((pattern) => r.path.includes(pattern))
      );
    }

    return filtered;
  }
}

// ============================================================================
// Interface Scanner Module
// ============================================================================

class InterfaceScanner {
  private converter = new SchemaConverter(new Map());

  constructor(private options: Required<AutoSwaggerOptions>) {}

  scan(): Map<string, any> {
    const interfaces = new Map<string, any>();
    this.converter = new SchemaConverter(interfaces);
    const searchDirs = this.getSearchDirectories();

    for (const dir of searchDirs) {
      if (!fs.existsSync(dir)) continue;

      try {
        const project = new Project({
          skipAddingFilesFromTsConfig: true,
          skipFileDependencyResolution: true,
          compilerOptions: {
            strictNullChecks: true,
          },
        });

        const files = this.findTsFiles(dir);
        if (files.length === 0) continue;

        const sourceFiles = project.addSourceFilesAtPaths(files);

        sourceFiles.forEach((file) => {
          try {
            file.getInterfaces().forEach((iface) => {
              this.addSchema(interfaces, iface.getName(), iface.getType(), file.getFilePath());
            });
            file.getTypeAliases().forEach((typeAlias) => {
              this.addSchema(
                interfaces,
                typeAlias.getName(),
                typeAlias.getType(),
                file.getFilePath()
              );
            });
          } catch (error) {
            this.warn(`Could not parse types in ${file.getFilePath()}`, error);
          }
        });

        break; // Found interfaces, stop searching
      } catch (error) {
        // Continue to next directory
      }
    }

    return interfaces;
  }

  private getSearchDirectories(): string[] {
    if (this.options.routesDir) {
      return [path.resolve(process.cwd(), this.options.routesDir)];
    }
    return [
      path.join(process.cwd(), 'routes'),
      path.join(process.cwd(), 'src', 'routes'),
      path.join(process.cwd(), 'src', 'types'),
      path.join(process.cwd(), 'src'),
    ];
  }

  private findTsFiles(dir: string): string[] {
    const files: string[] = [];

    try {
      if (!fs.existsSync(dir)) return files;

      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          const skipDirs = ['node_modules', 'dist', 'build', '.git'];
          if (!skipDirs.includes(entry.name) && !entry.name.startsWith('.')) {
            files.push(...this.findTsFiles(fullPath));
          }
        } else if (entry.isFile() && entry.name.endsWith('.ts')) {
          if (
            !entry.name.endsWith('.d.ts') &&
            !entry.name.includes('.test.') &&
            !entry.name.includes('.spec.')
          ) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      // Skip errors
    }

    return files;
  }

  private addSchema(
    interfaces: Map<string, any>,
    name: string,
    type: Type,
    filePath: string
  ): void {
    if (!isValidSchemaName(name)) return;

    try {
      this.converter.register(name, type);

      if (this.options.debugMode && interfaces.has(name)) {
        console.log(`  Interface: ${name}`);
      }
    } catch (error) {
      this.warn(`Could not parse type ${name} in ${filePath}`, error);
    }
  }

  private warn(message: string, error?: unknown): void {
    console.warn(`[AutoSwagger Warning] ${message}`);
    if (error && this.options.debugMode) console.warn(error);
  }
}

// ============================================================================
// Spec Builder Module
// ============================================================================

class SpecBuilder {
  constructor(
    private options: Required<AutoSwaggerOptions>,
    private routes: RouteInfo[],
    private interfaces: Map<string, any>
  ) {}

  build(): SwaggerSpec {
    const paths = this.buildPaths();
    const components = this.buildComponents();

    return {
      openapi: '3.0.0',
      info: {
        title: this.options.title,
        version: this.options.version,
        description: this.options.description,
      },
      servers: this.options.servers,
      paths,
      ...(Object.keys(components.schemas).length > 0 && { components }),
    };
  }

  private buildPaths(): Record<string, any> {
    const paths: Record<string, any> = {};

    for (const route of this.routes) {
      if (!paths[route.path]) {
        paths[route.path] = {};
      }
      paths[route.path][route.method] = this.buildOperation(route);
    }

    // Map interfaces to operations
    this.mapInterfacesToPaths(paths);

    return paths;
  }

  private buildOperation(route: RouteInfo): any {
    const method = route.method.toUpperCase();
    const hasRequestBody = ['POST', 'PUT', 'PATCH'].includes(method);

    const operation: any = {
      summary: `${method} ${route.path}`,
      tags: [this.getTag(route.path)],
    };

    // Path parameters
    const pathParams = route.path.match(/\{([^}]+)\}/g);
    if (pathParams) {
      operation.parameters = pathParams.map((param) => ({
        name: param.slice(1, -1),
        in: 'path',
        required: true,
        schema: { type: 'string' },
      }));
    }

    // Request body
    if (hasRequestBody) {
      operation.requestBody = {
        required: true,
        content: {
          'application/json': {
            schema: route.requestSchema ?? { type: 'object' },
          },
        },
      };
    }

    // Responses
    operation.responses = {
      200: {
        description: 'Success',
        content: {
          'application/json': {
            schema: route.responseSchema ?? { type: 'object' },
          },
        },
      },
    };

    return operation;
  }

  /**
   * The first path segment that names a resource, skipping mount prefixes such
   * as `api` and `v1` and path parameters.
   */
  private getTag(routePath: string): string {
    const segments = routePath.split('/').filter(Boolean);
    const resource = segments.find(
      (segment) => segment !== 'api' && !/^v\d+$/.test(segment) && !segment.startsWith('{')
    );
    return resource || segments[0] || 'default';
  }

  private buildComponents(): any {
    const schemas: Record<string, any> = {};

    // Add scanned interfaces
    this.interfaces.forEach((schema, name) => {
      schemas[name] = schema;
    });

    // Add custom schemas
    Object.entries(this.options.customSchemas).forEach(([name, schema]) => {
      schemas[name] = schema;
    });

    return {
      schemas,
      ...(Object.keys(this.options.securitySchemes).length > 0 && {
        securitySchemes: this.options.securitySchemes,
      }),
    };
  }

  private mapInterfacesToPaths(paths: Record<string, any>): void {
    Object.keys(paths).forEach((route) => {
      Object.keys(paths[route]).forEach((method) => {
        const methodUpper = method.toUpperCase();
        const [reqName, resName] = this.getInterfaceNames(
          methodUpper,
          this.getRouteNameCandidates(route)
        );

        // Types written on the handler win over naming conventions
        const explicit = this.routes.find((r) => r.path === route && r.method === method);

        // Map request
        if (
          !explicit?.requestSchema &&
          reqName &&
          this.interfaces.has(reqName) &&
          paths[route][method].requestBody
        ) {
          paths[route][method].requestBody.content['application/json'].schema = {
            $ref: `#/components/schemas/${reqName}`,
          };
        }

        // Map response
        if (!explicit?.responseSchema && resName && this.interfaces.has(resName)) {
          paths[route][method].responses['200'].content['application/json'].schema = {
            $ref: `#/components/schemas/${resName}`,
          };
        }
      });
    });
  }

  private normalizeRouteName(route: string): string {
    return route
      .replace(/^\//, '')
      .replace(/\//g, '')
      .replace(/\{.*?\}/g, '')
      .replace(/[^a-zA-Z0-9]/g, '');
  }

  /**
   * Names to try when matching interfaces by convention: the whole path first,
   * then the last resource segment so `/api/products/{id}` matches `Product`.
   */
  private getRouteNameCandidates(route: string): string[] {
    const candidates = [this.normalizeRouteName(route)];
    const resource = route
      .split('/')
      .filter((segment) => segment && !segment.startsWith('{'))
      .pop();
    if (resource) {
      const normalized = this.normalizeRouteName(resource);
      if (normalized && !candidates.includes(normalized)) candidates.push(normalized);
    }
    return candidates;
  }

  private getInterfaceNames(method: string, names: string[]): [string, string] {
    const routeNames: string[] = [];
    names.forEach((routeName) => {
      routeNames.push(routeName);
      if (routeName.endsWith('ies')) {
        routeNames.push(`${routeName.slice(0, -3)}y`);
      } else if (routeName.endsWith('s')) {
        routeNames.push(routeName.slice(0, -1));
      }
    });

    let reqName = '';
    let resName = '';

    switch (method) {
      case 'POST':
        reqName = this.findInterfaceName(routeNames, 'Create', 'Request');
        resName = this.findInterfaceName(routeNames, 'Create', 'Response');
        break;
      case 'PUT':
        reqName = this.findInterfaceName(routeNames, 'Update', 'Request');
        resName = this.findInterfaceName(routeNames, 'Update', 'Response');
        break;
      case 'PATCH':
        reqName = this.findInterfaceName(routeNames, 'Patch', 'Request');
        resName = this.findInterfaceName(routeNames, 'Patch', 'Response');
        break;
      case 'GET':
        resName = this.findInterfaceName(routeNames, 'Get', 'Response');
        break;
      case 'DELETE':
        resName = this.findInterfaceName(routeNames, 'Delete', 'Response');
        break;
    }

    return [reqName, resName];
  }

  private findInterfaceName(routeNames: string[], prefix: string, suffix: string): string {
    for (const routeName of routeNames) {
      const capitalized = routeName.charAt(0).toUpperCase() + routeName.slice(1);
      const name = `${prefix}${capitalized}${suffix}`;
      if (this.interfaces.has(name)) return name;
    }

    return '';
  }
}

// ============================================================================
// Convenience Function
// ============================================================================

/**
 * Quick setup function for basic usage
 */
export function autoSwagger(app: Express, options: AutoSwaggerOptions = {}): AutoSwagger {
  const swagger = new AutoSwagger(app, options);
  swagger.initialize();
  return swagger;
}
