import {ApplyFn, PrepareApplyFn} from "./apply-fn";
import {EventAutomateFn, PrepareEventAutomateFn} from "./event-automate-fn";

export type InformationApplyMapping = {
  // Information name, if it is a todo list for a background job, name should match with todoList in job-automation-registry
  information: string,
  // Inline apply functions run in the same session as the event recording. For non-event-sourced systems, this should be ignored
  inline: boolean,
  // Marker for processing logic, to notify the job queue about a new todo job
  addsTodoJob: boolean,
  prepare: PrepareApplyFn,
  exec: ApplyFn
}

export type EventAutomationMapping = {
  // Name of the automation
  automation: string,
  // Inline automations run in the same process as the event recording, but after persistence, there is no retry by default
  // use only for prototyping or non-critical side effects. Consider using a message broker for async processing
  // or work with the todolist pattern instead, see job-automation-registry
  inline: boolean,
  prepare: PrepareEventAutomateFn,
  exec: EventAutomateFn
}

export type EventRegistry = {
  [eventName: string]: {
    // Register information apply functions
    apply: Array<InformationApplyMapping>,
    // Register automation functions
    automate: Array<EventAutomationMapping>,
  }
}
