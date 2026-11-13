import { readFileSync, existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
/**
 * Scans domain directory for contexts with commands.ts and queries.ts
 */
export function scanDomain(domainPath) {
    const result = {};
    if (!existsSync(domainPath)) {
        console.error(`Domain path not found: ${domainPath}`);
        return result;
    }
    const entries = readDirectoryEntries(domainPath);
    for (const entry of entries) {
        const contextPath = join(domainPath, entry);
        const commandsFile = join(contextPath, 'commands.ts');
        const queriesFile = join(contextPath, 'queries.ts');
        const contextName = entry;
        const commands = [];
        const queries = [];
        if (existsSync(commandsFile)) {
            const commandNames = parseRegistryFile(commandsFile, 'commands');
            commands.push(...commandNames);
        }
        if (existsSync(queriesFile)) {
            const queryNames = parseRegistryFile(queriesFile, 'queries');
            queries.push(...queryNames);
        }
        if (commands.length > 0 || queries.length > 0) {
            result[contextName] = { commands, queries };
        }
    }
    return result;
}
/**
 * Reads directory entries (folder names)
 */
function readDirectoryEntries(dirPath) {
    try {
        const entries = readFileSync(dirPath, 'utf-8');
        return entries.split('\n').filter(line => line.trim() !== '');
    }
    catch {
        // Fallback to using shell command for reading directories
        return [];
    }
}
/**
 * Parses a registry file to extract the registry key names
 * e.g., "TaskManagement.AddTodo" from: "TaskManagement.AddTodo": { ...
 */
function parseRegistryFile(filePath, exportName) {
    try {
        const content = readFileSync(filePath, 'utf-8');
        const names = [];
        // Match export const <exportName>: ... = { ... }
        const exportRegex = new RegExp(`export\\s+const\\s+${exportName}\\s*:\\s*[^=]+=\\s*\\{([^}]*)\\}`, 's');
        const exportMatch = content.match(exportRegex);
        if (exportMatch) {
            const registryBody = exportMatch[1];
            // Match keys like "Context.CommandName" or 'Context.CommandName'
            const keyRegex = /["']([^"']+)["']\s*:/g;
            let match;
            while ((match = keyRegex.exec(registryBody)) !== null) {
                names.push(match[1]);
            }
        }
        return names;
    }
    catch (error) {
        console.error(`Error parsing registry file ${filePath}:`, error);
        return [];
    }
}
/**
 * Gets the domain path relative to the current working directory
 */
export function getDomainPath(projectRoot) {
    const base = projectRoot || process.cwd();
    return resolve(base, 'example', 'src', 'domain');
}
//# sourceMappingURL=scanner.js.map