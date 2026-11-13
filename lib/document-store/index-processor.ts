import {Index} from "@lib/document-store/Index";
import {FieldIndex} from "@lib/document-store/index/FieldIndex";
import {MultiFieldIndex} from "@lib/document-store/index/MultiFieldIndex";
import {MetadataFieldIndex} from "@lib/document-store/index/MetadataFieldIndex";

export interface IndexProcessor {
  process: (index: Index, tableName: string) => any;
  processFieldIndex: (index: FieldIndex, tableName: string) => any;
  processMultiFieldIndex: (index: MultiFieldIndex, tableName: string) => any;
  processMetadataFieldIndex: (index: MetadataFieldIndex, tableName: string) => any;
}
