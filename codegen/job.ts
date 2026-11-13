import {existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, statSync, readdirSync} from 'fs';
import {join, dirname} from 'path';
import {fileURLToPath} from 'url';
import {getDomainPath} from '../bin/scanner';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function generateJob(contextName: string, informationName: string, automationName: string) {
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
  const informationKebabCase = informationShortName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  const automationKebabCase = automationShortName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();

  // Context directory in kebab-case
  const contextKebabCase = contextName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  const contextDir = join(domainPath, contextKebabCase);

  console.log(`Generating job automation "${automationFqcn}" for information "${informationFqcn}" in context "${contextName}"...`);
  console.log(`  Context: ${contextName} -> ${contextKebabCase}`);
  console.log(`  Information name: ${informationShortName} -> ${informationKebabCase}`);
  console.log(`  Automation name: ${automationShortName} -> ${automationKebabCase}`);
  console.log(`  Target directory: ${contextDir}/automations/jobs/${automationKebabCase}`);

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

  // Validate automation folder does not exist yet in jobs folder
  const jobsDir = join(contextDir, 'automations', 'jobs');
  const targetAutomationDir = join(jobsDir, automationKebabCase);
  if (existsSync(targetAutomationDir)) {
    console.error(`Error: Job automation directory already exists: ${targetAutomationDir}`);
    console.error(`  Hint: Job automation "${automationFqcn}" is already registered.`);
    process.exit(1);
  }

  // Create automation directory
  mkdirSync(targetAutomationDir, {recursive: true});
  console.log(`✓ Created job automation directory: ${targetAutomationDir}`);

  // Copy files from blueprint
  const blueprintPath = join(__dirname, '..', 'blueprint', 'domain', '__context__', 'automations', 'jobs', '__automation__');

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

  // Replace placeholders in state.ts
  const statePath = join(targetAutomationDir, 'state.ts');
  if (existsSync(statePath)) {
    let content = readFileSync(statePath, 'utf-8');
    content = content.replace(/__Automation__/g, automationShortName);
    writeFileSync(statePath, content, 'utf-8');
    console.log(`  ✓ Updated: state.ts`);
  }

  // Replace placeholders in prepare.ts
  const preparePath = join(targetAutomationDir, 'prepare.ts');
  if (existsSync(preparePath)) {
    let content = readFileSync(preparePath, 'utf-8');
    content = content.replace(/__Automation__/g, automationShortName);
    writeFileSync(preparePath, content, 'utf-8');
    console.log(`  ✓ Updated: prepare.ts`);
  }

  // Add job automation to job-automations.ts registry
  const jobAutomationsFilePath = join(contextDir, 'job-automations.ts');

  if (!existsSync(jobAutomationsFilePath)) {
    console.error(`Error: job-automations.ts not found at: ${jobAutomationsFilePath}`);
    process.exit(1);
  }

  let jobAutomationsContent = readFileSync(jobAutomationsFilePath, 'utf-8');

  // Generate import statements
  const importPrepare = `import prepare${automationShortName} from "./automations/jobs/${automationKebabCase}/prepare";`;
  const importExec = `import process${automationShortName} from "./automations/jobs/${automationKebabCase}/process";`;

  // Check if imports already exist
  const hasPrepareImport = jobAutomationsContent.includes(`prepare${automationShortName}`);
  const hasExecImport = jobAutomationsContent.includes(`process${automationShortName}`);

  if (!hasPrepareImport || !hasExecImport) {
    // Find the last import statement and insert after it (without blank line between imports)
    const importLines = jobAutomationsContent.split('\n').filter(line => line.trim().startsWith('import'));
    if (importLines.length > 0) {
      const lastImportLine = importLines[importLines.length - 1];
      const insertPos = jobAutomationsContent.indexOf(lastImportLine) + lastImportLine.length;
      const afterNewline = jobAutomationsContent.indexOf('\n', insertPos) + 1;
      // Insert new imports without blank line between imports
      jobAutomationsContent = jobAutomationsContent.slice(0, afterNewline) + importPrepare + '\n' + importExec + jobAutomationsContent.slice(afterNewline);
    } else {
      // No imports, add after the first line (import {JobAutomationRegistry}...)
      const firstNewline = jobAutomationsContent.indexOf('\n');
      // Add imports without blank line after them (blank line will be added before export)
      jobAutomationsContent = jobAutomationsContent.slice(0, firstNewline + 1) + importPrepare + '\n' + importExec + jobAutomationsContent.slice(firstNewline + 1);
    }

    // Ensure there's exactly one blank line between the last import and the export statement
    const lines = jobAutomationsContent.split('\n');
    let lastImportLineText = '';
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim().startsWith('import')) {
        lastImportLineText = lines[i];
        break;
      }
    }
    const lastImportIdx = jobAutomationsContent.indexOf(lastImportLineText);
    if (lastImportIdx >= 0) {
      const afterImport = jobAutomationsContent.indexOf('\n', lastImportIdx + lastImportLineText.length);
      if (afterImport >= 0) {
        const remaining = jobAutomationsContent.slice(afterImport + 1);
        // Check if next line (after potential whitespace) starts with 'export'
        const nextNonEmptyLine = remaining.split('\n').find(line => line.trim().length > 0) || '';
        if (nextNonEmptyLine.trim().startsWith('export')) {
          // Replace any number of newlines with exactly one blank line before export
          // Remove all leading newlines from remaining, then add exactly one
          const trimmedRemaining = remaining.replace(/^\n+/, '');
          jobAutomationsContent = jobAutomationsContent.slice(0, afterImport + 1) + '\n' + trimmedRemaining;
        }
      }
    }
  }

  // Add job automation registration
  const jobEntry = `  "${automationFqcn}": {\n    todoList: "${informationFqcn}",\n    prepare: prepare${automationShortName},\n    exec: process${automationShortName}\n  },`;

  // Insert before the closing brace
  const closingBraceMatch = jobAutomationsContent.match(/\};$/m);
  if (closingBraceMatch) {
    const insertPos = closingBraceMatch.index || 0;
    jobAutomationsContent = jobAutomationsContent.slice(0, insertPos) + jobEntry + '\n' + jobAutomationsContent.slice(insertPos);
  }

  writeFileSync(jobAutomationsFilePath, jobAutomationsContent, 'utf-8');
  console.log(`✓ Added job automation "${automationFqcn}" to job-automations.ts`);

  console.log(`\n✓ Job automation "${automationFqcn}" generated successfully!`);
  console.log(`  Run "app list" to see the new job automation.`);
}
