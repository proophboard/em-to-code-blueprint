import { ScanResult } from './scanner';

/**
 * Formats and prints the scan result
 */
export function printScanResult(result: ScanResult): void {
  const contexts = Object.keys(result).sort();
  
  if (contexts.length === 0) {
    console.log('No commands or queries found in domain directory.');
    return;
  }
  
  for (const context of contexts) {
    const data = result[context];
    const contextName = formatContextName(context);
    
    console.log(`\n${contextName}`);
    console.log('─'.repeat(contextName.length));
    
    // Commands
    if (data.commands.length > 0) {
      console.log('\nCommands:');
      for (const command of data.commands.sort()) {
        console.log(`  • ${command}`);
      }
    } else {
      console.log('\nCommands: (none)');
    }
    
    // Queries
    if (data.queries.length > 0) {
      console.log('\nQueries:');
      for (const query of data.queries.sort()) {
        console.log(`  • ${query}`);
      }
    } else {
      console.log('\nQueries: (none)');
    }
  }
  
  console.log('');
}

/**
 * Formats context name for display (e.g., "task-management" -> "Task Management")
 */
function formatContextName(name: string): string {
  return name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
