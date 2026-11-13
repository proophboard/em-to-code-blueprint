export function printCodegenHelp() {
  console.log(`Usage: app codegen <command> [arguments]

Commands:
  context <name> [--event-sourced]  Generate a new context
  command <context> <name>          Generate a new command
  information <context> <name>      Generate a new information
  event <context> <command> <name>  Generate a new event
  prjcase <context> <info> <event>  Generate a new projection case
  job <context> <info> <automation> Generate a new job automation
  on <context> <event> <automation> Generate a new event automation

Options:
  --no-query      Omit query.ts and resolve.ts files
  --no-projection Omit projection folder

Options (prjcase):
  --async       Set inline: false in the projection case config
  --adds-todo   Set addsTodoJob: true in the projection case config

Options (on):
  --async  Set inline: false in the event automation config

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
  app codegen prjcase TaskManagement TodoList TodoAdded --async
  app codegen prjcase TaskManagement TodoList TodoAdded --adds-todo
  app codegen job TaskManagement TodoList SendNotification
  app codegen job TaskManagement TodoList TaskManagement.SendNotification
  app codegen on TaskManagement TodoAdded SendNotification
  app codegen on TaskManagement TaskManagement.TodoAdded TaskManagement.SendNotification
  app codegen on TaskManagement TodoAdded SendNotification --async
`);
}
