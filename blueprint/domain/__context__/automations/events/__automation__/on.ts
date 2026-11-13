import {State} from "./state";
import {Command, Event} from "@lib/types/message";
import {__Event__} from "../../../commands/__command__/events/__event__";

export default function on(event: Event<__Event__>, state: State): Command[] {
  // React on event and trigger one or more new commands

  // It's not mandatory that on() triggers a command.
  // If prepare() performed network communication successfully, on() might do nothing,
  // if you don't want to track the result.
  return [];
}
