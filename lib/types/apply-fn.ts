import {MessageMeta, MessagePayload, Event} from "./message";
import {State} from "./state";
import {ServiceRegistry} from "@lib/types/service-registry";
import {SessionTask} from "@lib/multi-model-store/session";

export type PrepareApplyFn<P extends MessagePayload = any, M extends MessageMeta = any> = (event: Event<P, M>, services: ServiceRegistry) => Promise<State>;

export type ApplyFn<P extends MessagePayload = any, M extends MessageMeta = any> = (event: Event<P, M>, state: State) => SessionTask[];
