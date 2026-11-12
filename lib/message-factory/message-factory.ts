import {Command, Event, Query, MessageMeta, MessagePayload} from "@lib/types/message";
import {SystemClock} from "@lib/system-clock/system-clock";
import {UuidGenerator} from "@lib/uuid-generator/uuid-generator";

export type MessageFactory = {
  makeCommand: <P extends MessagePayload = any, M extends MessageMeta = any>(name: string, payload: P, meta: M) => Command<P, M>;
  makeEvent: <P extends MessagePayload = any, M extends MessageMeta = any>(name: string, payload: P, meta: M) => Event<P, M>;
  makeQuery: <P extends MessagePayload = any, M extends MessageMeta = any>(name: string, payload: P, meta: M) => Query<P, M>;
}

type MessageFactoryFactory = () => MessageFactory;

let singletonFactory: MessageFactory = undefined;

export const initializeMessageFactory = (clock: SystemClock, uuidGenerator: UuidGenerator) => {
  singletonFactory = {
    makeCommand: <P extends MessagePayload = any, M extends MessageMeta = any>(name: string, payload: P, meta: M) => ({
      uuid: uuidGenerator.generate(),
      type: "command",
      createdAt: clock.now().toISOString(),
      name,
      payload,
      meta,
    }),
    makeEvent: <P extends MessagePayload = any, M extends MessageMeta = any>(name: string, payload: P, meta: M) => ({
      uuid: uuidGenerator.generate(),
      type: "event",
      createdAt: clock.now().toISOString(),
      name,
      payload,
      meta
    }),
    makeQuery: <P extends MessagePayload = any, M extends MessageMeta = any>(name: string, payload: P, meta: M) => ({
      uuid: uuidGenerator.generate(),
      type: "query",
      createdAt: clock.now().toISOString(),
      name,
      payload,
      meta
    }),
  }
}

export const messageFactory: MessageFactoryFactory = () => {
  if(!singletonFactory) {
    throw new Error("Message factory not initialized");
  }

  return singletonFactory;
};

