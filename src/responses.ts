/**
 * Reads the HTTP status codes a route handler sends. Only numeric literals are
 * trusted: `res.status(201)` and `res.sendStatus(204)` add their code, and a
 * bare `res.json()` or `res.send()` means 200. A computed status is ignored
 * rather than guessed.
 */

import { Node, SyntaxKind } from 'ts-morph';
import type {
  ArrowFunction,
  FunctionDeclaration,
  FunctionExpression,
  MethodDeclaration,
} from 'ts-morph';

type FunctionLike = ArrowFunction | FunctionExpression | FunctionDeclaration | MethodDeclaration;

// Response methods that finish the request with the default 200 status
const SEND_METHODS = ['json', 'jsonp', 'send', 'end', 'sendFile', 'render'];
const MAX_DEPTH = 5;

/**
 * Status codes sent by `handlers`, ascending, or undefined when none could be
 * read. A 200 is added when no success code was found, because the handler
 * still has to succeed somewhere.
 *
 * Looking up a controller by name needs the type checker, which loads the
 * TypeScript libraries. Without `followReferences` only inline functions are read.
 */
export function detectStatusCodes(
  handlers: Node[],
  followReferences: boolean
): number[] | undefined {
  const codes = new Set<number>();

  handlers.forEach((handler) => {
    const fn = findFunction(handler, 0, followReferences);
    const responseName = fn && responseParameter(fn);
    if (!fn || !responseName) return;

    fn.getDescendantsOfKind(SyntaxKind.CallExpression).forEach((call) => {
      readStatus(call.getExpression(), call.getArguments(), responseName, codes);
    });
  });

  if (codes.size === 0) return undefined;
  if (![...codes].some((code) => code >= 200 && code < 300)) codes.add(200);
  return [...codes].sort((a, b) => a - b);
}

function readStatus(callee: Node, args: Node[], responseName: string, codes: Set<number>): void {
  if (!Node.isPropertyAccessExpression(callee)) return;

  const receiver = callee.getExpression();
  if (!Node.isIdentifier(receiver) || receiver.getText() !== responseName) return;

  const method = callee.getName();
  if (method === 'status' || method === 'sendStatus') {
    const code = args[0];
    if (code && Node.isNumericLiteral(code)) {
      const value = code.getLiteralValue();
      if (Number.isInteger(value) && value >= 100 && value <= 599) codes.add(value);
    }
  } else if (SEND_METHODS.includes(method)) {
    codes.add(200);
  }
}

function responseParameter(fn: FunctionLike): string | undefined {
  const nameNode = fn.getParameters()[1]?.getNameNode();
  return nameNode && Node.isIdentifier(nameNode) ? nameNode.getText() : undefined;
}

/**
 * Resolves a route argument to the function that runs: an inline function, a
 * local or imported controller, or the function wrapped by a helper such as
 * `asyncHandler(fn)`.
 */
function findFunction(
  node: Node,
  depth: number,
  followReferences: boolean
): FunctionLike | undefined {
  if (depth > MAX_DEPTH) return undefined;

  if (
    Node.isArrowFunction(node) ||
    Node.isFunctionExpression(node) ||
    Node.isFunctionDeclaration(node) ||
    Node.isMethodDeclaration(node)
  ) {
    return node;
  }

  if (
    Node.isParenthesizedExpression(node) ||
    Node.isAsExpression(node) ||
    Node.isSatisfiesExpression(node) ||
    Node.isNonNullExpression(node)
  ) {
    return findFunction(node.getExpression(), depth + 1, followReferences);
  }

  if (Node.isCallExpression(node)) {
    for (const arg of node.getArguments()) {
      const fn = findFunction(arg, depth + 1, followReferences);
      if (fn) return fn;
    }
    return undefined;
  }

  if (Node.isIdentifier(node) || Node.isPropertyAccessExpression(node)) {
    if (!followReferences) return undefined;

    let symbol = node.getSymbol();
    while (symbol?.isAlias()) symbol = symbol.getAliasedSymbol();

    for (const declaration of symbol?.getDeclarations() ?? []) {
      const fn = findFunction(declaration, depth + 1, followReferences);
      if (fn) return fn;
    }
    return undefined;
  }

  if (
    Node.isVariableDeclaration(node) ||
    Node.isPropertyAssignment(node) ||
    Node.isPropertyDeclaration(node)
  ) {
    const initializer = node.getInitializer();
    return initializer && findFunction(initializer, depth + 1, followReferences);
  }

  if (Node.isExportAssignment(node))
    return findFunction(node.getExpression(), depth + 1, followReferences);

  return undefined;
}
