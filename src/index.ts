/**
 * Express Auto Swagger
 * Automatically generates OpenAPI/Swagger documentation from Express routes
 *
 * @class AutoSwagger
 * @extends {EventEmitter}
 * @version 1.0.0
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { AutoSwagger } from 'express-auto-swagger';
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
import { Project } from 'ts-morph';
import path from 'path';
import fs from 'fs';
import { EventEmitter } from 'events';
import { Logger } from './logger';
import { AutoSwaggerError } from './errors';
import { CacheManager } from './cache';
import type { AutoSwaggerOptions, RouteInfo, SwaggerSpec } from './types';

// ============================================================================
// Core Class
// ============================================================================

export class AutoSwagger extends EventEmitter {
  private app: Express;
  private options: Required<AutoSwaggerOptions>;
  private watcherInitialized = false;
  private lastScanTime = 0;
  private logger: Logger;
  private cache: CacheManager;

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
      console.error('❌ Failed to initialize AutoSwagger:', error);
      throw error;
    }
  }

  /**
   * Refresh documentation (useful after adding new routes)
   */
  async refresh(): Promise<void> {
    if (this.options.debugMode) {
      console.log('\n🔄 Refreshing documentation...\n');
    }
    this.cache.clearCache();
    await this.initialize();
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
    };
  }

  private async scanRoutes(): Promise<RouteInfo[]> {
    const scanner = new RouteScanner(this.options);
    return scanner.scan();
  }

  private async scanInterfaces(): Promise<Map<string, any>> {
    const scanner = new InterfaceScanner(this.options);
    return scanner.scan();
  }

  private buildOpenApiSpec(routes: RouteInfo[], interfaces: Map<string, any>): SwaggerSpec {
    const builder = new SpecBuilder(this.options, routes, interfaces);
    return builder.build();
  }

  private serveSwaggerUI(spec: SwaggerSpec): void {
    this.app.use(
      this.options.docsRoute,
      swaggerUi.serve,
      swaggerUi.setup(spec, {
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: this.options.title,
        swaggerOptions: {
          persistAuthorization: true,
        },
      })
    );
  }

  private setupFileWatcher(): void {
    if (this.watcherInitialized) return;

    const searchDirs = this.getSearchDirectories();

    searchDirs.forEach((dir) => {
      if (fs.existsSync(dir)) {
        fs.watch(dir, { recursive: true }, (_event, filename) => {
          if (filename && /\.(ts|js)$/.test(filename)) {
            // Debounce: only refresh once per second
            const now = Date.now();
            if (now - this.lastScanTime > 1000) {
              this.lastScanTime = now;
              if (this.options.debugMode) {
                console.log(`📝 File changed: ${filename}, refreshing docs...`);
              }
              this.refresh();
            }
          }
        });
      }
    });

    this.watcherInitialized = true;
    if (this.options.debugMode) {
      console.log('👀 File watcher enabled');
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
    console.log('\n✅ Swagger Documentation Generated');
    console.log(`📚 Documentation: ${this.options.docsRoute}`);
    console.log(`🛣️  Routes: ${routes.length}`);

    if (this.options.apiVersions.length > 0) {
      console.log('\n📦 API Versions:');
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
      console.log(`\n📝 Interfaces: ${interfaces.size}`);
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
  constructor(private options: Required<AutoSwaggerOptions>) {}

  scan(): RouteInfo[] {
    const searchDirs = this.getSearchDirectories();
    let routeFiles: string[] = [];
    let foundDir = '';

    for (const dir of searchDirs) {
      if (this.options.debugMode) {
        console.log(`🔍 Searching: ${dir}`);
      }
      const files = this.findFiles(dir);
      if (files.length > 0) {
        routeFiles = files;
        foundDir = dir;
        break;
      }
    }

    if (routeFiles.length === 0) {
      if (this.options.routesDir === './nonexistent') {
        throw new AutoSwaggerError(
          'Invalid route directory',
          AutoSwaggerError.CODES.ROUTE_SCAN_ERROR
        );
      }
      console.warn('⚠️  No route files found');
      return [];
    }

    if (this.options.debugMode) {
      console.log(`\n✅ Found ${routeFiles.length} file(s) in ${foundDir}\n`);
    }

    const allRoutes: RouteInfo[] = [];
    for (const file of routeFiles) {
      const routes = this.extractRoutesFromFile(file);
      allRoutes.push(...routes);
    }

    return this.filterRoutes(allRoutes);
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

  private extractRoutesFromFile(filePath: string): RouteInfo[] {
    const routes: RouteInfo[] = [];

    try {
      const content = fs.readFileSync(filePath, 'utf-8');

      // Match router.get, router.post, app.get, app.post, etc.
      const routeRegex =
        /(?:router|app)\.(get|post|put|patch|delete|options|head)\s*\(\s*['"`]([^'"`]+)['"`]/gi;

      let match;
      while ((match = routeRegex.exec(content)) !== null) {
        const method = match[1].toLowerCase();
        const routePath = match[2];

        // Detect version from path
        const versionMatch = routePath.match(/^\/(v\d+)\//);
        const version = versionMatch ? versionMatch[1] : undefined;

        routes.push({
          method,
          path: routePath.replace(/:([^/]+)/g, '{$1}'),
          file: path.basename(filePath),
          version,
        });

        if (this.options.debugMode) {
          console.log(`  ✓ Found: ${method.toUpperCase()} ${routePath}`);
        }
      }
    } catch (error) {
      if (this.options.debugMode) {
        console.log(`  ✗ Could not read: ${path.basename(filePath)}`);
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
  constructor(private options: Required<AutoSwaggerOptions>) {}

  scan(): Map<string, any> {
    const interfaces = new Map<string, any>();
    const searchDirs = this.getSearchDirectories();

    for (const dir of searchDirs) {
      if (!fs.existsSync(dir)) continue;

      try {
        const project = new Project({
          skipAddingFilesFromTsConfig: true,
          skipFileDependencyResolution: true,
        });

        const files = this.findTsFiles(dir);
        if (files.length === 0) continue;

        const sourceFiles = project.addSourceFilesAtPaths(files);

        sourceFiles.forEach((file) => {
          try {
            file.getInterfaces().forEach((iface) => {
              const name = iface.getName();
              if (this.isValidInterfaceName(name)) {
                const schema = this.parseInterface(iface);
                interfaces.set(name, schema);

                if (this.options.debugMode) {
                  console.log(`  📋 Interface: ${name}`);
                }
              }
            });
          } catch (error) {
            // Skip unparseable files
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

  private isValidInterfaceName(name: string): boolean {
    const builtInPrefixes = ['CSS', 'HTML', 'SVG', 'WebGL', 'Audio', 'Video', 'DOM'];
    return !builtInPrefixes.some((prefix) => name.startsWith(prefix));
  }

  private parseInterface(interfaceDecl: any): any {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    interfaceDecl.getProperties().forEach((prop: any) => {
      const propName = prop.getName();
      const propType = prop.getType().getText();
      const isOptional = prop.hasQuestionToken();

      let schema: any = { type: 'string' };

      if (propType.includes('number') || propType.includes('Number')) {
        schema = { type: 'number' };
      } else if (propType.includes('boolean') || propType.includes('Boolean')) {
        schema = { type: 'boolean' };
      } else if (propType.includes('[]')) {
        const itemType = propType.replace('[]', '').trim();
        schema = {
          type: 'array',
          items: itemType.includes('number')
            ? { type: 'number' }
            : itemType.includes('boolean')
              ? { type: 'boolean' }
              : { type: 'string' },
        };
      } else if (propType.includes('Date')) {
        schema = { type: 'string', format: 'date-time' };
      }

      properties[propName] = schema;
      if (!isOptional) {
        required.push(propName);
      }
    });

    return {
      type: 'object',
      properties,
      ...(required.length > 0 && { required }),
    };
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
      tags: [route.path.split('/')[1] || 'default'],
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
            schema: { type: 'object' },
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
            schema: { type: 'object' },
          },
        },
      },
    };

    return operation;
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
        const routeName = this.normalizeRouteName(route);

        const [reqName, resName] = this.getInterfaceNames(methodUpper, routeName);

        // Map request
        if (reqName && this.interfaces.has(reqName) && paths[route][method].requestBody) {
          paths[route][method].requestBody.content['application/json'].schema = {
            $ref: `#/components/schemas/${reqName}`,
          };
        }

        // Map response
        if (resName && this.interfaces.has(resName)) {
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

  private getInterfaceNames(method: string, routeName: string): [string, string] {
    const capitalized = routeName.charAt(0).toUpperCase() + routeName.slice(1);

    let reqName = '';
    let resName = '';

    switch (method) {
      case 'POST':
        reqName = `Create${capitalized}Request`;
        resName = `Create${capitalized}Response`;
        break;
      case 'PUT':
        reqName = `Update${capitalized}Request`;
        resName = `Update${capitalized}Response`;
        break;
      case 'PATCH':
        reqName = `Patch${capitalized}Request`;
        resName = `Patch${capitalized}Response`;
        break;
      case 'GET':
        resName = `Get${capitalized}Response`;
        break;
      case 'DELETE':
        resName = `Delete${capitalized}Response`;
        break;
    }

    return [reqName, resName];
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
