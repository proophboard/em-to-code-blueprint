import {AndFilter} from "@lib/document-store/filter/AndFilter";
import {AnyFilter} from "@lib/document-store/filter/AnyFilter";
import {AnyOfDocIdFilter} from "@lib/document-store/filter/AnyOfDocIdFilter";
import {AnyOfFilter} from "@lib/document-store/filter/AnyOfFilter";
import {DocIdFilter} from "@lib/document-store/filter/DocIdFilter";
import {EqFilter} from "@lib/document-store/filter/EqFilter";
import {ExistsFilter} from "@lib/document-store/filter/ExistsFilter";
import {GteFilter} from "@lib/document-store/filter/GteFilter";
import {GtFilter} from "@lib/document-store/filter/GtFilter";
import {InArrayFilter} from "@lib/document-store/filter/InArrayFilter";
import {LikeFilter} from "@lib/document-store/filter/LikeFilter";
import {LteFilter} from "@lib/document-store/filter/LteFilter";
import {LtFilter} from "@lib/document-store/filter/LtFilter";
import {NotFilter} from "@lib/document-store/filter/NotFilter";
import {OrFilter} from "@lib/document-store/filter/OrFilter";
import {ArrayIntersectFilter} from "@lib/document-store/filter/ArrayIntersectFilter";

export const filters = {
  AndFilter: AndFilter,
  AnyFilter: AnyFilter,
  AnyOfDocIdFilter: AnyOfDocIdFilter,
  AnyOfFilter: AnyOfFilter,
  DocIdFilter: DocIdFilter,
  EqFilter: EqFilter,
  ExistsFilter: ExistsFilter,
  GteFilter: GteFilter,
  GtFilter: GtFilter,
  InArrayFilter: InArrayFilter,
  LikeFilter: LikeFilter,
  LteFilter: LteFilter,
  LtFilter: LtFilter,
  NotFilter: NotFilter,
  OrFilter: OrFilter,
  ArrayIntersectFilter: ArrayIntersectFilter,
}
