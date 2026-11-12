import {Command, Event} from "@lib/types/message";
import {Payload} from "./payload";
import {State} from "./state";

export default function handle(cmd: Command<Payload>, state: State): Event[] {
  /**
   * Implement Business Logic
   *
   * Check if the command is valid against the current state of the system
   */
  return [/* Return events */]
}
