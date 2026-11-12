import {Filter} from "@lib/document-store/Filter";
import {FilterProcessor} from "@lib/document-store/filter-processor";

export class DocIdFilter implements Filter {
  public readonly val: any;
  public readonly collection: string;

  constructor(val: any, collection = 'local') {
    this.val = val;
    this.collection = collection;
  }

  processWith(processor: FilterProcessor): any {
    return processor.processDocIdFilter(this);
  }
}
