export function printCodegenHelp() {
  console.log(`Usage: app codegen <command> [arguments]

Commands:
  context <name> [--event-sourced]  Generate a new context

Examples:
  app codegen context TaskManagement
  app codegen context TaskManagement --event-sourced
`);
}
