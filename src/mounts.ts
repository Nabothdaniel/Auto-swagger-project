/**
 * Resolves the path prefixes that routers receive through `app.use()` and
 * `router.use()` so scanned routes can be reported with their full path.
 */

import path from 'path';
import fs from 'fs';
import { Node, Project, SourceFile, SyntaxKind } from 'ts-morph';

interface Mount {
  parentFile: string;
  parentReceiver: string;
  prefix: string;
  childKey: string;
}

const SOURCE_FILE = /\.(ts|js)$/;
const RESOLVE_SUFFIXES = ['', '.ts', '.js', '/index.ts', '/index.js'];

export class MountTable {
  constructor(private mounts: Mount[] = []) {}

  /**
   * Every prefix under which routes registered on `receiver` in `filePath` are
   * reachable. Unmounted routers resolve to a single empty prefix.
   */
  prefixesFor(filePath: string, receiver: string): string[] {
    return this.resolve(filePath, receiver, new Set());
  }

  private resolve(filePath: string, receiver: string, seen: Set<string>): string[] {
    const receiverKey = `${filePath}#${receiver}`;
    let targets = this.mounts.filter((mount) => mount.childKey === receiverKey);
    if (targets.length === 0) {
      targets = this.mounts.filter((mount) => mount.childKey === filePath);
    }
    if (targets.length === 0) return [''];

    const prefixes: string[] = [];
    targets.forEach((mount) => {
      const mountId = `${mount.parentFile}#${mount.parentReceiver}>${mount.childKey}`;
      if (seen.has(mountId)) return;

      const parents = this.resolve(
        mount.parentFile,
        mount.parentReceiver,
        new Set(seen).add(mountId)
      );
      parents.forEach((parent) => {
        const prefix = joinRoutePath(parent, mount.prefix);
        if (!prefixes.includes(prefix)) prefixes.push(prefix);
      });
    });

    return prefixes.length > 0 ? prefixes : [''];
  }
}

/**
 * Joins a mount prefix and a route path the way Express does: no duplicate or
 * trailing slashes, and `/` when both parts are empty.
 */
export function joinRoutePath(prefix: string, routePath: string): string {
  const joined = `${prefix}/${routePath}`.replace(/\/+/g, '/').replace(/(.)\/$/, '$1');
  return joined.startsWith('/') ? joined : `/${joined}`;
}

/**
 * Builds the mount table for a set of route files. Besides the route files
 * themselves, only the files sitting directly in the directories between the
 * routes directory and the working directory are read, which is where the
 * application entry point normally lives. This keeps the scan bounded.
 */
export function resolveMounts(routeFiles: string[], routesRoot: string, cwd: string): MountTable {
  const candidates = [...new Set([...routeFiles, ...findEntryFiles(routesRoot, cwd)])]
    .filter((file) => fileMentionsUse(file))
    .sort();
  if (candidates.length === 0) return new MountTable();

  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
    compilerOptions: { allowJs: true },
  });

  const mounts: Mount[] = [];
  candidates.forEach((file) => {
    const sourceFile = project.addSourceFileAtPath(file);
    mounts.push(...collectMounts(sourceFile));
  });

  return new MountTable(mounts);
}

function findEntryFiles(routesRoot: string, cwd: string): string[] {
  const files: string[] = [];
  const root = path.resolve(cwd);
  let dir = path.dirname(path.resolve(routesRoot));

  const insideRoot = (candidate: string) =>
    candidate === root || candidate.startsWith(root + path.sep);

  while (insideRoot(dir)) {
    try {
      fs.readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isFile() && isScannableSource(entry.name))
        .forEach((entry) => files.push(path.join(dir, entry.name)));
    } catch (error) {
      // Skip inaccessible directories
    }

    if (dir === root) break;
    dir = path.dirname(dir);
  }

  return files;
}

function isScannableSource(name: string): boolean {
  return (
    SOURCE_FILE.test(name) &&
    !name.endsWith('.d.ts') &&
    !name.includes('.test.') &&
    !name.includes('.spec.')
  );
}

function fileMentionsUse(file: string): boolean {
  try {
    return fs.readFileSync(file, 'utf-8').includes('.use(');
  } catch (error) {
    return false;
  }
}

function collectMounts(sourceFile: SourceFile): Mount[] {
  const filePath = path.normalize(sourceFile.getFilePath());
  const imports = collectImports(sourceFile, filePath);
  const mounts: Mount[] = [];

  sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).forEach((call) => {
    const callee = call.getExpression();
    if (!Node.isPropertyAccessExpression(callee) || callee.getName() !== 'use') return;

    const receiver = callee.getExpression();
    if (!Node.isIdentifier(receiver)) return;

    const args = call.getArguments();
    const first = args[0];
    const hasPrefix =
      first !== undefined &&
      (Node.isStringLiteral(first) || Node.isNoSubstitutionTemplateLiteral(first));
    const prefix = hasPrefix ? first.getLiteralText() : '';

    args.slice(hasPrefix ? 1 : 0).forEach((arg) => {
      if (!Node.isIdentifier(arg)) return;

      const name = arg.getText();
      const childKey = imports.get(name) ?? localRouterKey(sourceFile, filePath, name);
      if (!childKey) return;

      mounts.push({
        parentFile: filePath,
        parentReceiver: receiver.getText(),
        prefix,
        childKey,
      });
    });
  });

  return mounts;
}

/**
 * Maps local identifiers to the file (default, namespace, and require imports)
 * or the `file#export` pair (named imports) they refer to.
 */
function collectImports(sourceFile: SourceFile, filePath: string): Map<string, string> {
  const imports = new Map<string, string>();
  const fromDir = path.dirname(filePath);

  sourceFile.getImportDeclarations().forEach((declaration) => {
    const target = resolveModule(fromDir, declaration.getModuleSpecifierValue());
    if (!target) return;

    const defaultImport = declaration.getDefaultImport();
    if (defaultImport) imports.set(defaultImport.getText(), target);

    const namespaceImport = declaration.getNamespaceImport();
    if (namespaceImport) imports.set(namespaceImport.getText(), target);

    declaration.getNamedImports().forEach((named) => {
      const localName = named.getAliasNode()?.getText() ?? named.getName();
      imports.set(localName, `${target}#${named.getName()}`);
    });
  });

  sourceFile.getVariableDeclarations().forEach((declaration) => {
    const initializer = declaration.getInitializer();
    if (!initializer || !Node.isCallExpression(initializer)) return;
    if (initializer.getExpression().getText() !== 'require') return;

    const specifier = initializer.getArguments()[0];
    if (!specifier || !Node.isStringLiteral(specifier)) return;

    const target = resolveModule(fromDir, specifier.getLiteralText());
    const nameNode = declaration.getNameNode();
    if (target && Node.isIdentifier(nameNode)) imports.set(nameNode.getText(), target);
  });

  return imports;
}

function localRouterKey(
  sourceFile: SourceFile,
  filePath: string,
  name: string
): string | undefined {
  return sourceFile.getVariableDeclaration(name) ? `${filePath}#${name}` : undefined;
}

function resolveModule(fromDir: string, specifier: string): string | undefined {
  if (!specifier.startsWith('.')) return undefined;

  const base = path.resolve(fromDir, specifier);
  const bases = /\.js$/.test(base) ? [base.replace(/\.js$/, '.ts'), base] : [base];

  for (const candidate of bases) {
    for (const suffix of RESOLVE_SUFFIXES) {
      const full = candidate + suffix;
      try {
        if (fs.statSync(full).isFile()) return path.normalize(full);
      } catch (error) {
        // Try the next candidate
      }
    }
  }

  return undefined;
}
