/**
 * String-based model of the event registry used for parsing and code generation.
 *
 * The runtime `EventRegistry` type (lib/types/event-registry) declares `prepare`/`exec`
 * as actual function references. When manipulating the events.ts file as text we only
 * deal with the function *names* (identifiers) as strings, so we use these dedicated
 * serializable types instead.
 */
export type ApplyMappingModel = {
  information: string;
  inline: boolean;
  addsTodoJob: boolean;
  prepare: string;
  exec: string;
};

export type AutomationMappingModel = {
  automation: string;
  inline: boolean;
  prepare: string;
  exec: string;
};

export type EventRegistryModel = {
  [eventName: string]: {
    apply: ApplyMappingModel[];
    automate: AutomationMappingModel[];
  };
};

/**
 * Parse an events.ts file content into an EventRegistryModel object
 */
export function parseEventsRegistry(content: string): EventRegistryModel {
  try {
    // Extract the events object content
    const match = content.match(/export const events:\s*EventRegistry\s*=\s*({[\s\S]*});?\s*$/m);
    if (!match) {
      return {};
    }

    const objStr = match[1].trim();
    const registry: EventRegistryModel = {};

    // Find all event entries by tracking braces
    let i = 0;
    while (i < objStr.length) {
      // Find the next event name
      const eventStart = objStr.indexOf('"', i);
      if (eventStart === -1) break;

      // Find the event name after the quote
      const eventQuoteEnd = objStr.indexOf('"', eventStart + 1);
      if (eventQuoteEnd === -1) break;

      const eventName = objStr.substring(eventStart + 1, eventQuoteEnd);

      // Find the opening brace of this event entry
      const openBrace = objStr.indexOf('{', eventQuoteEnd);
      if (openBrace === -1) break;

      // Find the matching closing brace by counting braces
      let braceCount = 0;
      let closeBrace = -1;
      for (let j = openBrace; j < objStr.length; j++) {
        if (objStr[j] === '{') {
          braceCount++;
        } else if (objStr[j] === '}') {
          braceCount--;
          if (braceCount === 0) {
            closeBrace = j;
            break;
          }
        }
      }

      if (closeBrace === -1) break;

      // Extract the event content between braces
      const eventContent = objStr.substring(openBrace + 1, closeBrace);

      // Parse apply and automate arrays
      const applyArray = parseApplyArray(eventContent);
      const automateArray = parseAutomateArray(eventContent);

      registry[eventName] = {
        apply: applyArray,
        automate: automateArray
      };

      // Move past this event entry
      i = closeBrace + 1;
    }

    return registry;
  } catch (error) {
    return {};
  }
}

function parseApplyArray(content: string): ApplyMappingModel[] {
  const match = content.match(/apply:\s*\[\s*([\s\S]*?)\s*\]/);
  if (!match) return [];

  const arrayContent = match[1];
  const entries: ApplyMappingModel[] = [];

  // Parse each entry in the apply array - find entries by tracking braces
  let i = 0;
  while (i < arrayContent.length) {
    // Find the start of an object
    const objStart = arrayContent.indexOf('{', i);
    if (objStart === -1) break;

    // Find the matching closing brace
    let braceCount = 0;
    let closeBrace = -1;
    for (let j = objStart; j < arrayContent.length; j++) {
      if (arrayContent[j] === '{') {
        braceCount++;
      } else if (arrayContent[j] === '}') {
        braceCount--;
        if (braceCount === 0) {
          closeBrace = j;
          break;
        }
      }
    }

    if (closeBrace === -1) break;

    const entryContent = arrayContent.substring(objStart + 1, closeBrace);
    const applyEntry: ApplyMappingModel = {
      information: extractStringValue(entryContent, 'information'),
      inline: extractBooleanValue(entryContent, 'inline', true),
      addsTodoJob: extractBooleanValue(entryContent, 'addsTodoJob', false),
      prepare: extractStringValue(entryContent, 'prepare'),
      exec: extractStringValue(entryContent, 'exec')
    };
    entries.push(applyEntry);

    // Move past this entry
    i = closeBrace + 1;
  }

  return entries;
}

