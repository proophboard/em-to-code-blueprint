import {readFileSync} from 'fs';
import {join, resolve, dirname} from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Validates a payload against a TypeScript type definition file.
 * This is a basic validation that checks required properties exist
 * and no additional properties are passed.
 * 
 * @param payload - The JSON payload to validate
 * @param typeFilepath - Path to the TypeScript type definition file
 * @returns true if valid, throws error if invalid
 */
export function validatePayload(payload: Record<string, unknown>, typeFilepath: string): void {
  let typeDefinition: string;
  try {
    typeDefinition = readFileSync(typeFilepath, 'utf-8');
  } catch (e) {
    // No type file found, skip validation
    return;
  }

  // Extract property names from TypeScript type definition
  const properties = extractTypeProperties(typeDefinition);
  
  if (properties.length === 0) {
    return;
  }

  const errors: string[] = [];
  const allowedProperties = properties.map(p => p.name);
  
  for (const prop of properties) {
    const isOptional = prop.optional;
    const propName = prop.name;
    
    if (!(propName in payload)) {
      if (!isOptional) {
        errors.push(`Missing required property: "${propName}"`);
      }
    }
  }
  
  // Check for additional properties
  const payloadKeys = Object.keys(payload);
  for (const key of payloadKeys) {
    if (!allowedProperties.includes(key)) {
      errors.push(`Unexpected property: "${key}". Allowed properties: [${allowedProperties.join(', ')}]`);
    }
  }
  
  if (errors.length > 0) {
    throw new Error(`Payload validation failed:\n${errors.join('\n')}`);
  }
}

/**
 * Extracts property names from a TypeScript type/interface definition.
 */
function extractTypeProperties(typeDefinition: string): Array<{name: string, optional: boolean}> {
  const properties: Array<{name: string, optional: boolean}> = [];
  
  // Remove comments
  let cleanDefinition = typeDefinition.replace(/\/\/.*$/gm, '');
  cleanDefinition = cleanDefinition.replace(/\/\*[\s\S]*?\*\//g, '');
  
  // Look for property definitions inside type/interface blocks
  // Matches: readonly prop: string; or prop?: string;
  const propertyRegex = /(?:readonly\s+)?([a-zA-Z_$][a-zA-Z0-9_$]*)(\?)?\s*:\s*([^;]+)/g;
  
  let match;
  while ((match = propertyRegex.exec(cleanDefinition)) !== null) {
    properties.push({
      name: match[1],
      optional: !!match[2]
    });
  }
  
  return properties;
}

/**
 * Resolves the path to a command payload type file.
 */
export function getPayloadTypePath(domainPath: string, contextName: string, commandName: string): string {
  // Extract command name without context (e.g., "AddTodo" from "TaskManagement.AddTodo")
  const commandBaseName = commandName.split('.').pop();
  if (!commandBaseName) {
    throw new Error(`Invalid command name: ${commandName}`);
  }
  
  // Convert to kebab-case for file path (e.g., "AddTodo" -> "add-todo")
  const fileName = commandBaseName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  
  return join(domainPath, contextName, 'commands', fileName, 'payload.ts');
}

/**
 * Resolves the path to a query payload type file.
 */
export function getQueryTypePath(domainPath: string, contextName: string, queryName: string): string {
  // Extract query name without context (e.g., "TodoList" from "TaskManagement.TodoList")
  const queryBaseName = queryName.split('.').pop();
  if (!queryBaseName) {
    throw new Error(`Invalid query name: ${queryName}`);
  }
  
  // Convert to kebab-case for file path (e.g., "TodoList" -> "todo-list")
  const fileName = queryBaseName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  
  return join(domainPath, contextName, 'information', fileName, 'query.ts');
}
