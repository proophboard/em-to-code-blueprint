import {
    EventMatcher,
    MatchObject,
    MatchOperator,
    META_KEY_CREATED_AT,
    META_KEY_EVENT_ID,
    META_KEY_EVENT_NAME
} from "./event-matcher";
import {Event, MessageMeta, MessagePayload} from "@lib/types/message";

type Value = string | number | boolean;
type EVT_PROP = "uuid" | "payload" | "name" | "meta" | "createdAt";

export function checkMatchObject(key: string, matcher: string | MatchObject): MatchObject {
    if(Array.isArray(matcher) || typeof matcher !== "object") {
        let evtProp: EVT_PROP = "meta";

        if(key === META_KEY_EVENT_ID) {
            evtProp = "uuid";
        }

        if(key === META_KEY_EVENT_NAME) {
            evtProp = "name";
        }

        if(key === META_KEY_CREATED_AT) {
            evtProp = "createdAt"
        }

        return {op: MatchOperator.EQ, val: matcher, evtProp};
    }

    if(!matcher.evtProp) {
        matcher.evtProp = "meta";
    }

    return matcher;
}

export type AppendToListener = (streamName: string, events: Event[], isRepublishing?: boolean) => void;

export type StreamType = "write-model" | "public";

export interface EventStore {
    hasStream: (streamName: string) => Promise<boolean>;
    /**
     * @param streamName string Name of the stream
     * @param type StreamType Type of the stream, defaults to "write-model"
     */
    createStream: (streamName: string, type?: StreamType) => Promise<boolean>;
    deleteStream: (streamName: string) => Promise<boolean>;
    appendTo: (streamName: string, events: Event[], eventMatcher?: EventMatcher, expectedVersion?: number, doNotPublish?: boolean) => Promise<boolean>;
    load: <P extends MessagePayload = any, M extends MessageMeta = any>(streamName: string, eventMatcher?: EventMatcher, fromEventId?: string, limit?: number, reverse?: boolean) => Promise<AsyncIterable<Event<P,M>>>;
    delete: (streamName: string, eventMatcher: EventMatcher) => Promise<number>;
    attachAppendToListener: (listener: AppendToListener) => void;
    detachAppendToListener: (listener: AppendToListener) => void;
}
