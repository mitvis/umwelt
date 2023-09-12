import { Type } from 'vega-lite/src/type';
import { UrlData, InlineData } from 'vega-lite/src/data';
import { Mark } from 'vega-lite/src/mark';
import { NonArgAggregateOp } from 'vega-lite/src/aggregate';
import { OlliNode, OlliValue } from 'olli';
import { Spec } from 'vega';
import { TopLevelSpec } from 'vega-lite/src/spec';
import { Sort } from 'vega-lite/src/sort';
import { LogicalComposition } from 'vega-lite/src/logical';
import { FieldPredicate } from 'vega-lite/src/predicate';

export type VlSpec = TopLevelSpec;
export type VgSpec = Spec;

type ScaleDomain = {
  domain?: OlliValue[];
  zero?: boolean;
  nice?: boolean | number;
}; //  | "type"
type ScaleRange = {
  range?: number[] | string[];
}; //  | "reverse"

export type MeasureType = Exclude<Type, 'geojson'>;
export type UmweltDataSource = UrlData | InlineData;

export type UmweltPredicate = LogicalComposition<FieldPredicate>;

export type VisualPropName = 'x' | 'y' | 'color' | 'size' | 'opacity' | 'shape' | 'detail' | 'facet' | 'row' | 'column' | 'order' | 'x2' | 'y2';
export type AudioPropName = 'pitch' | 'duration' | 'volume' | 'pan' | 'waveform';
export type EncodingPropName = VisualPropName | AudioPropName;

export type AudioAggregateOp = 'count' | 'mean' | 'median' | 'min' | 'max' | 'sum';

export const NONE = 'NONE';

type FieldName = string;

export interface FieldRef {
  field: FieldName;
}

export interface ValueRef {
  value: OlliValue;
}

export interface EncodingRef {
  property: EncodingPropName;
  unit: string;
}

export interface FieldDef {
  name: FieldName;
  type?: MeasureType;
  encodings?: EncodingRef[];
  //
  scale?: ScaleDomain;
  timeUnit?: string;
  aggregate?: NonArgAggregateOp;
  bin?: boolean;
  sort?: Sort<any>;
}

export interface VisualEncodingFieldDef {
  field: FieldName;
  //
  scale?: ScaleDomain & ScaleRange;
  timeUnit?: string;
  aggregate?: NonArgAggregateOp | typeof NONE;
  bin?: boolean;
  sort?: Sort<any>;
}

export interface AudioEncodingFieldDef {
  field: FieldName;
  //
  scale?: ScaleDomain & ScaleRange;
  // timeUnit?: string;
  aggregate?: NonArgAggregateOp | typeof NONE;
  sort?: Sort<any>;
  // bin: undefined;
}

export type EncodingFieldDef = VisualEncodingFieldDef | AudioEncodingFieldDef;

export interface AudioTraversalFieldDef {
  field: FieldName;
  //
  scale?: ScaleDomain & ScaleRange;
  timeUnit?: string;
  bin?: boolean;
  // aggregate: undefined;
}

export type VisualEncoding = {
  [prop in VisualPropName]?: VisualEncodingFieldDef;
};

export type VisualUnitSpec = {
  name: string;
  mark: Mark;
  encoding: VisualEncoding;
};

export type AudioEncoding = {
  [prop in AudioPropName]?: AudioEncodingFieldDef;
};

export type AudioTraversal = AudioTraversalFieldDef[];

export type AudioUnitSpec = {
  name: string;
  encoding: AudioEncoding;
  traversal: AudioTraversal;
};

export type ViewComposition = 'layer' | 'concat';

export interface VisualSpec {
  units: VisualUnitSpec[];
  composition: ViewComposition;
}

export interface AudioSpec {
  units: AudioUnitSpec[];
  composition: ViewComposition;
}

export interface UmweltSpec {
  data: UmweltDataSource;
  fields: FieldDef[];
  key: FieldName[];
  visual: VisualSpec | false;
  audio: AudioSpec | false;
  // text: OlliNode | OlliNode[] | boolean;
}
