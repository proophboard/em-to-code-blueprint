import {FilterProcessor} from "@lib/document-store/filter-processor";

export interface Filter {
    processWith: (processor: FilterProcessor) => any;
}

