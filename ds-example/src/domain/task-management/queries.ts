import {QueryRegistry} from "@lib/types/query-registry";
import resolveTodoList from "./information/todo-list/resolve";

export const queries: QueryRegistry = {
  "TaskManagement.TodoList": resolveTodoList,
};
