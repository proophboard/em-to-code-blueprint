import { Filter } from '../filter';
import { FilterProcessor } from '@lib/document-store/filter-processor';

export class ArrayIntersectFilter implements Filter {
  public readonly prop: string;
  public readonly valList: any[];
  public readonly collection: string;

  constructor(prop: string, valList: any[], collection = 'local') {
    this.prop = prop;
    this.valList = valList;
    this.collection = collection;
  }

  processWith(processor: FilterProcessor): any {
    return processor.processArrayIntersectFilter(this);
  }
}
