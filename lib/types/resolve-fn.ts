import {MessageMeta, MessagePayload, Query} from "@lib/types/message";
import {ServiceRegistry} from "@lib/types/service-registry";

export type ResolveFn<R, P extends MessagePayload = any, M extends MessageMeta = any> = (query: Query<P, M>, services: ServiceRegistry) => Promise<R>;
