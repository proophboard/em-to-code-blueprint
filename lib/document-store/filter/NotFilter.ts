import {Filter} from "../Filter";
import {FilterProcessor} from "@lib/document-store/filter-processor";

export class NotFilter implements Filter {
    public readonly innerFilter: Filter;

    constructor(innerFilter: Filter) {
        this.innerFilter = innerFilter;
    }

    processWith(processor: FilterProcessor): any {
      return processor.processNotFilter(this);
    }
}
