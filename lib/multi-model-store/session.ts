import {EventMatcher} from "@lib/event-store/event-matcher";
import {Filter} from "@lib/document-store/filter";
import {Event} from "@lib/types/message";

export type SessionTask = AppendEventsTask | DeleteEventsTask | UpsertDocumentTask | InsertDocumentTask | UpdateDocumentTask | ReplaceDocumentTask | DeleteDocumentTask | UpdateManyDocumentsTask | DeleteManyDocumentsTask;

export type AppendEventsTask = {
  streamName: string;
  events: Event[],
  eventMatcher?: EventMatcher;
  expectedVersion?: number;
}

export const isAppendEventsTask = (task: SessionTask): task is AppendEventsTask => {
  return (task as AppendEventsTask).events !== undefined;
}

export type DeleteEventsTask = {
  streamName: string;
  eventMatcher: EventMatcher;
}

export const isDeleteEventsTask = (task: SessionTask): task is DeleteEventsTask => {
  return (task as DeleteEventsTask).eventMatcher !== undefined && (task as AppendEventsTask).events === undefined;
}

export type ChangeDocumentTask = {
  collectionName: string;
  type: 'insert' | 'upsert' | 'update' | 'replace';
  docId: string;
  doc: object;
  metadata?: object;
  version?: number;
}

export type InsertDocumentTask = ChangeDocumentTask & {type: 'insert'};

export const isInsertDocumentTask = (task: SessionTask): task is InsertDocumentTask => {
  return (task as InsertDocumentTask).type === 'insert';
}

export type UpsertDocumentTask = ChangeDocumentTask & {type: 'upsert'};

export const isUpsertDocumentTask = (task: SessionTask): task is UpsertDocumentTask => {
  return (task as UpsertDocumentTask).type === 'upsert';
}

export type UpdateDocumentTask = ChangeDocumentTask & {type: 'update'};

export const isUpdateDocumentTask = (task: SessionTask): task is UpdateDocumentTask => {
  return (task as UpdateDocumentTask).type === 'update';
}

export type ReplaceDocumentTask = ChangeDocumentTask & {type: 'replace'};

export const isReplaceDocumentTask = (task: SessionTask): task is ReplaceDocumentTask => {
  return (task as ReplaceDocumentTask).type === 'replace';
}

export type DeleteDocumentTask = {
  collectionName: string;
  docId: string;
}

export const isDeleteDocumentTask = (task: SessionTask): task is DeleteDocumentTask => {
  return typeof (task as DeleteDocumentTask).collectionName !== undefined
    && typeof (task as DeleteDocumentTask).docId !== undefined
    && typeof (task as ChangeDocumentTask).type === undefined;
}

export type UpdateManyDocumentsTask = {
  collectionName: string;
  filter: Filter;
  docOrSubset: object;
  metadata?: object;
  version?: number;
}

export const isUpdateManyDocumentsTask = (task: SessionTask): task is UpdateManyDocumentsTask => {
  return typeof (task as UpdateManyDocumentsTask).collectionName !== undefined
    && typeof (task as UpdateManyDocumentsTask).filter !== undefined
    && typeof (task as UpdateManyDocumentsTask).docOrSubset !== undefined
    && typeof (task as ChangeDocumentTask).type === undefined;
}

export type DeleteManyDocumentsTask = {
  collectionName: string;
  filter: Filter;
}

export const isDeleteManyDocumentsTask = (task: SessionTask): task is DeleteManyDocumentsTask => {
  return typeof (task as DeleteManyDocumentsTask).collectionName !== undefined
    && typeof (task as DeleteManyDocumentsTask).filter !== undefined
    && typeof (task as UpdateManyDocumentsTask).docOrSubset === undefined
    && typeof (task as ChangeDocumentTask).type === undefined;
}

export class Session {
  private appendEventsTasks: AppendEventsTask[] = [];
  private deleteEventsTasks: DeleteEventsTask[] = [];
  private insertDocumentTasks: InsertDocumentTask[] = [];
  private upsertDocumentTasks: UpsertDocumentTask[] = [];
  private updateDocumentTasks: UpdateDocumentTask[] = [];
  private replaceDocumentTasks: ReplaceDocumentTask[] = [];
  private deleteDocumentTasks: DeleteDocumentTask[] = [];
  private updateManyDocumentsTasks: UpdateManyDocumentsTask[] = [];
  private deleteManyDocumentsTasks: DeleteManyDocumentsTask[] = [];
  private committed = false;
  private variables: Record<string, any> = {};

  public setVariable(varName: string, val: any): void {
    if(this.committed) {
      throw new Error(`[DB] Cannot set variable: ${varName}. Multi-Model-Store Session is already committed.`)
    }

    this.variables[varName] = val;
  }

  public getVariable<T>(varName: string, defaultVal?: T): T | undefined {
    if(typeof this.variables[varName] === "undefined") {
      return defaultVal;
    }

    return this.variables[varName];
  }

