export enum MatchOperator {
  EQ = '===',
  GT = '>',
  GTE = '>=',
  LT = '<',
  LTE = '<=',
}

type Value = string | number | boolean;
type EVT_PROP = "uuid" | "payload" | "name" | "meta" | "createdAt";

/**
 * evtProp defaults to "meta"
 */
export interface MatchObject {op: MatchOperator, val: Value | Array<Value>, evtProp?: EVT_PROP}

export const META_KEY_EVENT_ID = '$eventId';
export const META_KEY_EVENT_NAME = '$eventName';
export const META_KEY_CREATED_AT = '$createdAt';

export interface EventMatcher {
  [metadataKey: string]: string | MatchObject;
}
