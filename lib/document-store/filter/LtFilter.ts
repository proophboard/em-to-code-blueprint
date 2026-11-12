import {Filter} from "../Filter";
import {getValueFromPath} from "../helpers";
import {FilterProcessor} from "@lib/document-store/filter-processor";

export class LtFilter implements Filter {
    public readonly prop: string;
    public readonly val: any;
    public readonly collection: string;

    constructor(prop: string, val: any, collection = 'local') {
        this.prop = prop;
        this.val = val;
        this.collection = collection;
    }

    processWith(processor: FilterProcessor): any {
      return processor.processLtFilter(this);
    }
}
