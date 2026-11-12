import {Command, Event, Query, MessageMeta, MessagePayload} from "@lib/types/message";
import {uuid} from "@lib/uuid-generator/uuid-generator";

export type MessageFactory = {
  makeCommand: <P extends MessagePayload = any, M extends MessageMeta = any>(name: string, payload: P, meta: M) => Command<P, M>;
  makeEvent: <P extends MessagePayload = any, M extends MessageMeta = any>(name: string, payload: P, meta: M) => Event<P, M>;
  makeQuery: <P extends MessagePayload = any, M extends MessageMeta = any>(name: string, payload: P, meta: M) => Query<P, M>;
}

type MessageFactoryFactory = () => MessageFactory;

export const messageFactory: MessageFactoryFactory = () => {
  return {
    makeCommand: <P extends MessagePayload = any, M extends MessageMeta = any>(name: string, payload: P, meta: M) => ({
      uuid: uuid().generate(),
      type: "command",
      createdAt: (new Date()).toISOString(),
      name,
      payload,
      meta,
    }),
    makeEvent: <P extends MessagePayload = any, M extends MessageMeta = any>(name: string, payload: P, meta: M) => ({
      uuid: uuid().generate(),
      type: "event",
      createdAt: (new Date()).toISOString(),
      name,
      payload,
      meta
    }),
    makeQuery: <P extends MessagePayload = any, M extends MessageMeta = any>(name: string, payload: P, meta: M) => ({
      uuid: uuid().generate(),
      type: "query",
      createdAt: (new Date()).toISOString(),
      name,
      payload,
      meta
    }),
  };
};

