import {MessageMeta, MessagePayload, Event, Command} from "./message";
import {State} from "./state";
import {ServiceRegistry} from "@lib/types/service-registry";

export type PrepareEventAutomateFn<P extends MessagePayload = any, M extends MessageMeta = any> = (event: Event<P, M>, services: ServiceRegistry) => Promise<State>;

export type EventAutomateFn<P extends MessagePayload = any, M extends MessageMeta = any> = (event: Event<P, M>, state: State) => Command[];
