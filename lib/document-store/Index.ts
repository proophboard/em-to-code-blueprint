import {IndexProcessor} from "@lib/document-store/index-processor";

export interface Index {
  readonly name: string;

  processWith: (indexProcessor: IndexProcessor, tableName: string) => any;
}

