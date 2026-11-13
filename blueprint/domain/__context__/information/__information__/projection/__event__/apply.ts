import {Event} from "@lib/types/message";
import {State} from "./state";
import {SessionTask} from "@lib/multi-model-store/session";
import {__Event__} from "../../../../commands/__command__/events/__event__";

export default function apply(event: Event<__Event__>, state: State): SessionTask[] {
  // Return one or more tasks to modify information
  return [];
}
