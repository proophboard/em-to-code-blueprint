import { printCodegenHelp } from './help';
import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { getDomainPath } from '../bin/scanner';
import { generateInformation } from './information.js';
import { generateEvent } from './event.js';
import { generateProjectionCase } from './prjcase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function handleCodegen(args: string[]) {
  if (args.length === 0) {
    printCodegenHelp();
    process.exit(1);
  }

  const subCommand = args[0];
  const subCommandArgs = args.slice(1);

  if (subCommand === 'context') {
    if (subCommandArgs.length === 0) {
      console.error('Error: Context name is required');
      printCodegenHelp();
      process.exit(1);
    }

    const contextName = subCommandArgs[0];
    const eventSourced = subCommandArgs.includes('--event-sourced');
    
    // Validate context name is in PascalCase
    if (!/^[A-Z][a-zA-Z0-9]*$/.test(contextName)) {
      console.error(`Error: Context name must be in PascalCase (e.g., TaskManagement): ${contextName}`);
      process.exit(1);
    }

    generateContext(contextName, eventSourced);
  } else if (subCommand === 'command') {
    if (subCommandArgs.length < 2) {
      console.error('Error: Context and command name are required');
      console.error('Usage: app codegen command [Context] [Name]');
      console.error('Example: app codegen command TaskManagement AddTodo');
      printCodegenHelp();
      process.exit(1);
    }

    const contextName = subCommandArgs[0];
    const commandName = subCommandArgs[1];

    // Validate context name is in PascalCase
    if (!/^[A-Z][a-zA-Z0-9]*$/.test(contextName)) {
      console.error(`Error: Context name must be in PascalCase (e.g., TaskManagement): ${contextName}`);
      process.exit(1);
    }

    // Validate command name is in PascalCase or already fully qualified
    if (!/^[A-Z][a-zA-Z0-9]*$/.test(commandName) && !/^[A-Z][a-zA-Z0-9]+\.[A-Z][a-zA-Z0-9]*$/.test(commandName)) {
      console.error(`Error: Command name must be in PascalCase (e.g., AddTodo) or fully qualified (e.g., TaskManagement.AddTodo): ${commandName}`);
      process.exit(1);
    }

    generateCommand(contextName, commandName);
  } else if (subCommand === 'information') {
    if (subCommandArgs.length < 2) {
      console.error('Error: Context and information name are required');
      console.error('Usage: app codegen information [Context] [Name]');
      console.error('Example: app codegen information TaskManagement TodoList');
      printCodegenHelp();
      process.exit(1);
    }

    const contextName = subCommandArgs[0];
    const informationName = subCommandArgs[1];
    
    // Check for optional flags
    const noQuery = subCommandArgs.includes('--no-query');
    const noProjection = subCommandArgs.includes('--no-projection');

    // Validate context name is in PascalCase
    if (!/^[A-Z][a-zA-Z0-9]*$/.test(contextName)) {
      console.error(`Error: Context name must be in PascalCase (e.g., TaskManagement): ${contextName}`);
      process.exit(1);
    }

    // Validate information name is in PascalCase or already fully qualified
    if (!/^[A-Z][a-zA-Z0-9]*$/.test(informationName) && !/^[A-Z][a-zA-Z0-9]+\.[A-Z][a-zA-Z0-9]*$/.test(informationName)) {
      console.error(`Error: Information name must be in PascalCase (e.g., TodoList) or fully qualified (e.g., TaskManagement.TodoList): ${informationName}`);
      process.exit(1);
    }

    generateInformation(contextName, informationName, noQuery, noProjection);
  } else if (subCommand === 'event') {
    if (subCommandArgs.length < 3) {
      console.error('Error: Context, command, and event name are required');
      console.error('Usage: app codegen event [Context] [Command] [Name]');
      console.error('Example: app codegen event TaskManagement AddTodo TodoAdded');
      printCodegenHelp();
      process.exit(1);
    }

    const contextName = subCommandArgs[0];
    const commandName = subCommandArgs[1];
    const eventName = subCommandArgs[2];

    // Validate context name is in PascalCase
    if (!/^[A-Z][a-zA-Z0-9]*$/.test(contextName)) {
      console.error(`Error: Context name must be in PascalCase (e.g., TaskManagement): ${contextName}`);
      process.exit(1);
    }

    // Validate command name is in PascalCase or already fully qualified
    if (!/^[A-Z][a-zA-Z0-9]*$/.test(commandName) && !/^[A-Z][a-zA-Z0-9]+\.[A-Z][a-zA-Z0-9]*$/.test(commandName)) {
      console.error(`Error: Command name must be in PascalCase (e.g., AddTodo) or fully qualified (e.g., TaskManagement.AddTodo): ${commandName}`);
      process.exit(1);
    }

    // Validate event name is in PascalCase or already fully qualified
    if (!/^[A-Z][a-zA-Z0-9]*$/.test(eventName) && !/^[A-Z][a-zA-Z0-9]+\.[A-Z][a-zA-Z0-9]*$/.test(eventName)) {
      console.error(`Error: Event name must be in PascalCase (e.g., TodoAdded) or fully qualified (e.g., TaskManagement.TodoAdded): ${eventName}`);
      process.exit(1);
    }

    generateEvent(contextName, commandName, eventName);
  } else if (subCommand === 'prjcase') {
    if (subCommandArgs.length < 3) {
      console.error('Error: Context, information, and event name are required');
      console.error('Usage: app codegen prjcase [Context] [Information] [Event]');
      console.error('Example: app codegen prjcase TaskManagement TodoList TodoAdded');
      printCodegenHelp();
      process.exit(1);
    }

    const contextName = subCommandArgs[0];
    const informationName = subCommandArgs[1];
    const eventName = subCommandArgs[2];

    // Validate context name is in PascalCase
    if (!/^[A-Z][a-zA-Z0-9]*$/.test(contextName)) {
      console.error(`Error: Context name must be in PascalCase (e.g., TaskManagement): ${contextName}`);
      process.exit(1);
    }

    // Validate information name is in PascalCase or already fully qualified
    if (!/^[A-Z][a-zA-Z0-9]*$/.test(informationName) && !/^[A-Z][a-zA-Z0-9]+\.[A-Z][a-zA-Z0-9]*$/.test(informationName)) {
      console.error(`Error: Information name must be in PascalCase (e.g., TodoList) or fully qualified (e.g., TaskManagement.TodoList): ${informationName}`);
      process.exit(1);
    }

    // Validate event name is in PascalCase or already fully qualified
    if (!/^[A-Z][a-zA-Z0-9]*$/.test(eventName) && !/^[A-Z][a-zA-Z0-9]+\.[A-Z][a-zA-Z0-9]*$/.test(eventName)) {
      console.error(`Error: Event name must be in PascalCase (e.g., TodoAdded) or fully qualified (e.g., TaskManagement.TodoAdded): ${eventName}`);
      process.exit(1);
    }

    generateProjectionCase(contextName, informationName, eventName);
  } else {
    console.error(`Unknown codegen command: ${subCommand}`);
    printCodegenHelp();
    process.exit(1);
  }
}

