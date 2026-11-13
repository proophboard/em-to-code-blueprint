import {Command} from "@lib/types/message";
import {Payload} from "./payload";
import {State} from "./state";

export default async function prepare(cmd: Command<Payload> /*, inject runtime dependencies to load state */): Promise<State> {
  // @TODO: inject document store and load todos with same title

  return {
    sameTitleTodoList: [],
  };
}
