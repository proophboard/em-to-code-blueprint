import {Query} from "@lib/types/message";
import {Query as Payload} from "./query";
import {ServiceRegistry} from "@lib/types/service-registry";
import {TodoList} from "./todo-list";
import {SERVICE_KEY_DOCUMENT_STORE} from "../../services";
import {Todo} from "../todo/todo";
import {DocumentStore} from "@lib/document-store/document-store";
import {EqFilter} from "@lib/document-store/filter/EqFilter";
import {AnyFilter} from "@lib/document-store/filter/AnyFilter";
import {asyncIteratorToArray} from "@lib/helpers/async-iterator-to-array";
import {asyncMap} from "@lib/helpers/async-map";

export default async function resolve(query: Query<Payload>, services: ServiceRegistry): Promise<TodoList> {
  const ds = services.get<DocumentStore>(SERVICE_KEY_DOCUMENT_STORE);

  const cursor = await ds.findDocs<Todo>(
    'todo_collection',
    query.payload.status ? new EqFilter('status', query.payload.status) : new AnyFilter()
  )

  return asyncIteratorToArray(asyncMap(cursor, ([docId, doc, version]) => doc));
}
