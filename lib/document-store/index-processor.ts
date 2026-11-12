import {Index} from "@lib/DocumentStore/Index";
import {FieldIndex} from "@lib/DocumentStore/Index/FieldIndex";
import {MultiFieldIndex} from "@lib/DocumentStore/Index/MultiFieldIndex";
import {MetadataFieldIndex} from "@lib/DocumentStore/Index/MetadataFieldIndex";

export interface IndexProcessor {
  process: (index: Index, tableName: string) => any;
  processFieldIndex: (index: FieldIndex, tableName: string) => any;
  processMultiFieldIndex: (index: MultiFieldIndex, tableName: string) => any;
  processMetadataFieldIndex: (index: MetadataFieldIndex, tableName: string) => any;
}