function parseAutomateArray(content: string): AutomationMappingModel[] {
  const match = content.match(/automate:\s*\[\s*([\s\S]*?)\s*\]/);
  if (!match) return [];

  const arrayContent = match[1];
  const entries: AutomationMappingModel[] = [];

  // Parse each entry in the automate array - find entries by tracking braces
  let i = 0;
  while (i < arrayContent.length) {
    // Find the start of an object
    const objStart = arrayContent.indexOf('{', i);
    if (objStart === -1) break;

    // Find the matching closing brace
    let braceCount = 0;
    let closeBrace = -1;
    for (let j = objStart; j < arrayContent.length; j++) {
      if (arrayContent[j] === '{') {
        braceCount++;
      } else if (arrayContent[j] === '}') {
        braceCount--;
        if (braceCount === 0) {
          closeBrace = j;
          break;
        }
      }
    }

    if (closeBrace === -1) break;

    const entryContent = arrayContent.substring(objStart + 1, closeBrace);
    const automateEntry: AutomationMappingModel = {
      automation: extractStringValue(entryContent, 'automation'),
      inline: extractBooleanValue(entryContent, 'inline', true),
      prepare: extractStringValue(entryContent, 'prepare'),
      exec: extractStringValue(entryContent, 'exec')
    };
    entries.push(automateEntry);

    // Move past this entry
    i = closeBrace + 1;
  }

  return entries;
}

function extractStringValue(objStr: string, key: string): string {
  // Keys may be quoted ("key":) or unquoted (key:) in TypeScript object literals
  const keyPattern = `(?:"${key}"|${key})\\s*:`;

  // Try matching quoted/single-quoted string values first: key: "value" or key: 'value'
  const quotedRegex = new RegExp(`${keyPattern}\\s*["']([^"']+)["']`);
  const quotedMatch = objStr.match(quotedRegex);
  if (quotedMatch) {
    return quotedMatch[1];
  }

  // Try matching function names: key: FunctionName (unquoted identifier)
  const identifierRegex = new RegExp(`${keyPattern}\\s*([a-zA-Z_$][a-zA-Z0-9_$]*)`);
  const identifierMatch = objStr.match(identifierRegex);
  if (identifierMatch) {
    return identifierMatch[1];
  }

  return '';
}

function extractBooleanValue(objStr: string, key: string, defaultValue: boolean): boolean {
  // Keys may be quoted ("key":) or unquoted (key:) in TypeScript object literals
  const regex = new RegExp(`(?:"${key}"|${key})\\s*:\\s*(true|false)`);
  const match = objStr.match(regex);
  if (match) {
    return match[1] === 'true';
  }
  return defaultValue;
}

/**
 * Generate the events.ts registry string from an EventRegistryModel object
 */
export function generateEventsRegistry(registry: EventRegistryModel): string {
  const lines: string[] = [];

  lines.push('import {EventRegistry} from "@lib/types/event-registry";');
  lines.push('');

  // Collect all imports
  const prepareImports = new Set<string>();
  const execImports = new Set<string>();

  for (const [eventName, eventConfig] of Object.entries(registry)) {
    // Add projection case imports
    for (const apply of eventConfig.apply) {
      if (!apply.information || !apply.information.includes('.')) continue;
      
      const kebabCaseInformation = apply.information.split('.')[1]
        .replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
      const kebabCaseEvent = eventName.split('.')[1]
        .replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();

      const prepareImport = `import ${apply.prepare} from "./information/${kebabCaseInformation}/projection/${kebabCaseEvent}/prepare";`;
      const execImport = `import ${apply.exec} from "./information/${kebabCaseInformation}/projection/${kebabCaseEvent}/apply";`;

      prepareImports.add(prepareImport);
      execImports.add(execImport);
    }

    // Add automation imports
    for (const automate of eventConfig.automate) {
      if (!automate.automation || !automate.automation.includes('.')) continue;
      
      const kebabCaseAutomation = automate.automation.split('.')[1]
        .replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();

      const prepareImport = `import ${automate.prepare} from "./automations/events/${kebabCaseAutomation}/prepare";`;
      const execImport = `import ${automate.exec} from "./automations/events/${kebabCaseAutomation}/on";`;

      prepareImports.add(prepareImport);
      execImports.add(execImport);
    }
  }

  // Add all imports (prepare imports first, then exec imports)
  for (const importLine of Array.from(prepareImports)) {
    lines.push(importLine);
  }
  for (const importLine of Array.from(execImports)) {
    lines.push(importLine);
  }

  lines.push('');
  lines.push('export const events: EventRegistry = {');

  // Add event entries
  const eventNames = Object.keys(registry).sort();
  for (let i = 0; i < eventNames.length; i++) {
    const eventName = eventNames[i];
    const eventConfig = registry[eventName];

    lines.push(`  "${eventName}": {`);

    // Add apply array
    if (eventConfig.apply.length > 0) {
      lines.push('    apply: [');
      for (let j = 0; j < eventConfig.apply.length; j++) {
        const apply = eventConfig.apply[j];
        const comma = j < eventConfig.apply.length - 1 ? ',' : '';
        lines.push(`      {`);
        lines.push(`        information: "${apply.information}",`);
        lines.push(`        inline: ${apply.inline},`);
        lines.push(`        addsTodoJob: ${apply.addsTodoJob},`);
        lines.push(`        prepare: ${apply.prepare},`);
        lines.push(`        exec: ${apply.exec}`);
        lines.push(`      }${comma}`);
      }
      lines.push('    ],');
    } else {
      lines.push('    apply: [],');
    }

    // Add automate array
    if (eventConfig.automate.length > 0) {
      lines.push('    automate: [');
      for (let j = 0; j < eventConfig.automate.length; j++) {
        const automate = eventConfig.automate[j];
        const comma = j < eventConfig.automate.length - 1 ? ',' : '';
        lines.push(`      {`);
        lines.push(`        automation: "${automate.automation}",`);
        lines.push(`        inline: ${automate.inline},`);
        lines.push(`        prepare: ${automate.prepare},`);
        lines.push(`        exec: ${automate.exec}`);
        lines.push(`      }${comma}`);
      }
      lines.push('    ]');
    } else {
      lines.push('    automate: []');
    }

    const comma = i < eventNames.length - 1 ? ',' : '';
    lines.push(`  }${comma}`);
  }

  lines.push('};');

  return lines.join('\n');
}

