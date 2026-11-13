import { printCodegenHelp } from './help';
import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, readdirSync, statSync, renameSync, unlinkSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { getDomainPath } from '../bin/scanner';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function generateInformation(contextName: string, informationName: string, noQuery: boolean, noProjection: boolean) {
  const domainPath = getDomainPath();
  
  // Normalize information name - if already fully qualified, extract just the information part
  let fqcn: string;
  let informationShortName: string;
  
  if (informationName.includes('.')) {
    // Already fully qualified
    const parts = informationName.split('.');
    if (parts.length !== 2) {
      console.error(`Error: Information name must be in PascalCase (e.g., TodoList) or fully qualified (e.g., TaskManagement.TodoList): ${informationName}`);
      process.exit(1);
    }
    // Validate that the context part matches
    if (parts[0] !== contextName) {
      console.error(`Error: Context mismatch. Context is "${contextName}" but information specifies "${parts[0]}".`);
      process.exit(1);
    }
    fqcn = informationName;
    informationShortName = parts[1];
  } else {
    // Not fully qualified, construct FQCN
    fqcn = `${contextName}.${informationName}`;
    informationShortName = informationName;
  }
  
  // Validate informationShortName is in PascalCase
  if (!/^[A-Z][a-zA-Z0-9]*$/.test(informationShortName)) {
    console.error(`Error: Information name must be in PascalCase (e.g., TodoList): ${informationShortName}`);
    process.exit(1);
  }
  
  // Convert to kebab-case for folder/file names
  const kebabCaseName = informationShortName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  
  // Context directory in kebab-case
  const contextKebabCase = contextName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  const contextDir = join(domainPath, contextKebabCase);
  
  console.log(`Generating information "${fqcn}" in context "${contextName}"...`);
  console.log(`  Context: ${contextName} -> ${contextKebabCase}`);
  console.log(`  Information name: ${informationShortName} -> ${kebabCaseName}`);
  console.log(`  FQCN: ${fqcn}`);
  console.log(`  Target directory: ${contextDir}/information/${kebabCaseName}`);
  console.log(`  No Query: ${noQuery}`);
  console.log(`  No Projection: ${noProjection}`);
  
  // Validate context exists
  if (!existsSync(contextDir)) {
    console.error(`Error: Context does not exist: ${contextDir}`);
    console.error(`  Hint: Use "app codegen context ${contextName}" to generate the context first.`);
    process.exit(1);
  }
  
  // Validate information is not already registered (check information directory)
  const targetInformationDir = join(contextDir, 'information', kebabCaseName);
  if (existsSync(targetInformationDir)) {
    console.error(`Error: Information directory already exists: ${targetInformationDir}`);
    console.error(`  Hint: Information "${fqcn}" is already registered in context "${contextName}".`);
    process.exit(1);
  }
  
  // Create information directory if it doesn't exist
  const informationDir = join(contextDir, 'information');
  if (!existsSync(informationDir)) {
    mkdirSync(informationDir, { recursive: true });
    console.log(`✓ Created information directory: ${informationDir}`);
  }
  
  // Create information directory
  mkdirSync(targetInformationDir, { recursive: true });
  console.log(`✓ Created information directory: ${targetInformationDir}`);
  
  // Copy files from blueprint
  const blueprintPath = join(__dirname, '..', 'blueprint', 'domain', '__context__', 'information', '__information__');
  
  if (!existsSync(blueprintPath)) {
    console.error(`Error: Blueprint path not found: ${blueprintPath}`);
    process.exit(1);
  }
  
  const blueprintItems = readdirSync(blueprintPath);
  
  for (const item of blueprintItems) {
    const blueprintItemPath = join(blueprintPath, item);
    const targetItemPath = join(targetInformationDir, item);
    const itemStat = statSync(blueprintItemPath);
    
    // Skip query.ts and resolve.ts if --no-query flag was used
    if (noQuery && (item === 'query.ts' || item === 'resolve.ts')) {
      console.log(`  ⊘ Skipped (no-query): ${item}`);
      continue;
    }
    
    if (itemStat.isDirectory()) {
      if (item === 'projection' && noProjection) {
        console.log(`  ⊘ Skipped (no-projection): ${item}`);
        continue;
      }
      mkdirSync(targetItemPath, { recursive: true });
    } else {
      copyFileSync(blueprintItemPath, targetItemPath);
      console.log(`  ✓ Copied: ${item}`);
    }
  }
  
  // Rename __information__.ts to kebab-case name and update content
  const blueprintInformationPath = join(targetInformationDir, '__information__.ts');
  const informationTsPath = join(targetInformationDir, `${kebabCaseName}.ts`);

  if (existsSync(blueprintInformationPath)) {
    let content = readFileSync(blueprintInformationPath, 'utf-8');
    // Replace placeholder in content with PascalCase name
    content = content.replace(/__Information__/g, informationShortName);
    writeFileSync(informationTsPath, content, 'utf-8');
    console.log(`  ✓ Created: ${kebabCaseName}.ts`);

    // Delete the original placeholder file
    unlinkSync(blueprintInformationPath);
    console.log(`  ✓ Removed: __information__.ts`);
  }
  
  // If query.ts was copied, update it
  if (!noQuery) {
    const queryPath = join(targetInformationDir, 'query.ts');
    if (existsSync(queryPath)) {
      let content = readFileSync(queryPath, 'utf-8');
      // No placeholder replacement needed for query.ts currently
      writeFileSync(queryPath, content, 'utf-8');
      console.log(`  ✓ Updated: query.ts`);
    }
  }
  
  // If resolve.ts was copied, update it
  if (!noQuery) {
    const resolvePath = join(targetInformationDir, 'resolve.ts');
    if (existsSync(resolvePath)) {
      let content = readFileSync(resolvePath, 'utf-8');
      // Replace __information__ with kebab-case name
      content = content.replace(/__information__/g, kebabCaseName);
      // Replace __Information__ with PascalCase name (without context)
      content = content.replace(/__Information__/g, informationShortName);
      writeFileSync(resolvePath, content, 'utf-8');
      console.log(`  ✓ Updated: resolve.ts`);
    }
  }
  
  // Add information to queries.ts registry if not --no-query
  if (!noQuery) {
    const queriesFilePath = join(contextDir, 'queries.ts');
    
    // Create queries.ts if it doesn't exist
    if (!existsSync(queriesFilePath)) {
      const initialContent = `import {QueryRegistry} from "@lib/types/query-registry";\n\nexport const queries: QueryRegistry = {\n};\n`;
      writeFileSync(queriesFilePath, initialContent, 'utf-8');
      console.log(`✓ Created queries.ts registry`);
    }
    
    let queriesContent = readFileSync(queriesFilePath, 'utf-8');
    
    // Determine the import name (PascalCase, e.g., resolveTodoList)
    const importName = informationShortName;
    
    // Generate import statement
    const importLine = `import resolve${importName} from "./information/${kebabCaseName}/resolve";`;
    
    // Check if import already exists and add if needed
    if (!queriesContent.includes(`resolve${importName}`)) {
      // Find the last import statement and insert after it (without blank line between imports)
      const importLines = queriesContent.split('\n').filter(line => line.trim().startsWith('import'));
      if (importLines.length > 0) {
        const lastImportLine = importLines[importLines.length - 1];
        const insertPos = queriesContent.indexOf(lastImportLine) + lastImportLine.length;
        const afterNewline = queriesContent.indexOf('\n', insertPos) + 1;
        // Insert new import without blank line between imports
        queriesContent = queriesContent.slice(0, afterNewline) + importLine + queriesContent.slice(afterNewline);
      } else {
        // No imports, add after the first line (import {QueryRegistry}...)
        const firstNewline = queriesContent.indexOf('\n');
        // Add import without blank line after it (blank line will be added before export)
        queriesContent = queriesContent.slice(0, firstNewline + 1) + importLine + queriesContent.slice(firstNewline + 1);
      }
      
      // Ensure there's exactly one blank line between the last import and the export statement
      const lines = queriesContent.split('\n');
      let lastImportLineText = '';
      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].trim().startsWith('import')) {
          lastImportLineText = lines[i];
          break;
        }
      }
      const lastImportIdx = queriesContent.indexOf(lastImportLineText);
      if (lastImportIdx >= 0) {
        const afterImport = queriesContent.indexOf('\n', lastImportIdx + lastImportLineText.length);
        if (afterImport >= 0) {
          const remaining = queriesContent.slice(afterImport + 1);
          // Check if next line (after potential whitespace) starts with 'export'
          const nextNonEmptyLine = remaining.split('\n').find(line => line.trim().length > 0) || '';
          if (nextNonEmptyLine.trim().startsWith('export')) {
            // Replace any number of newlines with exactly one blank line before export
            // Remove all leading newlines from remaining, then add exactly one
            const trimmedRemaining = remaining.replace(/^\n+/, '');
            queriesContent = queriesContent.slice(0, afterImport + 1) + '\n' + trimmedRemaining;
          }
        }
      }
    }
    
    // Add information registration with proper formatting (2 spaces indentation)
    const informationEntry = `  "${fqcn}": {\n    resolve: resolve${importName},\n  },`;
    
    // Insert before the closing brace
    const closingBraceMatch = queriesContent.match(/\};$/m);
    if (closingBraceMatch) {
      const insertPos = closingBraceMatch.index || 0;
      queriesContent = queriesContent.slice(0, insertPos) + informationEntry + '\n' + queriesContent.slice(insertPos);
    }
    
    writeFileSync(queriesFilePath, queriesContent, 'utf-8');
    console.log(`✓ Added information "${fqcn}" to queries.ts`);
  }
  
  // Create empty projection folder if not --no-projection
  if (!noProjection) {
    const projectionDir = join(targetInformationDir, 'projection');
    mkdirSync(projectionDir, { recursive: true });
    console.log(`  ✓ Created projection folder: projection/`);
  }
  
  console.log(`\n✓ Information "${fqcn}" generated successfully!`);
  console.log(`  Run "app list" to see the new information.`);
}
