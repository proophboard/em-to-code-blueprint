import {EventRegistry} from "@lib/types/event-registry";
import prepareTodoAdded from "./information/todo-list/projection/todo-added/prepare";
import applyTodoAdded from "./information/todo-list/projection/todo-added/apply";

export const events: EventRegistry = {
  "TaskManagement.TodoAdded": {
    apply: [
      {
        information: "TaskManagement.TodoList",
        inline: true,
        addsTodoJob: false,
        prepare: prepareTodoAdded,
        exec: applyTodoAdded
      }
    ],
    automate: []
  }
};
