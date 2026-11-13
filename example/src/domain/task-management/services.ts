import {ServiceRegistry} from "@lib/types/service-registry";
import {MachineClock} from "@lib/system-clock/machine-clock";
import {uuid} from "@lib/uuid-generator/crypto-uuid-generator";
import {ConsoleLogger} from "@lib/information-flow-logger/console-logger";
import {InMemoryMultiModelStore} from "@lib/multi-model-store/in-memory-multi-model-store";
import {InMemoryEventStore} from "@lib/event-store/in-memory-event-store";
import {NodeFilesystem} from "@lib/filesystem/node-file-system";
import {InMemoryDocumentStore} from "@lib/document-store/in-memory-document-store";
import {InMemoryJobQueue} from "@lib/job-queue/in-memory-job-queue";

export const SERVICE_KEY_SYSTEM_CLOCK = "system-clock";
export const SERVICE_KEY_UUID_GENERATOR = "uuid-generator";
export const SERVICE_KEY_INFORMATION_FLOW_LOGGER = "information-flow-logger";
export const SERVICE_KEY_EVENT_STORE = "event-store";
export const SERVICE_KEY_DOCUMENT_STORE = "document-store";
export const SERVICE_KEY_MULTI_MODEL_STORE = "multi-model-store";
export const SERVICE_KEY_JOB_QUEUE = "job-queue";

const makeInMemoryEventStore = (): InMemoryEventStore => {
  return new InMemoryEventStore(new NodeFilesystem(), process.cwd() + `/data/persistent-streams.json`);
}

const makeInMemoryDocumentStore = (): InMemoryDocumentStore => {
  return new InMemoryDocumentStore(
    new NodeFilesystem(),
    process.cwd() + `/data/persistent-collections.json`
  );
}

const makeInMemoryMultiModelStore = (es: InMemoryEventStore, ds: InMemoryDocumentStore) => {
  return new InMemoryMultiModelStore(
    es,
    ds
  );
};

const es = makeInMemoryEventStore();
const ds = makeInMemoryDocumentStore();

const serviceMap: Record<string, any> = {
  [SERVICE_KEY_SYSTEM_CLOCK]: new MachineClock(),
  [SERVICE_KEY_UUID_GENERATOR]: uuid(),
  [SERVICE_KEY_INFORMATION_FLOW_LOGGER]: new ConsoleLogger('__context__'),
  [SERVICE_KEY_EVENT_STORE]: es,
  [SERVICE_KEY_DOCUMENT_STORE]: ds,
  [SERVICE_KEY_MULTI_MODEL_STORE]: makeInMemoryMultiModelStore(es, ds),
};

export const services: ServiceRegistry = {
  get: <T>(name: string): T => {
    if(!serviceMap[name]) {
      throw new Error(`Service ${name} not found`);
    }

    return serviceMap[name];
  },

  set: <T>(name: string, service: T) => {
    serviceMap[name] = service;
  }
};




