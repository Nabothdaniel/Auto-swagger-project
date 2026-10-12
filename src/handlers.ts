/**
 * Reads request and response body types from route handlers. The TypeScript
 * checker resolves the handler expression, so inline functions, imported
 * controllers, `RequestHandler<...>` annotations, and `satisfies` expressions
 * are all handled the same way.
 */

import path from 'path';
import fs from 'fs';
import { Node, Project, SourceFile, Type, ts } from 'ts-morph';
import { findRouteCalls } from './routes';
import { SchemaConverter } from './schema';

export interface HandlerSchemas {
  request?: any;
  response?: any;
}

// Positions of the body types in Request<Params, ResBody, ReqBody, Query> and
// Response<ResBody>.
const REQUEST_RES_BODY = 1;
const REQUEST_REQ_BODY = 2;
const RESPONSE_RES_BODY = 0;

export class HandlerTypeTable {
  private entries = new Map<string, HandlerSchemas>();

  set(
    filePath: string,
    receiver: string,
    method: string,
    routePath: string,
    schemas: HandlerSchemas
  ): void {
    this.entries.set(this.key(filePath, receiver, method, routePath), schemas);
  }

  get(
    filePath: string,
    receiver: string,
    method: string,
    routePath: string
  ): HandlerSchemas | undefined {
    return this.entries.get(this.key(filePath, receiver, method, routePath));
  }

  private key(filePath: string, receiver: string, method: string, routePath: string): string {
    return [path.normalize(filePath), receiver, method.toLowerCase(), routePath].join('|');
  }
}

/**
 * Resolves handler body types for every TypeScript route file. Named types are
 * added to `schemas` so the `$ref` entries in the returned table always resolve,
 * including types declared outside the routes directory.
 */
export function resolveHandlerTypes(
  routeFiles: string[],
  schemas: Map<string, any>,
  cwd: string
): HandlerTypeTable {
  const table = new HandlerTypeTable();
  const typedFiles = routeFiles.filter((file) => file.endsWith('.ts')).sort();
  if (typedFiles.length === 0) return table;

  const project = createProject(cwd);
  const converter = new SchemaConverter(schemas);

  typedFiles.forEach((file) => {
    const sourceFile = project.addSourceFileAtPath(file);
    collectHandlerTypes(sourceFile, converter, table);
  });

  return table;
}

function createProject(cwd: string): Project {
  const compilerOptions = {
    allowJs: true,
    noEmit: true,
    skipLibCheck: true,
    // Load only the type packages the route files import, not every @types/*.
    types: [],
  };

  const tsConfigFilePath = path.join(cwd, 'tsconfig.json');
  if (fs.existsSync(tsConfigFilePath)) {
    try {
      return new Project({
        tsConfigFilePath,
        skipAddingFilesFromTsConfig: true,
        compilerOptions,
      });
    } catch (error) {
      // Fall back to default options when the project tsconfig cannot be read
    }
  }

  return new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      ...compilerOptions,
      strict: true,
      esModuleInterop: true,
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
    },
  });
}

function collectHandlerTypes(
  sourceFile: SourceFile,
  converter: SchemaConverter,
  table: HandlerTypeTable
): void {
  const filePath = sourceFile.getFilePath();

  findRouteCalls(sourceFile).forEach((route) => {
    try {
      const schemas = readHandlerSchemas(route.handlers[route.handlers.length - 1], converter);
      if (schemas.request || schemas.response) {
        table.set(filePath, route.receiver, route.method, route.path, schemas);
      }
    } catch (error) {
      // Leave the route to naming-convention matching
    }
  });
}

function readHandlerSchemas(handler: Node, converter: SchemaConverter): HandlerSchemas {
  const signature = handler.getType().getCallSignatures()[0];
  if (!signature) return {};

  const [requestParam, responseParam] = signature.getParameters();
  const requestArgs = requestParam
    ? requestParam.getTypeAtLocation(handler).getTypeArguments()
    : [];
  const responseArgs = responseParam
    ? responseParam.getTypeAtLocation(handler).getTypeArguments()
    : [];

  const requestBody = specified(requestArgs[REQUEST_REQ_BODY]);
  const responseBody =
    specified(responseArgs[RESPONSE_RES_BODY]) ?? specified(requestArgs[REQUEST_RES_BODY]);

  return {
    ...(requestBody && { request: converter.reference(requestBody) }),
    ...(responseBody && { response: converter.reference(responseBody) }),
  };
}

/**
 * Express defaults unspecified body types to `any`. Those, `unknown`, `never`,
 * and `void` carry no schema information.
 */
function specified(type: Type | undefined): Type | undefined {
  if (!type) return undefined;
  if (type.isAny() || type.isUnknown() || type.isNever() || type.isVoid()) return undefined;
  if (type.isUndefined() || type.isNull()) return undefined;
  return type;
}
