import {Query} from "@lib/types/message";
import {Query as Payload} from "./query";
import {ServiceRegistry} from "@lib/types/service-registry";
import {__information__} from "./__information__";

export default async function resolve(query: Query<Payload>, services: ServiceRegistry): Promise<__information__> {
  // Use services from ServiceRegistry, e.g. Document Store to query information
  return {};
}
