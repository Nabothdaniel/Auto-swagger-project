/**
 * Reads the HTTP status codes a route handler sends. Only statuses with a known
 * value are trusted: `res.status(201)` and `res.sendStatus(204)` add their code,
 * and a bare `res.json()` or `res.send()` means 200. With the type checker,
 * constants, enum members, and small unions of numeric literals are read too.
 * A status typed as `number` or as a whole enum is ignored rather than guessed.
 */

import { Node, SyntaxKind } from 'ts-morph';
import type {
  ArrowFunction,
  FunctionDeclaration,
  FunctionExpression,
  MethodDeclaration,
  Type,
} from 'ts-morph';

type FunctionLike = ArrowFunction | FunctionExpression | FunctionDeclaration | MethodDeclaration;

// Response methods that finish the request with the default 200 status
const SEND_METHODS = ['json', 'jsonp', 'send', 'end', 'sendFile', 'render'];
const MAX_DEPTH = 5;
// A larger union is more likely a catch-all status type than a list of outcomes
const MAX_UNION_CODES = 10;

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
      readStatus(call.getExpression(), call.getArguments(), responseName, codes, followReferences);
    });
  });

  if (codes.size === 0) return undefined;
  if (![...codes].some((code) => code >= 200 && code < 300)) codes.add(200);
  return [...codes].sort((a, b) => a - b);
}

function readStatus(
  callee: Node,
  args: Node[],
  responseName: string,
  codes: Set<number>,
  useChecker: boolean
): void {
  if (!Node.isPropertyAccessExpression(callee)) return;

  const receiver = callee.getExpression();
  if (!Node.isIdentifier(receiver) || receiver.getText() !== responseName) return;

  const method = callee.getName();
  if (method === 'status' || method === 'sendStatus') {
    const code = args[0];
    if (!code) return;
    statusValues(code, useChecker)
      .filter((value) => Number.isInteger(value) && value >= 100 && value <= 599)
      .forEach((value) => codes.add(value));
  } else if (SEND_METHODS.includes(method)) {
    codes.add(200);
  }
}

/**
 * Values a status argument can take. Literals and `cond ? 201 : 409` are read
 * from the syntax tree. Anything else needs the checker: `const CREATED = 201`,
 * `HttpStatus.CREATED`, and a `200 | 404` union resolve to their literal values.
 */
function statusValues(node: Node, useChecker: boolean): number[] {
  if (Node.isNumericLiteral(node)) return [node.getLiteralValue()];

  if (
    Node.isParenthesizedExpression(node) ||
    Node.isAsExpression(node) ||
    Node.isSatisfiesExpression(node) ||
    Node.isNonNullExpression(node)
  ) {
    return statusValues(node.getExpression(), useChecker);
  }

  if (Node.isConditionalExpression(node)) {
    return [
      ...statusValues(node.getWhenTrue(), useChecker),
      ...statusValues(node.getWhenFalse(), useChecker),
    ];
  }

  return useChecker ? literalValues(node.getType()) : [];
}

function literalValues(type: Type): number[] {
  if (type.isNumberLiteral()) return [type.getLiteralValue() as number];

  // A whole enum means any member could be sent, so none of them is documented
  if (!type.isUnion() || type.isEnum()) return [];

  const members = type.getUnionTypes();
  if (members.length > MAX_UNION_CODES || !members.every((member) => member.isNumberLiteral())) {
    return [];
  }
  return members.map((member) => member.getLiteralValue() as number);
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
