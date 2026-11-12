import {Payload} from "./payload";
import {State} from "./state";
import {TodoAdded} from "./events/todo-added";
import {Command, Event} from "@lib/types/message";
import {messageFactory} from "@lib/message-factory/message-factory";

export default function handle(cmd: Command<Payload>, state: State): Event[] {

  if(state.sameTitleTodoList.length > 0) {
    throw new Error("Todo with same title already exists");
  }

  return [
    messageFactory().makeEvent<TodoAdded>("TaskManagement.TodoAdded", cmd.payload, cmd.meta),
  ]
}
