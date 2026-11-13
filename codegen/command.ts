import { printCodegenHelp } from './help';

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

    const { generateContext } = require('./context');
    generateContext(contextName, eventSourced);
  } else {
    console.error(`Unknown codegen command: ${subCommand}`);
    printCodegenHelp();
    process.exit(1);
  }
}
