import {FilterProcessor} from "@lib/document-store/filter-processor";
import {AnyFilter} from "@lib/document-store/filter/AnyFilter";
import {EqFilter} from "@lib/document-store/filter/EqFilter";
import {AndFilter} from "@lib/document-store/filter/AndFilter";
import {Filter} from "@lib/document-store/Filter";
import {OrFilter} from "@lib/document-store/filter/OrFilter";
import {DocIdFilter} from "@lib/document-store/filter/DocIdFilter";
import {ExistsFilter} from "@lib/document-store/filter/ExistsFilter";
import {GtFilter} from "@lib/document-store/filter/GtFilter";
import {GteFilter} from "@lib/document-store/filter/GteFilter";
import {LtFilter} from "@lib/document-store/filter/LtFilter";
import {LteFilter} from "@lib/document-store/filter/LteFilter";
import {InArrayFilter} from "@lib/document-store/filter/InArrayFilter";
import {LikeFilter} from "@lib/document-store/filter/LikeFilter";
import {NotFilter} from "@lib/document-store/filter/NotFilter";
import {AnyOfDocIdFilter} from "@lib/document-store/filter/AnyOfDocIdFilter";
import {AnyOfFilter} from "@lib/document-store/filter/AnyOfFilter";
import {ArrayIntersectFilter} from '@lib/document-store/filter/ArrayIntersectFilter';
import {getValueFromPath} from "@lib/document-store/helpers";

type ReturnType = (doc: any, docId: string) => boolean;

export class InMemoryFilterProcessor implements FilterProcessor {

  process(filter: Filter): ReturnType {
    return filter.processWith(this);
  }

  processAnyFilter(filter: AnyFilter): ReturnType {
    return () => true;
  };

  processEqFilter(filter: EqFilter): ReturnType {
    return (doc: any) => getValueFromPath(filter.prop, doc) === filter.val;
  };

  processAndFilter(filter: AndFilter): ReturnType {
    return (doc: any, docId: string) => {
      const filterFunctions = filter.internalFilters.map(innerFilter => innerFilter.processWith(this));
      return filterFunctions.every(filterFunction => filterFunction(doc, docId));
    }
  };

  processOrFilter(filter: OrFilter): ReturnType {
    return (doc: any, docId: string) => {
      const filterFunctions = filter.internalFilters.map(innerFilter => innerFilter.processWith(this));
      return filterFunctions.some(filterFunction => filterFunction(doc, docId));
    }
  };

  processDocIdFilter(filter: DocIdFilter): ReturnType {
    return (doc: any, docId: string) => docId === filter.val;
  };

  processExistsFilter(filter: ExistsFilter): ReturnType {
    return (doc: any) => getValueFromPath(filter.prop, doc) !== undefined;
  }

  processGtFilter(filter: GtFilter): ReturnType {
    return (doc: any) => getValueFromPath(filter.prop, doc) > filter.val;
  }

  processGteFilter(filter: GteFilter): ReturnType {
    return (doc: any) => getValueFromPath(filter.prop, doc) >= filter.val;
  }

  processLtFilter(filter: LtFilter): ReturnType {
    return (doc: any) => getValueFromPath(filter.prop, doc) < filter.val;
  }

  processLteFilter(filter: LteFilter): ReturnType {
    return (doc: any) => getValueFromPath(filter.prop, doc) <= filter.val;
  }

  processInArrayFilter(filter: InArrayFilter): ReturnType {
    return (doc: any) => {
      const value = getValueFromPath(filter.prop, doc);
      return Array.isArray(value) && value.includes(filter.val);
    };
  }

  processLikeFilter(filter: LikeFilter): ReturnType {
    return (doc: any) => {
      const value = getValueFromPath(filter.prop, doc);

      if (typeof value !== 'string') {
        return false;
      }

      if(filter.val.startsWith('%') && filter.val.endsWith('%')) {
        return value.includes(filter.val.slice(1, -1));
      }

      if(filter.val.startsWith('%')) {
        return value.endsWith(filter.val.slice(1));
      }

      if(filter.val.endsWith('%')) {
        return value.startsWith(filter.val.slice(0,-1));
      }

      return value === filter.val;
    };
  }

  processNotFilter(filter: NotFilter): ReturnType {
    return (doc: any, docId: string) => {
      const filterFunction = filter.innerFilter.processWith(this);
      return !filterFunction(doc, docId);
    };
  }

  processAnyOfDocIdFilter(filter: AnyOfDocIdFilter): ReturnType {
    return (doc: any, docId: string) => filter.valList.includes(docId);
  }

  processAnyOfFilter(filter: AnyOfFilter): ReturnType {
    return (doc: any) => {
      const value = getValueFromPath(filter.prop, doc);
      return filter.valList.includes(value);
    };
  }

  processArrayIntersectFilter(filter: ArrayIntersectFilter): ReturnType {
    return (doc: any) => {
      const value = getValueFromPath(filter.prop, doc);

      if (filter.valList.length === 0) {
        return false;
      }

      return filter.valList.some((item) => value.includes(item));
    };
  }
}
