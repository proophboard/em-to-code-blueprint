import {Index} from "@lib/document-store/Index";
import {IndexProcessor} from "@lib/document-store/index-processor";
import {Sort} from "@lib/document-store/document-store";

type MultiFieldIndexFields = Array<{ field: string, sort?: Sort }>;

export class MultiFieldIndex implements Index {
  public readonly name: string;
  public readonly fields: MultiFieldIndexFields;
  public readonly unique?: boolean;

  public static forFields(name: string, fields: string[], unique?: boolean): MultiFieldIndex {
    return new MultiFieldIndex(name, fields.map(field => ({ field })), unique);
  }

  public static forFieldsWithSort(name: string, fields: MultiFieldIndexFields, unique?: boolean): MultiFieldIndex {
    return new MultiFieldIndex(name, fields, unique);
  }

  private constructor(name: string, fields: MultiFieldIndexFields, unique?: boolean) {
    if (name.length < 1) {
      throw new Error('Index name must not be empty');
    }

    if (fields.length < 2) {
      throw new Error('Multi field index must contain at least two fields');
    }

    this.name = name;
    this.fields = fields;
    this.unique = unique;
  }

  public processWith(indexProcessor: IndexProcessor, tableName: string): any {
    return indexProcessor.processMultiFieldIndex(this, tableName);
  }
}
