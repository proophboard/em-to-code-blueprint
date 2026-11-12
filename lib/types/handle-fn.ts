import {Command, Event, MessageMeta, MessagePayload} from "./message";
import {State} from "./state";
import {ServiceRegistry} from "@lib/types/service-registry";

export type PrepareHandleFn<P extends MessagePayload = any, M extends MessageMeta = any> = (command: Command<P, M>, services: ServiceRegistry) => Promise<State>;

export type HandleFn<P extends MessagePayload = any, M extends MessageMeta = any> = (command: Command<P, M>, state: State) => Event[];
