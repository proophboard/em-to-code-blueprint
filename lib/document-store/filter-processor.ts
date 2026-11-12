import {EqFilter} from "@lib/document-store/filter/EqFilter";
import {AnyFilter} from "@lib/document-store/filter/AnyFilter";
import {AndFilter} from "@lib/document-store/filter/AndFilter";
import {Filter} from "@lib/document-store/filter";
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

export interface FilterProcessor {
  process: (filter: Filter) => any;
  processAnyFilter: (filter: AnyFilter) => any;
  processEqFilter: (filter: EqFilter) => any;
  processAndFilter: (filter: AndFilter) => any;
  processOrFilter: (filter: OrFilter) => any;
  processDocIdFilter: (filter: DocIdFilter) => any;
  processExistsFilter: (filter: ExistsFilter) => any;
  processGtFilter: (filter: GtFilter) => any;
  processGteFilter: (filter: GteFilter) => any;
  processLtFilter: (filter: LtFilter) => any;
  processLteFilter: (filter: LteFilter) => any;
  processInArrayFilter: (filter: InArrayFilter) => any;
  processLikeFilter: (filter: LikeFilter) => any;
  processNotFilter: (filter: NotFilter) => any;
  processAnyOfDocIdFilter: (filter: AnyOfDocIdFilter) => any;
  processAnyOfFilter: (filter: AnyOfFilter) => any;
  processArrayIntersectFilter: (filter: ArrayIntersectFilter) => any;
}
