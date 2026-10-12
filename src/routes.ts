/**
 * Finds Express route registrations in a source file with the TypeScript syntax
 * tree: `router.get('/x', handler)` calls and `router.route('/x').get(handler)`
 * chains, on routers with any variable name.
 */

import { Node, Project, SourceFile, SyntaxKind } from 'ts-morph';

export interface RouteCall {
  /** Name of the router or app the route is registered on. */
  receiver: string;
  method: string;
  /** Path exactly as declared, before any mount prefix. */
  path: string;
  /** Handler and middleware arguments, in order. */
  handlers: Node[];
}

export const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];

// Names that identify a router when its declaration is not visible, for example
// a parameter of an untyped function.
const ROUTER_NAME = /(?:router|app)$/i;
const ROUTER_TYPE = /\b(?:Router|IRouter|Application|Express)\b/;
const ROUTER_FACTORY = /(?:^|\.)Router$/;

/** A project that parses files without following imports. */
export function createSyntaxProject(): Project {
  return new Project({
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
    compilerOptions: { allowJs: true },
  });
}

/** Routes registered in `sourceFile`, in source order. */
export function findRouteCalls(sourceFile: SourceFile): RouteCall[] {
  const routerNames = collectRouterNames(sourceFile);
  const found: { position: number; route: RouteCall }[] = [];

  sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).forEach((call) => {
    const callee = call.getExpression();
    if (!Node.isPropertyAccessExpression(callee)) return;

    const method = callee.getName().toLowerCase();
    if (!HTTP_METHODS.includes(method)) return;

    const args = call.getArguments();
    const target = resolveReceiver(callee.getExpression(), routerNames);
    if (!target) return;

    // router.route('/x').get(handler) carries the path on the route() call
    const declaredPath = target.path ?? literalText(args[0]);
    const handlers = target.path === undefined ? args.slice(1) : args;
    if (declaredPath === undefined || handlers.length === 0) return;

    found.push({
      position: callee.getNameNode().getStart(),
      route: { receiver: target.receiver, method, path: declaredPath, handlers },
    });
  });

  // A chain is visited from its last call to its first
  return found.sort((a, b) => a.position - b.position).map((entry) => entry.route);
}

interface Receiver {
  receiver: string;
  /** Set when the call is part of a `route(path)` chain. */
  path?: string;
}

function resolveReceiver(expression: Node, routerNames: Set<string>): Receiver | undefined {
  if (Node.isCallExpression(expression)) {
    const callee = expression.getExpression();
    if (!Node.isPropertyAccessExpression(callee)) return undefined;

    const name = callee.getName();
    if (name === 'route') {
      const routePath = literalText(expression.getArguments()[0]);
      const base = routerName(callee.getExpression(), routerNames);
      return base && routePath !== undefined ? { receiver: base, path: routePath } : undefined;
    }

    // route('/x').get(a).post(b): keep walking back to the route() call
    if (HTTP_METHODS.includes(name.toLowerCase())) {
      const chained = resolveReceiver(callee.getExpression(), routerNames);
      return chained?.path !== undefined ? chained : undefined;
    }
    return undefined;
  }

  const receiver = routerName(expression, routerNames);
  return receiver ? { receiver } : undefined;
}

function routerName(expression: Node, routerNames: Set<string>): string | undefined {
  let name: string | undefined;
  if (Node.isIdentifier(expression)) name = expression.getText();
  else if (Node.isPropertyAccessExpression(expression)) name = expression.getName();

  return name && (routerNames.has(name) || ROUTER_NAME.test(name)) ? name : undefined;
}

function literalText(node: Node | undefined): string | undefined {
  if (node && (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node))) {
    return node.getLiteralText();
  }
  return undefined;
}

/**
 * Names declared as an Express router or app: assigned from `express()` or
 * `Router()`, or annotated with an Express type. `map.get('key')` and
 * `axios.get('/url')` never qualify.
 */
function collectRouterNames(sourceFile: SourceFile): Set<string> {
  const names = new Set<string>();
  const expressBindings = collectExpressBindings(sourceFile);

  [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.PropertyDeclaration),
  ].forEach((declaration) => {
    const initializer = declaration.getInitializer();
    const typeText = declaration.getTypeNode()?.getText() ?? '';
    if (ROUTER_TYPE.test(typeText) || isRouterFactory(initializer, expressBindings)) {
      names.add(declaration.getName());
    }
  });

  sourceFile.getDescendantsOfKind(SyntaxKind.Parameter).forEach((parameter) => {
    if (ROUTER_TYPE.test(parameter.getTypeNode()?.getText() ?? '')) {
      names.add(parameter.getName());
    }
  });

  return names;
}

/** Local names bound to the express module, so `express()` is recognized. */
function collectExpressBindings(sourceFile: SourceFile): Set<string> {
  const bindings = new Set<string>();

  sourceFile.getImportDeclarations().forEach((declaration) => {
    if (declaration.getModuleSpecifierValue() !== 'express') return;
    const defaultImport = declaration.getDefaultImport();
    if (defaultImport) bindings.add(defaultImport.getText());
    const namespaceImport = declaration.getNamespaceImport();
    if (namespaceImport) bindings.add(namespaceImport.getText());
  });

  sourceFile.getVariableDeclarations().forEach((declaration) => {
    const initializer = declaration.getInitializer();
    if (!initializer || !Node.isCallExpression(initializer)) return;
    if (initializer.getExpression().getText() !== 'require') return;

    const specifier = literalText(initializer.getArguments()[0]);
    const nameNode = declaration.getNameNode();
    if (specifier === 'express' && Node.isIdentifier(nameNode)) bindings.add(nameNode.getText());
  });

  return bindings;
}

function isRouterFactory(initializer: Node | undefined, expressBindings: Set<string>): boolean {
  let node = initializer;
  while (
    node &&
    (Node.isParenthesizedExpression(node) ||
      Node.isAsExpression(node) ||
      Node.isSatisfiesExpression(node) ||
      Node.isNonNullExpression(node))
  ) {
    node = node.getExpression();
  }

  if (!node || !(Node.isCallExpression(node) || Node.isNewExpression(node))) return false;

  const callee = node.getExpression().getText();
  return ROUTER_FACTORY.test(callee) || expressBindings.has(callee);
}
