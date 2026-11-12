import {HandleFn, PrepareHandleFn} from "./handle-fn";

export type CommandRegistry = {
  [commandName: string]: {
    prepare: PrepareHandleFn,
    exec: HandleFn
  }
}
