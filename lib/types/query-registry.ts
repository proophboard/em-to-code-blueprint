import {ResolveFn} from "@lib/types/resolve-fn";

export type QueryRegistry = {
  [information: string]: ResolveFn<unknown>;
}
