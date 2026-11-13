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

  session.appendEventsTo('__context___stream', events);

  await store.commitSession(session);

  /*------------------------ AFTER COMMAND PROCESSING AND DB TRANSACTION ----------------------------------------*/

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

services.set(SERVICE_KEY_JOB_QUEUE, new InMemoryJobQueue(handle, jobs, services, services.get<InformationFlowLogger>(SERVICE_KEY_INFORMATION_FLOW_LOGGER)));

const applyAll = async (event: Event): Promise<SessionTask[]> => {
  if(!events[event.name]) {
    throw new Error(`Event ${event.name} is unknown`);
  }

  const tasks: SessionTask[] = [];

  const allApply= events[event.name].apply;

  for (const applyMapping of allApply) {
    if(!applyMapping.inline) {
      continue;
    }

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
  const logger = services.get<InformationFlowLogger>(SERVICE_KEY_INFORMATION_FLOW_LOGGER);

  const handler = queries[query.name];

  if (!handler) {
    throw new Error(`Query ${query.name} unknown`);
  }

  logger.logInformation(`Resolving query ${query.name}`);

  const result = await handler.resolve(query, services);

  logger.logInformation(`Query ${query.name} resolved: `, result);

  return result;
}

export default {
  handle,
  resolve,
}
