/**
 * Converts ts-morph types into OpenAPI schema objects and keeps the registry of
 * named schemas that ends up in `components.schemas`.
 */

import type { Symbol as MorphSymbol, Type } from 'ts-morph';

const BUILT_IN_PREFIXES = ['CSS', 'HTML', 'SVG', 'WebGL', 'Audio', 'Video', 'DOM'];

export function isValidSchemaName(name: string): boolean {
  return !BUILT_IN_PREFIXES.some((prefix) => name.startsWith(prefix));
}

/**
 * True when every declaration of the symbol lives in the scanned project rather
 * than in a dependency or a TypeScript lib file.
 */
export function isUserDeclared(symbol: MorphSymbol | undefined): boolean {
  const declarations = symbol?.getDeclarations() ?? [];
  if (declarations.length === 0) return false;

  return declarations.every((declaration) => {
    const sourceFile = declaration.getSourceFile();
    return !sourceFile.isFromExternalLibrary() && !sourceFile.isInNodeModules();
  });
}

export class SchemaConverter {
  constructor(private schemas: Map<string, any>) {}

  /**
   * Adds a named schema to the registry. A placeholder is stored first so a
   * type that refers to itself resolves to a `$ref` instead of recursing.
   */
  register(name: string, type: Type, overwrite = true): void {
    if (!isValidSchemaName(name)) return;
    if (!overwrite && this.schemas.has(name)) return;

    const previous = this.schemas.get(name);
    this.schemas.set(name, previous ?? {});
    try {
      this.schemas.set(name, this.convert(type, new Set([name]), true));
    } catch (error) {
      if (previous === undefined) this.schemas.delete(name);
      else this.schemas.set(name, previous);
      throw error;
    }
  }

  /**
   * Schema for a type used by an operation: a `$ref` for named project types,
   * arrays of them, and an inline schema for everything else.
   */
  reference(type: Type): any {
    if (type.isArray()) {
      return { type: 'array', items: this.reference(type.getArrayElementTypeOrThrow()) };
    }

    const alias = type.getAliasSymbol();
    if (alias && type.getAliasTypeArguments().length === 0 && isUserDeclared(alias)) {
      const name = alias.getName();
      if (isValidSchemaName(name)) {
        this.register(name, type, false);
        return { $ref: `#/components/schemas/${name}` };
      }
    }

    return this.convert(type, new Set());
  }

  convert(type: Type, seen: Set<string>, root = false): any {
    if (type.isString()) return { type: 'string' };
    if (type.isNumber()) return { type: 'number' };
    if (type.isBoolean()) return { type: 'boolean' };
    if (type.isNull() || type.isUndefined()) return {};
    if (type.isStringLiteral()) return { type: 'string', enum: [type.getLiteralValue()] };
    if (type.isNumberLiteral()) return { type: 'number', enum: [type.getLiteralValue()] };

    if (type.isArray()) {
      return {
        type: 'array',
        items: this.convert(type.getArrayElementTypeOrThrow(), seen),
      };
    }

    if (type.isUnion()) {
      const unionTypes = type.getUnionTypes();
      const hasNull = unionTypes.some((member) => member.isNull());
      const nonNullableTypes = unionTypes.filter(
        (member) => !member.isNull() && !member.isUndefined()
      );
      const schemas = nonNullableTypes.map((member) => this.convert(member, seen));
      const schema = schemas.length === 1 ? schemas[0] : { oneOf: schemas };
      if (hasNull) {
        return { ...schema, nullable: true };
      }
      return schema;
    }

    if (type.isIntersection()) {
      return {
        allOf: type.getIntersectionTypes().map((member) => this.convert(member, seen)),
      };
    }

    if (type.getText() === 'Date') {
      return { type: 'string', format: 'date-time' };
    }

    const symbol = type.getSymbol();
    const symbolName = symbol?.getName();
    const expandsRoot = root && symbolName !== undefined && seen.has(symbolName);
    if (
      !expandsRoot &&
      symbolName &&
      !symbolName.startsWith('__') &&
      isValidSchemaName(symbolName)
    ) {
      if (!seen.has(symbolName) && !this.schemas.has(symbolName) && isUserDeclared(symbol)) {
        this.register(symbolName, type);
      }
      return { $ref: `#/components/schemas/${symbolName}` };
    }

    const properties = type.getProperties();
    if (properties.length > 0) {
      return this.convertProperties(properties, seen);
    }

    return { type: 'object' };
  }

  private convertProperties(propertySymbols: MorphSymbol[], seen: Set<string>): any {
    const schemaProperties: Record<string, any> = {};
    const required: string[] = [];

    propertySymbols.forEach((prop) => {
      const declaration = prop.getDeclarations()[0];
      const propType = declaration ? prop.getTypeAtLocation(declaration) : undefined;
      schemaProperties[prop.getName()] = propType
        ? this.convert(propType, seen)
        : { type: 'object' };

      if (!prop.isOptional()) {
        required.push(prop.getName());
      }
    });

    return {
      type: 'object',
      properties: schemaProperties,
      ...(required.length > 0 && { required }),
    };
  }
}
