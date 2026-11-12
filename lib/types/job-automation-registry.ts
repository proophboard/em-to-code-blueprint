import {JobAutomateFn, PrepareJobAutomateFn} from "./job-automate-fn";

export type JobAutomationRegistry = {
  [automationName: string]: {
    // Information name of the todo list, should match with the name of information in event-registry
    todoList: string,
    prepare: PrepareJobAutomateFn,
    exec: JobAutomateFn
  }
}
