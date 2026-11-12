import {Event} from "@lib/types/message";
import {State} from "./state";
import {SessionTask} from "@lib/multi-model-store/session";

export default function apply(event: Event, state: State): SessionTask[] {
  // Return one or more tasks to modify information
  return [];
}