  public pushTasks (tasks: SessionTask[]): void {
    if(this.committed) {
      throw new Error(`[DB] Cannot push tasks. Multi-Model-Store Session is already committed.`)
    }

    for (const task of tasks) {
      switch (true) {
        case isAppendEventsTask(task):
          this.appendEventsTasks.push(task)
        break;
        case isDeleteEventsTask(task):
          this.deleteEventsTasks.push(task);
        break;
        case isInsertDocumentTask(task):
          this.insertDocumentTasks.push(task);
        break;
        case isUpsertDocumentTask(task):
          this.upsertDocumentTasks.push(task);
        break;
        case isUpdateDocumentTask(task):
          this.updateDocumentTasks.push(task);
        break;
        case isReplaceDocumentTask(task):
          this.replaceDocumentTasks.push(task);
        break;
        case isDeleteDocumentTask(task):
          this.deleteDocumentTasks.push(task);
        break;
        case isUpdateManyDocumentsTask(task):
          this.updateManyDocumentsTasks.push(task);
        break;
        case isDeleteManyDocumentsTask(task):
          this.deleteManyDocumentsTasks.push(task);
        break;
      }
    }
  }

  public appendEventsTo(streamName: string, events: Event[], eventMatcher?: EventMatcher, expectedVersion?: number): void {
    if(this.committed) {
      throw new Error(`[DB] Cannot append events to stream: ${streamName}. Multi-Model-Store Session is already committed.`)
    }
    this.appendEventsTasks.push({streamName, events, eventMatcher: eventMatcher, expectedVersion});
  }

  public deleteEventsFrom(streamName: string, eventMatcher: EventMatcher): void {
    if(this.committed) {
      throw new Error(`[DB] Cannot delete events from stream: ${streamName}. Multi-Model-Store Session is already committed.`)
    }
    this.deleteEventsTasks.push({streamName, eventMatcher});
  }

  public insertDocument(collectionName: string, docId: string, doc: object, metadata?: object, version?: number): void {
    if(this.committed) {
      throw new Error(`[DB] Cannot insert document (${docId}) in collection: ${collectionName}. Multi-Model-Store Session is already committed.`)
    }
    this.insertDocumentTasks.push({collectionName, type: 'insert', docId, doc, metadata, version});
  }

  public upsertDocument(collectionName: string, docId: string, doc: object, metadata?: object, version?: number): void {
    if(this.committed) {
      throw new Error(`[DB] Cannot upsert document (${docId}) in collection: ${collectionName}. Multi-Model-Store Session is already committed.`)
    }
    this.upsertDocumentTasks.push({collectionName, type: 'upsert', docId, doc, metadata, version});
  }

  public updateDocument(collectionName: string, docId: string, docOrSubset: object, metadata?: object, version?: number): void {
    if(this.committed) {
      throw new Error(`[DB] Cannot update document (${docId}) in collection: ${collectionName}. Multi-Model-Store Session is already committed.`)
    }
    this.updateDocumentTasks.push({collectionName, type: 'update', docId, doc: docOrSubset, metadata, version});
  }

  public replaceDocument(collectionName: string, docId: string, doc: object, metadata?: object, version?: number): void {
    if(this.committed) {
      throw new Error(`[DB] Cannot replace document (${docId}) in collection: ${collectionName}. Multi-Model-Store Session is already committed.`)
    }
    this.replaceDocumentTasks.push({collectionName, type: 'replace', docId, doc, metadata, version});
  }

  public deleteDocument(collectionName: string, docId: string): void {
    if(this.committed) {
      throw new Error(`[DB] Cannot delete document (${docId}) in collection: ${collectionName}. Multi-Model-Store Session is already committed.`)
    }
    this.deleteDocumentTasks.push({collectionName, docId});
  }

  public updateManyDocuments(collectionName: string, filter: Filter, docOrSubset: object, metadata?: object, version?: number): void {
    if(this.committed) {
      throw new Error(`[DB] Cannot update documents in collection: ${collectionName}. Multi-Model-Store Session is already committed.`)
    }
    this.updateManyDocumentsTasks.push({collectionName, filter, docOrSubset, metadata, version});
  }

  public deleteManyDocuments(collectionName: string, filter: Filter): void {
    if(this.committed) {
      throw new Error(`[DB] Cannot delete documents in collection: ${collectionName}. Multi-Model-Store Session is already committed.`)
    }
    this.deleteManyDocumentsTasks.push({collectionName, filter});
  }

  public getAppendEventsTasks(): AppendEventsTask[] {
    return [...this.appendEventsTasks];
  }

  public getDeleteEventsTasks(): DeleteEventsTask[] {
    return [...this.deleteEventsTasks];
  }

  public getInsertDocumentTasks(): InsertDocumentTask[] {
    return [...this.insertDocumentTasks];
  }

  public getUpsertDocumentTasks(): UpsertDocumentTask[] {
    return [...this.upsertDocumentTasks];
  }

  public getUpdateDocumentTasks(): UpdateDocumentTask[] {
    return [...this.updateDocumentTasks];
  }

  public getReplaceDocumentTasks(): ReplaceDocumentTask[] {
    return [...this.replaceDocumentTasks];
  }

  public getDeleteDocumentTasks(): DeleteDocumentTask[] {
    return [...this.deleteDocumentTasks];
  }

  public getUpdateManyDocumentsTasks(): UpdateManyDocumentsTask[] {
    return [...this.updateManyDocumentsTasks];
  }

  public getDeleteManyDocumentsTasks(): DeleteManyDocumentsTask[] {
    return [...this.deleteManyDocumentsTasks];
  }

  public commit(): void {
    this.committed = true;
  }
}
