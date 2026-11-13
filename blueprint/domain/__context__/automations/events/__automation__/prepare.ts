import {ServiceRegistry} from "@lib/types/service-registry";
import {State} from "./state";
import {Event} from "@lib/types/message";
import {__Event__} from "../../../commands/__command__/events/__event__";

export default async function prepare(event: Event<__Event__>, services: ServiceRegistry): Promise<State> {
  /**
   * Prepare state for on()
   *
   * Depending on runtime, libraries, infrastructure, and architecture, state may be loaded from a database, a cache, or a remote service.
   * The prepare() function should handle all necessary network communication before state is passed to on().
   *
   * For external system communication, e.g. email sending, api calls, ... prepare is also the correct place.
   * Store the result of the network communication in the state and let on() deal with the information.
   *
   * As an example, you may send an email notification to user based on a certain event happened:
   *
   * Send the notification email in the prepare() function and store success or failure in state.
   * on() checks the state and either triggers a "MarkNotificationSent" command that checks or records the error and schedules a retry.
   */
  return {};
}
