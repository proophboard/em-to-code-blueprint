import {ServiceRegistry} from "@lib/types/service-registry";
import {State} from "./state";

export default async function prepare(services: ServiceRegistry): Promise<State> {
  /**
   * Prepare state for process()
   *
   * Depending on runtime, libraries, infrastructure, and architecture, state may be loaded from a database, a cache, or a remote service.
   * The prepare() function should handle all necessary network communication before state is passed to process().
   *
   * For external system communication, e.g. email sending, api calls, ... prepare is also the correct place.
   * Store the result of the network communication in the state and let process() deal with the information.
   *
   * As an example, you may have a todolist to send email notifications to users:
   *
   * Send the notification email in the prepare() function and store success or failure in state.
   * process() checks the state and either triggers a "MarkNotificationSent" command that checks off the todo for the notification
   * or records the error and schedules a retry.
   */
  return {};
}
