import {Filter} from "@lib/document-store/filter";
import {EventMatcher} from "@lib/event-store/event-matcher";
import {
  AppendEventsTask, DeleteDocumentTask,
  DeleteEventsTask, DeleteManyDocumentsTask,
  InsertDocumentTask, ReplaceDocumentTask, UpdateDocumentTask, UpdateManyDocumentsTask,
  UpsertDocumentTask
} from "@lib/multi-model-store/session";
import {Event} from "@lib/types/message";

export function appendEventsTo(streamName: string, events: Event[], eventMatcher?: EventMatcher, expectedVersion?: number): AppendEventsTask {
  return {streamName, events, eventMatcher: eventMatcher, expectedVersion};
}

export function deleteEventsFrom(streamName: string, eventMatcher: EventMatcher): DeleteEventsTask {
  return {streamName, eventMatcher};
}

export function insertDocument<D extends object>(collectionName: string, docId: string, doc: D, metadata?: object, version?: number): InsertDocumentTask {
  return {collectionName, type: 'insert', docId, doc, metadata, version};
}

export function upsertDocument<D extends object>(collectionName: string, docId: string, doc: D, metadata?: object, version?: number): UpsertDocumentTask {
  return {collectionName, type: 'upsert', docId, doc, metadata, version};
}

export function updateDocument<D extends object>(collectionName: string, docId: string, docOrSubset: Partial<D>, metadata?: object, version?: number): UpdateDocumentTask {
  return {collectionName, type: 'update', docId, doc: docOrSubset, metadata, version};
}

export function replaceDocument<D extends object>(collectionName: string, docId: string, doc: D, metadata?: object, version?: number): ReplaceDocumentTask {
  return {collectionName, type: 'replace', docId, doc, metadata, version};
}

export function deleteDocument(collectionName: string, docId: string): DeleteDocumentTask {
  return {collectionName, docId};
}

export function updateManyDocuments<D extends object>(collectionName: string, filter: Filter, docOrSubset: Partial<D>, metadata?: object, version?: number): UpdateManyDocumentsTask {
  return {collectionName, filter, docOrSubset, metadata, version};
}

export function deleteManyDocuments(collectionName: string, filter: Filter): DeleteManyDocumentsTask {
  return {collectionName, filter};
}