function generateContext(contextName: string, eventSourced: boolean) {
  const __dirname = dirname(__filename);
  const blueprintPath = join(__dirname, '..', 'blueprint', 'domain', '__context__');
  const domainPath = getDomainPath();
  
  // Convert PascalCase to kebab-case for directory name
  const kebabCaseName = contextName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  const targetDir = join(domainPath, kebabCaseName);
  
  // Convert to snake_case for placeholder replacement
  const snakeCaseName = contextName.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
  
  console.log(`Generating context "${contextName}"...`);
  console.log(`  PascalCase: ${contextName}`);
  console.log(`  kebab-case: ${kebabCaseName}`);
  console.log(`  snake_case: ${snakeCaseName}`);
  console.log(`  Target directory: ${targetDir}`);
  console.log(`  Event Sourced: ${eventSourced}`);
  
  // Check if context already exists
  if (existsSync(targetDir)) {
    console.error(`Error: Context directory already exists: ${targetDir}`);
    process.exit(1);
  }
  
  // Create target directory
  mkdirSync(targetDir, { recursive: true });
  console.log(`✓ Created context directory: ${targetDir}`);
  
  // Read blueprint directory contents
  const blueprintItems = readdirSync(blueprintPath);
  
  // Copy files and create folders
  for (const item of blueprintItems) {
    const blueprintItemPath = join(blueprintPath, item);
    const targetItemPath = join(targetDir, item);
    const itemStat = statSync(blueprintItemPath);
    
    if (itemStat.isDirectory()) {
      // Create empty folder for subdirectories
      mkdirSync(targetItemPath, { recursive: true });
      console.log(`  ✓ Created folder: ${item}`);
    } else if (item.endsWith('.ts') || item.endsWith('.js')) {
      // Skip index.* files for now, will handle based on --event-sourced flag
      if (item.startsWith('index.')) {
        continue;
      }
      // Copy other files
      copyFileSync(blueprintItemPath, targetItemPath);
      console.log(`  ✓ Copied: ${item}`);
    }
  }
  
  // Handle index file based on --event-sourced flag
  const indexTemplate = eventSourced ? 'index.es.ts.tpl' : 'index.no-es.ts.tpl';
  const indexTemplatePath = join(blueprintPath, indexTemplate);
  const indexTargetPath = join(targetDir, 'index.ts');
  
  if (existsSync(indexTemplatePath)) {
    let content = readFileSync(indexTemplatePath, 'utf-8');
    content = content.replace(/__context__/g, snakeCaseName);
    writeFileSync(indexTargetPath, content, 'utf-8');
    console.log(`  ✓ Created index.ts (using ${indexTemplate})`);
  } else {
    console.error(`Error: Template file not found: ${indexTemplatePath}`);
    process.exit(1);
  }
  
  // Update services.ts with PascalCase context name
  const servicesPath = join(targetDir, 'services.ts');
  if (existsSync(servicesPath)) {
    let content = readFileSync(servicesPath, 'utf-8');
    content = content.replace(/__context__/g, contextName);
    writeFileSync(servicesPath, content, 'utf-8');
    console.log(`  ✓ Updated services.ts with context name`);
  }
  
  console.log(`\n✓ Context "${contextName}" generated successfully!`);
  console.log(`  Run "app list" to see the new context.`);
}

