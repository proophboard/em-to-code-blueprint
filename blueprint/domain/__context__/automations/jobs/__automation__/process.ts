import {State} from "./state";
import {Command} from "@lib/types/message";

export default function process(state: State): Command[] {
  // Process state and trigger one or more new commands

  // It's not mandatory that process() triggers a command.
  // If prepare() performed network communication successfully, process() might do nothing,
  // if you don't want to track the result.
  return [];
}
