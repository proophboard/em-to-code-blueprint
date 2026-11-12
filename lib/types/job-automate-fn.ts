import {Command} from "./message";
import {State} from "./state";
import {ServiceRegistry} from "@lib/types/service-registry";

export type PrepareJobAutomateFn = (services: ServiceRegistry) => Promise<State>;

export type JobAutomateFn = (state: State) => Command[];
