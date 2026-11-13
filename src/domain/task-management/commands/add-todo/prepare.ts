import {Command} from "@lib/types/message";
import {Payload} from "./payload";
import {State} from "./state";
import {ServiceRegistry} from "@lib/types/service-registry";
import {DocumentStore} from "@lib/document-store/document-store";
import {SERVICE_KEY_DOCUMENT_STORE} from "../../services";
import {AndFilter} from "@lib/document-store/filter/AndFilter";
import {EqFilter} from "@lib/document-store/filter/EqFilter";

export default async function prepare(cmd: Command<Payload>, services: ServiceRegistry): Promise<State> {
  const ds = services.get<DocumentStore>(SERVICE_KEY_DOCUMENT_STORE);

  const ids = await ds.findDocIds(
    'todo_collection',
    new AndFilter(
      new EqFilter('title', cmd.payload.title),
      new EqFilter('owner', cmd.payload.owner),
      new EqFilter('status', 'open'),
    )
  );

  return {
    sameTitleTodoList: ids,
  };
}
