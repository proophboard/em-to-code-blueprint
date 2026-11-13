import {Command, Event, Query} from "@lib/types/message";
import {commands} from "./commands";
import {events, events as eventRegistry} from "./events";
import {
  SERVICE_KEY_INFORMATION_FLOW_LOGGER,
  SERVICE_KEY_JOB_QUEUE,
  SERVICE_KEY_MULTI_MODEL_STORE,
  services
} from "./services";
import {InformationFlowLogger} from "@lib/information-flow-logger/information-flow-logger";
import {MultiModelStore} from "@lib/multi-model-store/multi-model-store";
import {SessionTask} from "@lib/multi-model-store/session";
import {InformationApplyMapping} from "@lib/types/event-registry";
import {InMemoryJobQueue} from "@lib/job-queue/in-memory-job-queue";
import {jobs} from "./job-automations";
import {JobQueue} from "@lib/job-queue/job-queue";
import {queries} from "./queries";
import {NotFoundError} from "@lib/error/not-found-error";

const handle = async (cmd: Command) => {
  const store = services.get<MultiModelStore>(SERVICE_KEY_MULTI_MODEL_STORE);

  /**
   * Begin of concurrency handling would go here, e.g. by defining a Dynamic-Consistency-Boundary or checking entity/stream version(s)
   *
   * This naive implementation does not handle concurrency.
   * It falls back to last write wins, which is typical in many environments.
   *
   * @todo: Discuss concurrency handling
   */

  const logger = services.get<InformationFlowLogger>(SERVICE_KEY_INFORMATION_FLOW_LOGGER);

  const handler = commands[cmd.name];

  if (!handler) {
    throw new NotFoundError(`Command ${cmd.name} unknown`);
  }

  logger.logCommand(`Preparing command handler for ${cmd.name}`, cmd);

  const state = await handler.prepare(cmd, services);

  logger.logCommand(`Command handler prepared for ${cmd.name}`, state);

  const events = handler.exec(cmd, state);

  logger.logCommand(`Command handler executed for ${cmd.name}`, events);

  const session = store.beginSession();

  for (const event of events) {
    session.pushTasks(await applyAll(event));
  }

  /**
   * Want to use Event Sourcing?
   *
   * session.appendEventsTo('__context___stream', events);
   *
   * @todo: Discuss Event Sourcing
   *
   * In this event sourcing set up, read model updates and events are handled in the same transaction.
   * This is also known as inline projections and avoids eventual consistency issues.
   *
   * A system that needs high write throughput might want to separate event storage from read model updates.
   * This is also known as async projections and requires dealing with eventual consistency.
   *
   * You can of course also mix both, and activate async projections per use case.
   */

  // Persist the entire unit of work (session) in one transaction
  await store.commitSession(session);

  /*------------------------ AFTER COMMAND PROCESSING AND DB TRANSACTION ----------------------------------------*/

  /**
   * Ideally, you don't have any logic here. Everything that runs in the same process as the command, but
   * is not included in the db transaction, has the potential to create inconsistencies.
   *
   * What you can do instead:
   *
   * ## With Event Sourcing
   *
   * Use the Event Store as a central hub to pull new events and apply them to async read models and forward them to a message broker for async processing.
   *
   * ## Without Event Sourcing
   *
   * Use one or more tables in your database as job queues and add tasks to the session before commit to populate new tasks.
   * Poll the job queue(s) to process the tasks.
   *
   * ## With any architecture
   *
   * The recommended automation pattern in Event Modeling is the so-called todolist pattern.
   *
   * Events populate todolist read models. Scheduled watchers (e.g. through cron) monitor the todolists and trigger
   * automation logic for each todo item. The automation logic inspects the state of the todo and dispatches new commands.
   *
   * Having said this, the following code is for demonstration purposes only. It is not production ready or at least you
   * should use it with caution and consider the alternatives mentioned above.
   *
   * At the end it is a tradeoff. Either you live with the risk, that automations might not get triggered correctly due to unexpected errors,
   * or you add dedicated infrastructure to decouple the automation logic from the command process.
   *
   * For prototypes, MVPs, and internal apps in-process automation is a viable option. Make sure that you have proper alerting and log monitoring in place,
   * to at least detect unexpected errors.
   */
  const jobQueue = services.get<JobQueue>(SERVICE_KEY_JOB_QUEUE);

  const todolistsToSchedule: string[] = [];

  events.forEach(evt => {
    if(eventRegistry[evt.name]) {
      eventRegistry[evt.name].apply.forEach(applyMapping => {
        if(applyMapping.addsTodoJob) {
          todolistsToSchedule.push(applyMapping.information);
        }
      })
    }
  })

  if(todolistsToSchedule.length > 0) {
    // Since we have no cron set up to monitor todolists, we use in-process scheduling instead.
    jobQueue.scheduleJobRuns(todolistsToSchedule);
  }

  // In-process event publishing
  // @todo: Change for mission-critical production systems
  events.forEach(evt => {
    if(eventRegistry[evt.name]) {
      eventRegistry[evt.name].automate.forEach(async (automateMapping) => {
        if(automateMapping.inline) {
          try {
            logger.logAutomation(`Preparing event automation "${automateMapping.automation}"`);

            const state = await automateMapping.prepare(evt, services);

            logger.logAutomation(`Executing event automation "${automateMapping.automation}" with state: `, state);
            const commands = automateMapping.exec(evt, state);

            logger.logAutomation(`Going to dispatch new commands from event automation "${automateMapping.automation}"`, commands);

            for(const command of commands) {
              try {
                await handle(command);
              } catch (e) {
                logger.logAutomation(`Failed to dispatch command "${command.name}" from event automation "${automateMapping.automation}"`);
                logger.error(e);
              }
            }
          } catch (e) {
            logger.logAutomation(`Failed to  trigger event automation "${automateMapping.automation}"`);
            logger.error(e);
          }
        }
      })
    }
  })
};

// Register in memory job queue with handle function as dispatcher
// @todo: For a production system, this needs to be replaced with a persistent job queue
services.set(SERVICE_KEY_JOB_QUEUE, new InMemoryJobQueue(handle, jobs, services, services.get<InformationFlowLogger>(SERVICE_KEY_INFORMATION_FLOW_LOGGER)));

const applyAll = async (event: Event): Promise<SessionTask[]> => {
  if(!events[event.name]) {
    throw new Error(`Event ${event.name} is unknown`);
  }

  const tasks: SessionTask[] = [];

  const allApply= events[event.name].apply;

  for (const applyMapping of allApply) {
    // @todo: For Event Sourcing with potentially async projections,
    // use the following check to skip any projection not marked as inline
    // if(!applyMapping.inline) {
    //   continue;
    // }

    tasks.push(...await applyEventToInformation(event, applyMapping));
  }

  return tasks;
}

const applyEventToInformation = async (event: Event, apply: InformationApplyMapping) => {
  const logger = services.get<InformationFlowLogger>(SERVICE_KEY_INFORMATION_FLOW_LOGGER);

  logger.logEvent(`Preparing event ${event.name} to be applied to information ${apply.information}`, event);

  const state = await apply.prepare(event, services);

  logger.logEvent(`Applying event ${event.name} to information ${apply.information}`, state);

  return apply.exec(event, state);
}

const resolve = async (query: Query): Promise<object | object[]> => {
  if(!queries[query.name]) {
    throw new NotFoundError(`Query ${query.name} is unknown`);
  }
}

export default {
  handle,
  apply: applyAll,
}
