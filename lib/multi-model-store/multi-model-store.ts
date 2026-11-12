import {Session} from "@lib/multi-model-store/session";
import {EventMatcher} from "@lib/event-store/event-matcher";
import {Event, MessageMeta, MessagePayload} from "@lib/types/message";

export interface MultiModelStore {
  loadEvents: <P extends MessagePayload = any, M extends MessageMeta = any>(streamName: string, eventMatcher?: EventMatcher, fromEventId?: string, limit?: number, reverse?: boolean) => Promise<AsyncIterable<Event<P,M>>>;
  loadDoc: <D extends object>(collectionName: string, docId: string) => Promise<{doc: D, version: number} | null>;
  beginSession: () => Session;
  commitSession: (session: Session) => Promise<boolean>;
}
