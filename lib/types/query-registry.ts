import {ResolveFn} from "@lib/types/resolve-fn";

export type QueryRegistry = {
  [information: string]: {
    resolve: ResolveFn<object | object[]>
  }
}
