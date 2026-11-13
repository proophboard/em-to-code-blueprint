export function printCodegenHelp() {
  console.log(`Usage: app codegen <command> [arguments]

Commands:
  context <name> [--event-sourced]  Generate a new context
  command <context> <name>         Generate a new command

Examples:
  app codegen context TaskManagement
  app codegen context TaskManagement --event-sourced
  app codegen command TaskManagement AddTodo
`);
}
