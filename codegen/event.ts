import { printCodegenHelp } from './help';
import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getDomainPath } from '../bin/scanner';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function generateEvent(contextName: string, commandName: string, eventName: string) {
  const domainPath = getDomainPath();
  
  // Normalize command name - if already fully qualified, extract just the command part
  let commandFqcn: string;
  let commandShortName: string;
  
  if (commandName.includes('.')) {
    // Already fully qualified
    const parts = commandName.split('.');
    if (parts.length !== 2) {
      console.error(`Error: Command name must be in PascalCase (e.g., AddTodo) or fully qualified (e.g., TaskManagement.AddTodo): ${commandName}`);
      process.exit(1);
    }
    // Validate that the context part matches
    if (parts[0] !== contextName) {
      console.error(`Error: Context mismatch. Context is "${contextName}" but command specifies "${parts[0]}".`);
      process.exit(1);
    }
    commandFqcn = commandName;
    commandShortName = parts[1];
  } else {
    // Not fully qualified, construct FQCN
    commandFqcn = `${contextName}.${commandName}`;
    commandShortName = commandName;
  }
  
  // Validate commandShortName is in PascalCase
  if (!/^[A-Z][a-zA-Z0-9]*$/.test(commandShortName)) {
    console.error(`Error: Command name must be in PascalCase (e.g., AddTodo): ${commandShortName}`);
    process.exit(1);
  }
  
  // Normalize event name - if already fully qualified, extract just the event part
  let eventFqcn: string;
  let eventShortName: string;
  
  if (eventName.includes('.')) {
    // Already fully qualified
    const parts = eventName.split('.');
    if (parts.length !== 2) {
      console.error(`Error: Event name must be in PascalCase (e.g., TodoAdded) or fully qualified (e.g., TaskManagement.TodoAdded): ${eventName}`);
      process.exit(1);
    }
    // Validate that the context part matches
    if (parts[0] !== contextName) {
      console.error(`Error: Context mismatch. Context is "${contextName}" but event specifies "${parts[0]}".`);
      process.exit(1);
    }
    eventFqcn = eventName;
    eventShortName = parts[1];
  } else {
    // Not fully qualified, construct FQCN
    eventFqcn = `${contextName}.${eventName}`;
    eventShortName = eventName;
  }
  
  // Validate eventShortName is in PascalCase
  if (!/^[A-Z][a-zA-Z0-9]*$/.test(eventShortName)) {
    console.error(`Error: Event name must be in PascalCase (e.g., TodoAdded): ${eventShortName}`);
    process.exit(1);
  }
  
  // Convert to kebab-case for folder/file names
  const commandKebabCase = commandShortName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  const eventKebabCase = eventShortName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  
  // Context directory in kebab-case
  const contextKebabCase = contextName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  const contextDir = join(domainPath, contextKebabCase);
  
  console.log(`Generating event "${eventFqcn}" for command "${commandFqcn}" in context "${contextName}"...`);
  console.log(`  Context: ${contextName} -> ${contextKebabCase}`);
  console.log(`  Command name: ${commandShortName} -> ${commandKebabCase}`);
  console.log(`  Event name: ${eventShortName} -> ${eventKebabCase}`);
  console.log(`  Event FQCN: ${eventFqcn}`);
  console.log(`  Target directory: ${contextDir}/commands/${commandKebabCase}/events/${eventKebabCase}`);
  
  // Validate context exists
  if (!existsSync(contextDir)) {
    console.error(`Error: Context does not exist: ${contextDir}`);
    console.error(`  Hint: Use "app codegen context ${contextName}" to generate the context first.`);
    process.exit(1);
  }
  
  // Validate command exists in context (check commands directory)
  const commandsDir = join(contextDir, 'commands');
  const targetCommandDir = join(commandsDir, commandKebabCase);
  
  if (!existsSync(targetCommandDir)) {
    console.error(`Error: Command directory does not exist: ${targetCommandDir}`);
    console.error(`  Hint: Use "app codegen command ${contextName} ${commandShortName}" to generate the command first.`);
    process.exit(1);
  }
  
  // Validate event is not already registered
  const eventsFilePath = join(contextDir, 'events.ts');
  
  // Create events.ts if it doesn't exist
  if (!existsSync(eventsFilePath)) {
    const initialContent = `import {EventRegistry} from "@lib/types/event-registry";\n\nexport const events: EventRegistry = {\n  // Register events here\n};\n`;
    writeFileSync(eventsFilePath, initialContent, 'utf-8');
    console.log(`✓ Created events.ts registry`);
  }
  
  const eventsContent = readFileSync(eventsFilePath, 'utf-8');
  
  // Check if event FQCN is already registered
  if (eventsContent.includes(`"${eventFqcn}"`)) {
    console.error(`Error: Event "${eventFqcn}" is already registered in context "${contextName}".`);
    process.exit(1);
  }
  
  // Create events directory if it doesn't exist
  const commandEventsDir = join(targetCommandDir, 'events');
  if (!existsSync(commandEventsDir)) {
    mkdirSync(commandEventsDir, { recursive: true });
    console.log(`✓ Created events directory: ${commandEventsDir}`);
  }
  
  // Create event directory
  const targetEventDir = join(commandEventsDir, eventKebabCase);
  if (existsSync(targetEventDir)) {
    console.error(`Error: Event directory already exists: ${targetEventDir}`);
    process.exit(1);
  }
  mkdirSync(targetEventDir, { recursive: true });
  console.log(`✓ Created event directory: ${targetEventDir}`);
  
  // Copy file from blueprint
  const blueprintPath = join(__dirname, '..', 'blueprint', 'domain', '__context__', 'commands', '__command__', 'events', '__event__.ts');
  
  if (!existsSync(blueprintPath)) {
    console.error(`Error: Blueprint path not found: ${blueprintPath}`);
    process.exit(1);
  }
  
  const targetEventFile = join(targetEventDir, `${eventKebabCase}.ts`);
  copyFileSync(blueprintPath, targetEventFile);
  console.log(`  ✓ Copied: __event__.ts -> ${eventKebabCase}.ts`);
  
  // Update content: Replace __Event__ with PascalCase event name (without context)
  let content = readFileSync(targetEventFile, 'utf-8');
  content = content.replace(/__Event__/g, eventShortName);
  writeFileSync(targetEventFile, content, 'utf-8');
  console.log(`  ✓ Updated: ${eventKebabCase}.ts with event name`);
  
  // Add event to events.ts registry
  let updatedEventsContent = eventsContent;
  
  // Generate import statements for prepare and exec
  const prepareImportLine = `import prepare${eventShortName} from "./commands/${commandKebabCase}/events/${eventKebabCase}/prepare";`;
  const execImportLine = `import handle${eventShortName} from "./commands/${commandKebabCase}/events/${eventKebabCase}/handle";`;
  
  // Check if imports already exist and add if needed
  if (!updatedEventsContent.includes(`prepare${eventShortName}`)) {
    // Find the last import statement and insert after it (without blank line between imports)
    const importLines = updatedEventsContent.split('\n').filter(line => line.trim().startsWith('import'));
    if (importLines.length > 0) {
      const lastImportLine = importLines[importLines.length - 1];
      const insertPos = updatedEventsContent.indexOf(lastImportLine) + lastImportLine.length;
      const afterNewline = updatedEventsContent.indexOf('\n', insertPos) + 1;
      // Insert new imports without blank line between imports
      updatedEventsContent = updatedEventsContent.slice(0, afterNewline) + prepareImportLine + '\n' + execImportLine + updatedEventsContent.slice(afterNewline);
    } else {
      // No imports, add after the first line (import {EventRegistry}...)
      const firstNewline = updatedEventsContent.indexOf('\n');
      // Add imports without blank line after them (blank line will be added before export)
      updatedEventsContent = updatedEventsContent.slice(0, firstNewline + 1) + prepareImportLine + '\n' + execImportLine + updatedEventsContent.slice(firstNewline + 1);
    }
    
    // Ensure there's exactly one blank line between the last import and the export statement
    const lines = updatedEventsContent.split('\n');
    let lastImportLineText = '';
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim().startsWith('import')) {
        lastImportLineText = lines[i];
        break;
      }
    }
    const lastImportIdx = updatedEventsContent.indexOf(lastImportLineText);
    if (lastImportIdx >= 0) {
      const afterImport = updatedEventsContent.indexOf('\n', lastImportIdx + lastImportLineText.length);
      if (afterImport >= 0) {
        const remaining = updatedEventsContent.slice(afterImport + 1);
        // Check if next line (after potential whitespace) starts with 'export'
        const nextNonEmptyLine = remaining.split('\n').find(line => line.trim().length > 0) || '';
        if (nextNonEmptyLine.trim().startsWith('export')) {
          // Replace any number of newlines with exactly one blank line before export
          // Remove all leading newlines from remaining, then add exactly one
          const trimmedRemaining = remaining.replace(/^\n+/, '');
          updatedEventsContent = updatedEventsContent.slice(0, afterImport + 1) + '\n' + trimmedRemaining;
        }
      }
    }
  }
  
  // Add event registration with proper formatting
  // Events are registered at the event FQCN level with apply and automate arrays
  const eventEntry = `  "${eventFqcn}": {\n    apply: [],\n    automate: []\n  },`;
  
  // Insert before the closing brace
  const closingBraceMatch = updatedEventsContent.match(/\};$/m);
  if (closingBraceMatch) {
    const insertPos = closingBraceMatch.index || 0;
    updatedEventsContent = updatedEventsContent.slice(0, insertPos) + eventEntry + '\n' + updatedEventsContent.slice(insertPos);
  }
  
  writeFileSync(eventsFilePath, updatedEventsContent, 'utf-8');
  console.log(`✓ Added event "${eventFqcn}" to events.ts`);
  
  console.log(`\n✓ Event "${eventFqcn}" generated successfully!`);
  console.log(`  Run "app list" to see the new event.`);
}
