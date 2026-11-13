import { printCodegenHelp } from './help';
import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getDomainPath } from '../bin/scanner';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function generateProjectionCase(contextName: string, informationName: string, eventName: string, asyncFlag: boolean = false, addsTodoFlag: boolean = false) {
  const domainPath = getDomainPath();
  
  // Normalize information name - if already fully qualified, extract just the information part
  let informationFqcn: string;
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
    informationFqcn = informationName;
    informationShortName = parts[1];
  } else {
    // Not fully qualified, construct FQCN
    informationFqcn = `${contextName}.${informationName}`;
    informationShortName = informationName;
  }
  
  // Validate informationShortName is in PascalCase
  if (!/^[A-Z][a-zA-Z0-9]*$/.test(informationShortName)) {
    console.error(`Error: Information name must be in PascalCase (e.g., TodoList): ${informationShortName}`);
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
  const informationKebabCase = informationShortName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  const eventKebabCase = eventShortName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  
  // Context directory in kebab-case
  const contextKebabCase = contextName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  const contextDir = join(domainPath, contextKebabCase);
  
  console.log(`Generating projection case "${eventFqcn}" for information "${informationFqcn}" in context "${contextName}"...`);
  console.log(`  Context: ${contextName} -> ${contextKebabCase}`);
  console.log(`  Information name: ${informationShortName} -> ${informationKebabCase}`);
  console.log(`  Event name: ${eventShortName} -> ${eventKebabCase}`);
  console.log(`  Target directory: ${contextDir}/information/${informationKebabCase}/projection/${eventKebabCase}`);
  
  // Validate context exists
  if (!existsSync(contextDir)) {
    console.error(`Error: Context does not exist: ${contextDir}`);
    console.error(`  Hint: Use "app codegen context ${contextName}" to generate the context first.`);
    process.exit(1);
  }
  
  // Validate information exists in context (check information directory)
  const informationDir = join(contextDir, 'information', informationKebabCase);
  if (!existsSync(informationDir)) {
    console.error(`Error: Information directory does not exist: ${informationDir}`);
    console.error(`  Hint: Use "app codegen information ${contextName} ${informationShortName}" to generate the information first.`);
    process.exit(1);
  }
  
  // Validate projection folder exists in information
  const projectionDir = join(informationDir, 'projection');
  if (!existsSync(projectionDir)) {
    console.error(`Error: Projection folder does not exist: ${projectionDir}`);
    console.error(`  Hint: Use "app codegen information ${contextName} ${informationShortName}" to generate the information with projection.`);
    process.exit(1);
  }
  
  // Find the command that the event belongs to
  const commandsDir = join(contextDir, 'commands');
  const commandKebabCase = findCommandForEvent(contextDir, eventShortName);
  
  if (!commandKebabCase) {
    console.error(`Error: Event "${eventFqcn}" is not registered in any command.`);
    console.error(`  Hint: Use "app codegen event ${contextName} [Command] ${eventShortName}" to register the event first.`);
    process.exit(1);
  }
  
  // Validate event folder does not exist yet in projection
  const targetEventDir = join(projectionDir, eventKebabCase);
  if (existsSync(targetEventDir)) {
    console.error(`Error: Projection case directory already exists: ${targetEventDir}`);
    console.error(`  Hint: Projection case for "${eventFqcn}" is already registered in "${informationFqcn}".`);
    process.exit(1);
  }
  
  // Create projection case directory
  mkdirSync(targetEventDir, { recursive: true });
  console.log(`✓ Created projection case directory: ${targetEventDir}`);
  
  // Copy files from blueprint
  const blueprintPath = join(__dirname, '..', 'blueprint', 'domain', '__context__', 'information', '__information__', 'projection', '__event__');
  
  if (!existsSync(blueprintPath)) {
    console.error(`Error: Blueprint path not found: ${blueprintPath}`);
    process.exit(1);
  }
  
  const blueprintItems = readdirSync(blueprintPath);
  
  for (const item of blueprintItems) {
    const blueprintItemPath = join(blueprintPath, item);
    const targetItemPath = join(targetEventDir, item);
    const itemStat = statSync(blueprintItemPath);
    
    if (itemStat.isDirectory()) {
      mkdirSync(targetItemPath, { recursive: true });
    } else {
      copyFileSync(blueprintItemPath, targetItemPath);
      console.log(`  ✓ Copied: ${item}`);
    }
  }
  
  // Replace placeholders in apply.ts and prepare.ts
  // Import path: from "../../../../commands/__command__/events/__event__"
  // Should become: from "../../../../commands/[commandKebabCase]/events/[eventKebabCase]"
  const importPath = `../../../../commands/${commandKebabCase}/events/${eventKebabCase}`;
  const importEventName = eventShortName;
  
  // Update apply.ts
  const applyPath = join(targetEventDir, 'apply.ts');
  if (existsSync(applyPath)) {
    let content = readFileSync(applyPath, 'utf-8');
    // Replace the import statement for the event
    // Pattern: from "../../../../commands/__command__/events/__event__";
    content = content.replace(/from "\.\.\/\.\.\/\.\.\/\.\.\/commands\/__command__\/events\/__event__";/g, `from "${importPath}";`);
    content = content.replace(/{__Event__}/g, `{${importEventName}}`);
    // Replace event type in function signature
    content = content.replace(/event: Event<__Event__>/g, `event: Event<${importEventName}>`);
    writeFileSync(applyPath, content, 'utf-8');
    console.log(`  ✓ Updated: apply.ts`);
  }
  
  // Update prepare.ts
  const preparePath = join(targetEventDir, 'prepare.ts');
  if (existsSync(preparePath)) {
    let content = readFileSync(preparePath, 'utf-8');
    // Replace the import statement for the event
    content = content.replace(/from "\.\.\/\.\.\/\.\.\/\.\.\/commands\/__command__\/events\/__event__";/g, `from "${importPath}";`);
    content = content.replace(/{__Event__}/g, `{${importEventName}}`);
    // Replace event type in function signature
    content = content.replace(/event: Event<__Event__>/g, `event: Event<${importEventName}>`);
    writeFileSync(preparePath, content, 'utf-8');
    console.log(`  ✓ Updated: prepare.ts`);
  }
  
  // Add projection case to events.ts registry
  const eventsFilePath = join(contextDir, 'events.ts');
  
  if (!existsSync(eventsFilePath)) {
    console.error(`Error: events.ts not found at: ${eventsFilePath}`);
    process.exit(1);
  }
  
  let eventsContent = readFileSync(eventsFilePath, 'utf-8');
  
  // Find the event entry and update its apply array
  const eventEntryPattern = new RegExp(`"(${eventFqcn})":\\s*\\{([^}]+)\\}`, 's');
  const match = eventsContent.match(eventEntryPattern);
  
  let updatedEventsContent = eventsContent;
  
  if (match) {
    // Event is already registered, update the apply array
    const existingEntryContent = match[2];
    
    // Check if this information is already in the apply array
    if (existingEntryContent.includes(`information: "${informationFqcn}"`)) {
      console.error(`Error: Projection case for "${eventFqcn}" with information "${informationFqcn}" is already registered.`);
      process.exit(1);
    }
    
    // Extract the current apply array content
    const applyMatch = existingEntryContent.match(/apply:\s*\[\s*([\s\S]*?)\s*\]/);
    const automateMatch = existingEntryContent.match(/automate:\s*\[\s*([\s\S]*?)\s*\]/);
    
    const currentApplyContent = applyMatch ? applyMatch[1].trim() : '';
    const currentAutomateContent = automateMatch ? automateMatch[1].trim() : '';
    
    // Build the new apply array with the existing entries plus the new one
    const newEntry = `
      {
        information: "${informationFqcn}",
        inline: ${!asyncFlag},
        addsTodoJob: ${addsTodoFlag},
        prepare: prepare${informationShortName}${eventShortName},
        exec: apply${informationShortName}${eventShortName}
      }`;
    
    let newApplyContent = '';
    if (currentApplyContent.length > 0) {
      // Check if there are other entries (comma before ])
      const beforeBracket = currentApplyContent.trim();
      let separator = ',';
      newApplyContent = beforeBracket + separator + '\n' + newEntry;
    } else {
      newApplyContent = newEntry;
    }
    
    // Build the new entry content with both apply and automate
    const newEntryContent = `\n    apply: [\n${newApplyContent}\n    ],\n    automate: []\n  `;
    
    // Replace the entire event entry
    const oldEntry = `"${eventFqcn}": {` + match[2] + `}`;
    const newEntryFull = `"${eventFqcn}": {` + newEntryContent + `}`;
    
    updatedEventsContent = updatedEventsContent.replace(oldEntry, newEntryFull);
  } else {
    // Event not registered yet, add it
    const newEventEntry = `  "${eventFqcn}": {\n    apply: [\n      {\n        information: "${informationFqcn}",\n        inline: ${!asyncFlag},\n        addsTodoJob: ${addsTodoFlag},\n        prepare: prepare${informationShortName}${eventShortName},\n        exec: apply${informationShortName}${eventShortName}\n      }\n    ],\n    automate: []\n  },`;
    
    // Insert before the closing brace
    const closingBraceMatch = updatedEventsContent.match(/\};$/m);
    if (closingBraceMatch) {
      const insertPos = closingBraceMatch.index || 0;
      updatedEventsContent = updatedEventsContent.slice(0, insertPos) + newEventEntry + '\n' + updatedEventsContent.slice(insertPos);
    }
  }
  
  // Add imports for the new projection case functions
  const importPreparePattern = `import prepare${informationShortName}${eventShortName}`;
  const importApplyPattern = `import apply${informationShortName}${eventShortName}`;
  
  // Check if imports already exist (by checking for the import statement pattern)
  const hasPrepareImport = updatedEventsContent.includes(importPreparePattern) && updatedEventsContent.includes('from "./information/');
  const hasApplyImport = updatedEventsContent.includes(importApplyPattern) && updatedEventsContent.includes('from "./information/');
  
  if (!hasPrepareImport || !hasApplyImport) {
    // Define the import statements
    const importPrepare = `import prepare${informationShortName}${eventShortName} from "./information/${informationKebabCase}/projection/${eventKebabCase}/prepare";`;
    const importApply = `import apply${informationShortName}${eventShortName} from "./information/${informationKebabCase}/projection/${eventKebabCase}/apply";`;
    
    // Find the last import statement and insert after it
    const importLines = updatedEventsContent.split('\n').filter(line => line.trim().startsWith('import'));
    if (importLines.length > 0) {
      const lastImportLine = importLines[importLines.length - 1];
      const insertPos = updatedEventsContent.indexOf(lastImportLine) + lastImportLine.length;
      const afterNewline = updatedEventsContent.indexOf('\n', insertPos) + 1;
      // Insert new imports without blank line between imports
      updatedEventsContent = updatedEventsContent.slice(0, afterNewline) + importPrepare + '\n' + importApply + updatedEventsContent.slice(afterNewline);
    } else {
      // No imports, add after the first line
      const firstNewline = updatedEventsContent.indexOf('\n');
      updatedEventsContent = updatedEventsContent.slice(0, firstNewline + 1) + importPrepare + '\n' + importApply + updatedEventsContent.slice(firstNewline + 1);
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
        // Check if next line starts with 'export'
        const nextNonEmptyLine = remaining.split('\n').find(line => line.trim().length > 0) || '';
        if (nextNonEmptyLine.trim().startsWith('export')) {
          // Replace any number of newlines with exactly one blank line before export
          const trimmedRemaining = remaining.replace(/^\n+/, '');
          updatedEventsContent = updatedEventsContent.slice(0, afterImport + 1) + '\n' + trimmedRemaining;
        }
      }
    }
  }
  
  writeFileSync(eventsFilePath, updatedEventsContent, 'utf-8');
  console.log(`✓ Added projection case "${eventFqcn}" to events.ts`);
  
  console.log(`\n✓ Projection case "${eventFqcn}" generated successfully!`);
  console.log(`  Run "app list" to see the updated events.`);
}

function findCommandForEvent(contextDir: string, eventShortName: string): string | null {
  const commandsDir = join(contextDir, 'commands');
  if (!existsSync(commandsDir)) {
    return null;
  }
  
  const commandFolders = readdirSync(commandsDir);
  const eventKebabCase = eventShortName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  
  for (const commandFolder of commandFolders) {
    const commandEventsDir = join(commandsDir, commandFolder, 'events');
    if (existsSync(commandEventsDir)) {
      const eventFiles = readdirSync(commandEventsDir);
      // Find the event file that matches the kebab-case event name
      for (const eventFile of eventFiles) {
        if (eventFile === `${eventKebabCase}.ts`) {
          return commandFolder;
        }
      }
    }
  }
  
  return null;
}
