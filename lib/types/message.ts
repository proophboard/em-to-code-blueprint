export type MessagePayload = { readonly [k: string]: unknown };
export type MessageMeta = { readonly [k: string]: unknown };
export type MessageType = 'command' | 'event' | 'query';

export interface Message<P extends MessagePayload = any, M extends MessageMeta = any> {
  readonly uuid: string;
  readonly name: string;
  readonly type: MessageType;
  readonly payload: P;
  readonly meta: M;
  readonly createdAt: string;
}

export type Command<P extends MessagePayload = any, M extends MessageMeta = any> = Message<P, M> & { readonly type: 'command' };
export type Event<P extends MessagePayload = any, M extends MessageMeta = any> = Message<P, M> & { readonly type: 'event' };
export type Query<P extends MessagePayload = any, M extends MessageMeta = any> = Message<P, M> & { readonly type: 'query' };
