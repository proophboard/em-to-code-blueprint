import {Event} from "@lib/types/message";
import {ServiceRegistry} from "@lib/types/service-registry";
import {State} from "./state";

export default async function prepare(event: Event, services: ServiceRegistry): Promise<State> {
  // Load additional information needed for apply(), e.g. the currently stored information
  return {};
}
