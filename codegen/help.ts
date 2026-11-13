export function printCodegenHelp() {
  console.log(`Usage: app codegen <command> [arguments]

Commands:
  context <name> [--event-sourced]  Generate a new context
  command <context> <name>         Generate a new command
  information <context> <name>     Generate a new information
  event <context> <command> <name> Generate a new event
  prjcase <context> <info> <event> Generate a new projection case

Options:
  --no-query      Omit query.ts and resolve.ts files
  --no-projection Omit projection folder

Examples:
  app codegen context TaskManagement
  app codegen context TaskManagement --event-sourced
  app codegen command TaskManagement AddTodo
  app codegen information TaskManagement TodoList
  app codegen information TaskManagement TodoList --no-query --no-projection
  app codegen event TaskManagement AddTodo TodoAdded
  app codegen event TaskManagement TaskManagement.AddTodo TodoAdded
  app codegen event TaskManagement TaskManagement.AddTodo TaskManagement.TodoAdded
  app codegen prjcase TaskManagement TodoList TodoAdded
  app codegen prjcase TaskManagement TodoList TaskManagement.TodoAdded
`);
}