export function generateCommand(contextName: string, commandName: string) {
  const __dirname = dirname(__filename);
  const domainPath = getDomainPath();
  
  // Normalize command name - if already fully qualified, extract just the command part
  let fqcn: string;
  let commandShortName: string;
  
  if (commandName.includes('.')) {
    // Already fully qualified
    const parts = commandName.split('.');
    if (parts.length !== 2) {
      console.error(`Error: Command name must be in PascalCase or fully qualified with context (e.g., TaskManagement.AddTodo): ${commandName}`);
      process.exit(1);
    }
    // Validate that the context part matches
    if (parts[0] !== contextName) {
      console.error(`Error: Context mismatch. Context is "${contextName}" but command specifies "${parts[0]}".`);
      process.exit(1);
    }
    fqcn = commandName;
    commandShortName = parts[1];
  } else {
    // Not fully qualified, construct FQCN
    fqcn = `${contextName}.${commandName}`;
    commandShortName = commandName;
  }
  
  // Validate commandShortName is in PascalCase
  if (!/^[A-Z][a-zA-Z0-9]*$/.test(commandShortName)) {
    console.error(`Error: Command name must be in PascalCase (e.g., AddTodo): ${commandShortName}`);
    process.exit(1);
  }
  
  // Convert to kebab-case for folder name
  const kebabCaseName = commandShortName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  
  // Context directory in kebab-case
  const contextKebabCase = contextName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  const contextDir = join(domainPath, contextKebabCase);
  
  console.log(`Generating command "${fqcn}" in context "${contextName}"...`);
  console.log(`  Context: ${contextName} -> ${contextKebabCase}`);
  console.log(`  Command name: ${commandShortName} -> ${kebabCaseName}`);
  console.log(`  FQCN: ${fqcn}`);
  console.log(`  Target directory: ${contextDir}/commands/${kebabCaseName}`);
  
  // Validate context exists
  if (!existsSync(contextDir)) {
    console.error(`Error: Context does not exist: ${contextDir}`);
    console.error(`  Hint: Use "app codegen context ${contextName}" to generate the context first.`);
    process.exit(1);
  }
  
  // Validate command is not already registered
  const commandsFilePath = join(contextDir, 'commands.ts');
  if (existsSync(commandsFilePath)) {
    const commandsContent = readFileSync(commandsFilePath, 'utf-8');
    if (commandsContent.includes(`"${fqcn}"`)) {
      console.error(`Error: Command "${fqcn}" is already registered in context "${contextName}".`);
      process.exit(1);
    }
  }
  
  // Create commands directory if it doesn't exist
  const commandsDir = join(contextDir, 'commands');
  if (!existsSync(commandsDir)) {
    mkdirSync(commandsDir, { recursive: true });
    console.log(`✓ Created commands directory: ${commandsDir}`);
  }
  
  // Create command directory
  const targetCommandDir = join(commandsDir, kebabCaseName);
  if (existsSync(targetCommandDir)) {
    console.error(`Error: Command directory already exists: ${targetCommandDir}`);
    process.exit(1);
  }
  mkdirSync(targetCommandDir, { recursive: true });
  console.log(`✓ Created command directory: ${targetCommandDir}`);
  
  // Copy files from blueprint
  const blueprintPath = join(__dirname, '..', 'blueprint', 'domain', '__context__', 'commands', '__command__');
  
  if (!existsSync(blueprintPath)) {
    console.error(`Error: Blueprint path not found: ${blueprintPath}`);
    process.exit(1);
  }
  
  const blueprintItems = readdirSync(blueprintPath);
  
  for (const item of blueprintItems) {
    // Skip events folder - do not copy it
    if (item === 'events') {
      continue;
    }
    
    const blueprintItemPath = join(blueprintPath, item);
    const targetItemPath = join(targetCommandDir, item);
    const itemStat = statSync(blueprintItemPath);
    
    if (itemStat.isDirectory()) {
      mkdirSync(targetItemPath, { recursive: true });
    } else {
      copyFileSync(blueprintItemPath, targetItemPath);
      console.log(`  ✓ Copied: ${item}`);
    }
  }
  
  // Create empty events folder
  const eventsDir = join(targetCommandDir, 'events');
  mkdirSync(eventsDir, { recursive: true });
  console.log(`  ✓ Created events folder: events/`);
  
  // Update payload.ts with command name
  const payloadPath = join(targetCommandDir, 'payload.ts');
  if (existsSync(payloadPath)) {
    let content = readFileSync(payloadPath, 'utf-8');
    // Replace any placeholder with the command name in PascalCase
    content = content.replace(/__command__/g, commandShortName);
    content = content.replace(/__context__/g, contextName);
    writeFileSync(payloadPath, content, 'utf-8');
  }
  
  // Update state.ts with command name
  const statePath = join(targetCommandDir, 'state.ts');
  if (existsSync(statePath)) {
    let content = readFileSync(statePath, 'utf-8');
    content = content.replace(/__command__/g, commandShortName);
    content = content.replace(/__context__/g, contextName);
    writeFileSync(statePath, content, 'utf-8');
  }
  
  // Add command to commands.ts registry
  if (existsSync(commandsFilePath)) {
    let commandsContent = readFileSync(commandsFilePath, 'utf-8');
    
    // Determine the import name (PascalCase, e.g., prepareAddTodo, handleAddTodo)
    const importName = commandShortName;
    
    // Generate import statements
    const importLine = `import prepare${importName} from "./commands/${kebabCaseName}/prepare";`;
    const handleImportLine = `import handle${importName} from "./commands/${kebabCaseName}/handle";`;
    
    // Check if imports already exist and add if needed
    if (!commandsContent.includes(`prepare${importName}`)) {
      // Find the last import statement and insert after it (without blank line between imports)
      const importLines = commandsContent.split('\n').filter(line => line.trim().startsWith('import'));
      if (importLines.length > 0) {
        const lastImportLine = importLines[importLines.length - 1];
        const insertPos = commandsContent.indexOf(lastImportLine) + lastImportLine.length;
        const afterNewline = commandsContent.indexOf('\n', insertPos) + 1;
        // Insert new imports without blank line between imports
        commandsContent = commandsContent.slice(0, afterNewline) + importLine + '\n' + handleImportLine + commandsContent.slice(afterNewline);
      } else {
        // No imports, add after the first line (import {CommandRegistry}...)
        const firstNewline = commandsContent.indexOf('\n');
        // Add imports without blank line after them (blank line will be added before export)
        commandsContent = commandsContent.slice(0, firstNewline + 1) + importLine + '\n' + handleImportLine + commandsContent.slice(firstNewline + 1);
      }
      
      // Ensure there's exactly one blank line between the last import and the export statement
      const lines = commandsContent.split('\n');
      let lastImportLineText = '';
      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].trim().startsWith('import')) {
          lastImportLineText = lines[i];
          break;
        }
      }
      const lastImportIdx = commandsContent.indexOf(lastImportLineText);
      if (lastImportIdx >= 0) {
        const afterImport = commandsContent.indexOf('\n', lastImportIdx + lastImportLineText.length);
        if (afterImport >= 0) {
          const remaining = commandsContent.slice(afterImport + 1);
          // Check if next line (after potential whitespace) starts with 'export'
          const nextNonEmptyLine = remaining.split('\n').find(line => line.trim().length > 0) || '';
          if (nextNonEmptyLine.trim().startsWith('export')) {
            // Replace any number of newlines with exactly one blank line before export
            // Remove all leading newlines from remaining, then add exactly one
            const trimmedRemaining = remaining.replace(/^\n+/, '');
            commandsContent = commandsContent.slice(0, afterImport + 1) + '\n' + trimmedRemaining;
          }
        }
      }
    }
    
    // Add command registration with proper formatting (2 spaces indentation matching the template)
    const commandEntry = `  "${fqcn}": {\n    prepare: prepare${importName},\n    exec: handle${importName}\n  },`;
    
    // Insert before the closing brace
    const closingBraceMatch = commandsContent.match(/\};$/m);
    if (closingBraceMatch) {
      const insertPos = closingBraceMatch.index || 0;
      commandsContent = commandsContent.slice(0, insertPos) + commandEntry + '\n' + commandsContent.slice(insertPos);
    }
    
    writeFileSync(commandsFilePath, commandsContent, 'utf-8');
    console.log(`✓ Added command "${fqcn}" to commands.ts`);
  }
  
  console.log(`\n✓ Command "${fqcn}" generated successfully!`);
  console.log(`  Run "app list" to see the new command.`);
}
