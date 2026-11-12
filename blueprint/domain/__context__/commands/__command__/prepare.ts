import {Command} from "@lib/types/message";
import {Payload} from "./payload";
import {State} from "./state";
import {ServiceRegistry} from "@lib/types/service-registry";

export default async function prepare(cmd: Command<Payload>, services: ServiceRegistry): Promise<State> {
  /**
   * Prepare state for handle()
   *
   * Depending on runtime, libraries, infrastructure, and architecture, state may be loaded from a database, a cache, or a remote service.
   * The prepare() function should handle all necessary loading and initialization of state before it is passed to handle().
   *
   * For event sourcing, the prepare() function may need to load the entire event stream for an aggregate root associated with the command or a set of events if Dynamic-Consistency-Boundary is used.
   * This may involve querying a database or other persistent storage mechanism to retrieve the events that have been applied already.
   */

  return {};
}