/**
 * Add a projection case to an event in the registry
 */
export function addProjectionCase(
  registry: EventRegistryModel,
  eventName: string,
  information: string,
  inline: boolean,
  addsTodoJob: boolean,
  prepareFunction: string,
  execFunction: string
): EventRegistryModel {
  const newEntry: ApplyMappingModel = {
    information,
    inline,
    addsTodoJob,
    prepare: prepareFunction,
    exec: execFunction
  };

  if (!registry[eventName]) {
    // Event not registered yet, add it
    registry[eventName] = {
      apply: [newEntry],
      automate: []
    };
  } else {
    // Event exists, add to apply array
    registry[eventName].apply.push(newEntry);
  }

  return registry;
}

/**
 * Add an event automation to an event in the registry
 */
export function addEventAutomation(
  registry: EventRegistryModel,
  eventName: string,
  automation: string,
  inline: boolean,
  prepareFunction: string,
  execFunction: string
): EventRegistryModel {
  const newEntry: AutomationMappingModel = {
    automation,
    inline,
    prepare: prepareFunction,
    exec: execFunction
  };

  if (!registry[eventName]) {
    // Event not registered yet, add it
    registry[eventName] = {
      apply: [],
      automate: [newEntry]
    };
  } else {
    // Event exists, add to automate array
    registry[eventName].automate.push(newEntry);
  }

  return registry;
}

/**
 * Remove a projection case from an event in the registry
 */
export function removeProjectionCase(
  registry: EventRegistryModel,
  eventName: string,
  information: string
): EventRegistryModel {
  if (!registry[eventName]) {
    return registry;
  }

  registry[eventName].apply = registry[eventName].apply.filter(
    entry => entry.information !== information
  );

  // Clean up empty event entries
  if (registry[eventName].apply.length === 0 && registry[eventName].automate.length === 0) {
    delete registry[eventName];
  }

  return registry;
}

/**
 * Remove an event automation from an event in the registry
 */
export function removeEventAutomation(
  registry: EventRegistryModel,
  eventName: string,
  automation: string
): EventRegistryModel {
  if (!registry[eventName]) {
    return registry;
  }

  registry[eventName].automate = registry[eventName].automate.filter(
    entry => entry.automation !== automation
  );

  // Clean up empty event entries
  if (registry[eventName].apply.length === 0 && registry[eventName].automate.length === 0) {
    delete registry[eventName];
  }

  return registry;
}

/**
 * Check if a projection case already exists in the registry
 */
export function hasProjectionCase(
  registry: EventRegistryModel,
  eventName: string,
  information: string
): boolean {
  if (!registry[eventName]) {
    return false;
  }

  return registry[eventName].apply.some(
    entry => entry.information === information
  );
}

/**
 * Check if an event automation already exists in the registry
 */
export function hasEventAutomation(
  registry: EventRegistryModel,
  eventName: string,
  automation: string
): boolean {
  if (!registry[eventName]) {
    return false;
  }

  return registry[eventName].automate.some(
    entry => entry.automation === automation
  );
}

/**
 * Validate that the generated TypeScript is syntactically correct
 * by checking for balanced braces, brackets, and parentheses
 */
export function validateTypescriptSyntax(content: string): boolean {
  const stack: {char: string, closing: string}[] = [];
  const pairs: Record<string, string> = {
    '{': '}',
    '[': ']',
    '(': ')'
  };

  for (const char of content) {
    if (pairs[char]) {
      stack.push({char, closing: pairs[char]});
    } else if (Object.values(pairs).includes(char)) {
      if (stack.length === 0 || stack[stack.length - 1].closing !== char) {
        return false;
      }
      stack.pop();
    }
  }

  return stack.length === 0;
}
