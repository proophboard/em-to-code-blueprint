import {existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, statSync, readdirSync} from 'fs';
import {join, dirname} from 'path';
import {fileURLToPath} from 'url';
import {getDomainPath} from '../bin/scanner';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function generateOn(contextName: string, eventName: string, automationName: string, asyncFlag: boolean = false) {
  const domainPath = getDomainPath();

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

  // Normalize automation name - if already fully qualified, extract just the automation part
  let automationFqcn: string;
  let automationShortName: string;

  if (automationName.includes('.')) {
    // Already fully qualified
    const parts = automationName.split('.');
    if (parts.length !== 2) {
      console.error(`Error: Automation name must be in PascalCase (e.g., SendNotification) or fully qualified (e.g., TaskManagement.SendNotification): ${automationName}`);
      process.exit(1);
    }
    // Validate that the context part matches
    if (parts[0] !== contextName) {
      console.error(`Error: Context mismatch. Context is "${contextName}" but automation specifies "${parts[0]}".`);
      process.exit(1);
    }
    automationFqcn = automationName;
    automationShortName = parts[1];
  } else {
    // Not fully qualified, construct FQCN
    automationFqcn = `${contextName}.${automationName}`;
    automationShortName = automationName;
  }

  // Validate automationShortName is in PascalCase
  if (!/^[A-Z][a-zA-Z0-9]*$/.test(automationShortName)) {
    console.error(`Error: Automation name must be in PascalCase (e.g., SendNotification): ${automationShortName}`);
    process.exit(1);
  }

  // Convert to kebab-case for folder/file names
  const eventKebabCase = eventShortName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  const automationKebabCase = automationShortName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();

  // Context directory in kebab-case
  const contextKebabCase = contextName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  const contextDir = join(domainPath, contextKebabCase);

  console.log(`Generating event automation "${automationFqcn}" for event "${eventFqcn}" in context "${contextName}"...`);
  console.log(`  Context: ${contextName} -> ${contextKebabCase}`);
  console.log(`  Event name: ${eventShortName} -> ${eventKebabCase}`);
  console.log(`  Automation name: ${automationShortName} -> ${automationKebabCase}`);
  console.log(`  Target directory: ${contextDir}/automations/events/${automationKebabCase}`);

  // Validate context exists
  if (!existsSync(contextDir)) {
    console.error(`Error: Context does not exist: ${contextDir}`);
    console.error(`  Hint: Use "app codegen context ${contextName}" to generate the context first.`);
    process.exit(1);
  }

  // Validate event is registered in context (check events.ts)
  const eventsFilePath = join(contextDir, 'events.ts');
  if (!existsSync(eventsFilePath)) {
    console.error(`Error: events.ts not found at: ${eventsFilePath}`);
    process.exit(1);
  }

  const eventsContent = readFileSync(eventsFilePath, 'utf-8');
  if (!eventsContent.includes(`"${eventFqcn}"`)) {
    console.error(`Error: Event "${eventFqcn}" is not registered in context "${contextName}".`);
    console.error(`  Hint: Use "app codegen event ${contextName} [Command] ${eventShortName}" to register the event first.`);
    process.exit(1);
  }

  // Validate automation folder does not exist yet in events folder
  const eventsDir = join(contextDir, 'automations', 'events');
  const targetAutomationDir = join(eventsDir, automationKebabCase);
  if (existsSync(targetAutomationDir)) {
    console.error(`Error: Event automation directory already exists: ${targetAutomationDir}`);
    console.error(`  Hint: Event automation "${automationFqcn}" is already registered.`);
    process.exit(1);
  }

  // Create events automations directories if they don't exist
  if (!existsSync(eventsDir)) {
    mkdirSync(eventsDir, {recursive: true});
    console.log(`✓ Created events automations directory: ${eventsDir}`);
  }

  // Create automation directory
  mkdirSync(targetAutomationDir, {recursive: true});
  console.log(`✓ Created event automation directory: ${targetAutomationDir}`);

  // Copy files from blueprint
  const blueprintPath = join(__dirname, '..', 'blueprint', 'domain', '__context__', 'automations', 'events', '__automation__');

  if (!existsSync(blueprintPath)) {
    console.error(`Error: Blueprint path not found: ${blueprintPath}`);
    process.exit(1);
  }

  const blueprintItems = readdirSync(blueprintPath);

  for (const item of blueprintItems) {
    const blueprintItemPath = join(blueprintPath, item);
    const targetItemPath = join(targetAutomationDir, item);
    const itemStat = statSync(blueprintItemPath);

    if (itemStat.isDirectory()) {
      mkdirSync(targetItemPath, {recursive: true});
    } else {
      copyFileSync(blueprintItemPath, targetItemPath);
      console.log(`  ✓ Copied: ${item}`);
    }
  }

  // Find the command that the event belongs to
  const commandKebabCase = findCommandForEvent(contextDir, eventShortName);

  if (!commandKebabCase) {
    console.error(`Error: Event "${eventFqcn}" is not registered in any command.`);
    console.error(`  Hint: Use "app codegen event ${contextName} [Command] ${eventShortName}" to register the event first.`);
    process.exit(1);
  }

  // Replace placeholders in on.ts and prepare.ts
  // Import path: from "../../../../commands/__command__/events/__event__"
  // Should become: from "../../../../commands/[commandKebabCase]/events/[eventKebabCase]"
  const importEventName = eventShortName;

  // Update on.ts
  const onPath = join(targetAutomationDir, 'on.ts');
  if (existsSync(onPath)) {
    let content = readFileSync(onPath, 'utf-8');
    // Replace the import statement for the event using string replace
    content = content.replace('../commands/__command__/events/__event__', `../commands/${commandKebabCase}/events/${eventKebabCase}`);
    content = content.replace(/{__Event__}/g, `{${importEventName}}`);
    // Replace event type in function signature
    content = content.replace(/event: Event<__Event__>/g, `event: Event<${importEventName}>`);
    writeFileSync(onPath, content, 'utf-8');
    console.log(`  ✓ Updated: on.ts`);
  }

  // Update prepare.ts
  const preparePath = join(targetAutomationDir, 'prepare.ts');
  if (existsSync(preparePath)) {
    let content = readFileSync(preparePath, 'utf-8');
    // Replace the import statement for the event using string replace
    content = content.replace('../commands/__command__/events/__event__', `../commands/${commandKebabCase}/events/${eventKebabCase}`);
    content = content.replace(/{__Event__}/g, `{${importEventName}}`);
    // Replace event type in function signature
    content = content.replace(/event: Event<__Event__>/g, `event: Event<${importEventName}>`);
    writeFileSync(preparePath, content, 'utf-8');
    console.log(`  ✓ Updated: prepare.ts`);
  }

  // Add event automation to events.ts registry
  let updatedEventsContent = eventsContent;

  // Find the event entry and update its automate array
  // Find the position of the event FQCN in the content
  const eventFqcnEscaped = eventFqcn.replace(/[$()*+.?[\\\]^{|}]/g, '\\$&');
  const eventIndex = updatedEventsContent.indexOf(`"${eventFqcn}"`);
  
  if (eventIndex >= 0) {
    // Event is already registered, find its entry and update the automate array
    // Find the opening brace after the event FQCN
    const openBraceIndex = updatedEventsContent.indexOf('{', eventIndex);
    if (openBraceIndex < 0) {
      console.error(`Error: Could not find opening brace for event "${eventFqcn}"`);
      process.exit(1);
    }
    
    // Find the closing brace - we need to find the matching closing brace for the event entry
    // Count braces to find the correct closing position
    let braceCount = 0;
    let closeBraceIndex = -1;
    for (let i = openBraceIndex; i < updatedEventsContent.length; i++) {
      if (updatedEventsContent[i] === '{') {
        braceCount++;
      } else if (updatedEventsContent[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
          closeBraceIndex = i;
          break;
        }
      }
    }
    
    if (closeBraceIndex < 0) {
      console.error(`Error: Could not find closing brace for event "${eventFqcn}"`);
      process.exit(1);
    }
    
    // Extract the event content
    const fullEventEntry = updatedEventsContent.slice(eventIndex, closeBraceIndex + 1);
    const eventContent = updatedEventsContent.slice(openBraceIndex + 1, closeBraceIndex);
    
    // Check if this automation is already in the automate array
    if (eventContent.includes(`automation: "${automationFqcn}"`)) {
      console.error(`Error: Event automation "${automationFqcn}" for event "${eventFqcn}" is already registered.`);
      process.exit(1);
    }
    
    // Extract the current automate array content
    const automateMatch = eventContent.match(/automate:\s*\[\s*([\s\S]*?)\s*\]/);
    const currentAutomateContent = automateMatch ? automateMatch[1].trim() : '';
    
    // Build the new automate array with the existing entries plus the new one
    const newEntry = `
      {
        automation: "${automationFqcn}",
        inline: ${!asyncFlag},
        prepare: prepare${automationShortName},
        exec: on${automationShortName}
      }`;
    
    let newAutomateContent = '';
    if (currentAutomateContent.length > 0) {
      // Check if there are other entries (comma before ])
      const beforeBracket = currentAutomateContent.trim();
      let separator = ',';
      newAutomateContent = beforeBracket + separator + '\n' + newEntry;
    } else {
      newAutomateContent = newEntry;
    }
    
    // Build the new automate array string
    const newAutomateArray = `automate: [\n${newAutomateContent}\n    ]`;
    
    // Find and replace the automate array
    const oldAutomatePattern = /automate:\s*\[\s*[\s\S]*?\s*\]/;
    const newFullEventEntry = fullEventEntry.replace(oldAutomatePattern, newAutomateArray);
    
    updatedEventsContent = updatedEventsContent.replace(fullEventEntry, newFullEventEntry);
  } else {
    // Event not registered yet, add it
    const newEventEntry = `  "${eventFqcn}": {\n    apply: [],\n    automate: [\n      {\n        automation: "${automationFqcn}",\n        inline: ${!asyncFlag},\n        prepare: prepare${automationShortName},\n        exec: on${automationShortName}\n      }\n    ]\n  },`;
    
    // Insert before the closing brace
    const closingBraceMatch = updatedEventsContent.match(/\};$/m);
    if (closingBraceMatch) {
      const insertPos = closingBraceMatch.index || 0;
      updatedEventsContent = updatedEventsContent.slice(0, insertPos) + newEventEntry + '\n' + updatedEventsContent.slice(insertPos);
    }
  }

  // Add imports for the new event automation functions
  const importPrepare = `import prepare${automationShortName} from "./automations/events/${automationKebabCase}/prepare";`;
  const importExec = `import on${automationShortName} from "./automations/events/${automationKebabCase}/on";`;

  // Check if imports already exist
  const hasPrepareImport = updatedEventsContent.includes(`prepare${automationShortName}`) && updatedEventsContent.includes('from "./automations/events/');
  const hasExecImport = updatedEventsContent.includes(`on${automationShortName}`) && updatedEventsContent.includes('from "./automations/events/');

  if (!hasPrepareImport || !hasExecImport) {
    // Find the last import statement and insert after it
    const importLines = updatedEventsContent.split('\n').filter(line => line.trim().startsWith('import'));
    if (importLines.length > 0) {
      const lastImportLine = importLines[importLines.length - 1];
      const insertPos = updatedEventsContent.indexOf(lastImportLine) + lastImportLine.length;
      const afterNewline = updatedEventsContent.indexOf('\n', insertPos) + 1;
      // Insert new imports without blank line between imports
      updatedEventsContent = updatedEventsContent.slice(0, afterNewline) + importPrepare + '\n' + importExec + updatedEventsContent.slice(afterNewline);
    } else {
      // No imports, add after the first line
      const firstNewline = updatedEventsContent.indexOf('\n');
      updatedEventsContent = updatedEventsContent.slice(0, firstNewline + 1) + importPrepare + '\n' + importExec + updatedEventsContent.slice(firstNewline + 1);
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
  console.log(`✓ Added event automation "${automationFqcn}" to events.ts`);

  console.log(`\n✓ Event automation "${automationFqcn}" generated successfully!`);
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
