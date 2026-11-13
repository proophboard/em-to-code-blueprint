import {Event} from "@lib/types/message";
import {ServiceRegistry} from "@lib/types/service-registry";
import {State} from "./state";
import {__Event__} from "../../../../commands/__command__/events/__event__";

export default async function prepare(event: Event<__Event__>, services: ServiceRegistry): Promise<State> {
  // Load additional information needed for apply(), e.g. the currently stored information
  return {};
}
