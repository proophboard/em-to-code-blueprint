import {CommandRegistry} from "@lib/types/command-registry";
import prepareAddTodo from "./commands/add-todo/prepare";
import handleAddTodo from "./commands/add-todo/handle";

export const commands: CommandRegistry = {
  "TaskManagement.AddTodo": {
    prepare: prepareAddTodo,
    exec: handleAddTodo
  },
};
