import {Filter} from "../Filter";
import {FilterProcessor} from "@lib/document-store/filter-processor";

export class AnyFilter implements Filter {
    processWith(processor: FilterProcessor): any {
      return processor.processAnyFilter(this);
    }
}
