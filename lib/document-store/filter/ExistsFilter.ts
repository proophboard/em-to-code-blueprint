import {Filter} from "@lib/document-store/Filter";
import {FilterProcessor} from "@lib/document-store/filter-processor";

export class ExistsFilter implements Filter {
  public readonly prop: string;
  public readonly collection: string;

  constructor(prop: string, collection = 'local') {
    this.prop = prop;
    this.collection = collection;
  }

  processWith(processor: FilterProcessor): any {
    return processor.processExistsFilter(this);
  }
}
