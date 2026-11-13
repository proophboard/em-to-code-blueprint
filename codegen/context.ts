import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, basename, dirname } from 'path';
import { getDomainPath } from '../bin/scanner';

export function generateContext(contextName: string, eventSourced: boolean) {
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
      
      // Create subfolders for automations
      if (item === 'automations') {
        const automationsPath = join(targetDir, 'automations');
        const eventsPath = join(automationsPath, 'events');
        const jobsPath = join(automationsPath, 'jobs');
        mkdirSync(eventsPath, { recursive: true });
        mkdirSync(jobsPath, { recursive: true });
        console.log(`  ✓ Created folder: automations/events`);
        console.log(`  ✓ Created folder: automations/jobs`);
      }
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
