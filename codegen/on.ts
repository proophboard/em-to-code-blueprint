import {existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, statSync, readdirSync} from 'fs';
import {join, dirname} from 'path';
import {fileURLToPath} from 'url';
import {getDomainPath} from '../bin/scanner';
import {
  parseEventsRegistry,
  generateEventsRegistry,
  addEventAutomation,
  hasEventAutomation
} from '../lib/helpers/event-registry.js';

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
  const registry = parseEventsRegistry(eventsContent);

  // Check if this automation is already in the automate array
  if (hasEventAutomation(registry, eventFqcn, automationFqcn)) {
    console.error(`Error: Event automation "${automationFqcn}" for event "${eventFqcn}" is already registered.`);
    process.exit(1);
  }

  // Add the automation using the helper function
  const updatedRegistry = addEventAutomation(
    registry,
    eventFqcn,
    automationFqcn,
    !asyncFlag,
    `prepare${automationShortName}`,
    `on${automationShortName}`
  );

  // Regenerate the events.ts content
  const updatedEventsContent = generateEventsRegistry(updatedRegistry);

  // Find the command that the event belongs to
  const commandKebabCase = findCommandForEvent(contextDir, eventShortName);

  if (!commandKebabCase) {
    console.error(`Error: Event "${eventFqcn}" is not registered in any command.`);
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

  // Write the updated events.ts file
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
