import {Filter} from "../filter";
import {FilterProcessor} from "@lib/document-store/filter-processor";

export class AndFilter implements Filter {
    public readonly internalFilters: Filter[];

    constructor(aFilter: Filter, bFilter: Filter, ...otherFilters: Filter[]) {
        this.internalFilters = [aFilter, bFilter, ...otherFilters];
    }

    processWith(processor: FilterProcessor): any {
        return processor.processAndFilter(this);
    }
}
