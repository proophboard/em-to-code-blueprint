import {JobQueue} from "@lib/job-queue/job-queue";
import {InformationFlowLogger} from "@lib/information-flow-logger/information-flow-logger";
import {JobAutomationRegistry} from "@lib/types/job-automation-registry";
import {ServiceRegistry} from "@lib/types/service-registry";
import {Command} from "@lib/types/message";

type Dispatcher = (cmd: Command) => Promise<void>;

export class InMemoryJobQueue implements JobQueue {
  private dispatch: Dispatcher;
  private logger: InformationFlowLogger;
  private jobAutomationRegistry: JobAutomationRegistry;
  private services: ServiceRegistry;

  constructor(dispatcher: Dispatcher, jobAutomationRegistry: JobAutomationRegistry, services: ServiceRegistry, logger: InformationFlowLogger) {
    this.dispatch = dispatcher;
    this.logger = logger;
    this.jobAutomationRegistry = jobAutomationRegistry;
    this.services = services;
  }

  public async scheduleJobRuns (todoLists: string[]) {
    for (const todoList in todoLists) {
      await this.execTodoListJobs(todoList);
    }
  }

  private async execTodoListJobs(todoList: string) {
    let todoListFound = false;

    try {
      for (const automation in this.jobAutomationRegistry) {
        const job = this.jobAutomationRegistry[automation];

        if(job.todoList === todoList) {
          todoListFound = true;

          this.logger.logAutomation(`Preparing job automation "${automation}" for todo list "${todoList}"`);

          const state = await job.prepare(this.services);

          this.logger.logAutomation(`Executing job automation "${automation}" for todo list "${todoList}" with state: `, state);
          const commands = job.exec(state);

          this.logger.logAutomation(`Going to dispatch new commands from job automation "${automation}"`, commands);

          for(const command of commands) {
            try {
              await this.dispatch(command);
            } catch (e) {
              this.logger.logAutomation(`Failed to dispatch command "${command.name}" from job automation "${automation}"`);
              this.logger.error(e);
            }
          }
        }
      }

      if(!todoListFound) {
        throw new Error(`Todo list ${todoList} not found`);
      }
    } catch (e) {
      this.logger.logAutomation(`Failed to execute jobs for todo list "${todoList}`);
      this.logger.error(e);
    }
  }
}
