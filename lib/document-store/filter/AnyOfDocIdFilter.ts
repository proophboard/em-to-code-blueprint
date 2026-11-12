import {Filter} from "../Filter";
import {FilterProcessor} from "@lib/document-store/filter-processor";

export class AnyOfDocIdFilter implements Filter {
    public readonly valList: any[];
    public readonly collection: string;

    constructor(valList: any[], collection = 'local') {
        this.valList = valList;
        this.collection = collection;
    }

    processWith(processor: FilterProcessor): any {
      return processor.processAnyOfDocIdFilter(this);
    }
}
