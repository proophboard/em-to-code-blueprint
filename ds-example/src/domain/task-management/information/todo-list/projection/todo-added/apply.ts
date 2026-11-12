import {Event} from "@lib/types/message";
import {State} from "./state";
import {SessionTask} from "@lib/multi-model-store/session";
import {TodoAdded} from "../../../../commands/add-todo/events/todo-added";
import {insertDocument} from "@lib/multi-model-store/task-factories";
import {Todo} from "../../../todo/todo";

export default function apply(event: Event<TodoAdded>, state: State): SessionTask[] {
  return [
    insertDocument<Todo>('todo_collection', event.payload.todoId, {
      ...event.payload,
      status: 'open'
    }),
  ];
}
