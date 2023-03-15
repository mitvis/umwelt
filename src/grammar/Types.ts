import {Type} from 'vega-lite/src/type';
import {DataSource, NamedData} from 'vega-lite/src/data';
import {Mark} from 'vega-lite/src/mark';
import { Scale } from 'vega-lite/src/scale';
import { FieldDefBase } from 'vega-lite/src/channeldef';
import { OlliDataset } from 'olli';
import { FieldPredicate } from 'vega-lite/src/predicate';
import { LogicalComposition } from 'vega-lite/src/logical';
import { Spec } from 'vega';
import { TopLevelUnitSpec } from 'vega-lite/src/spec/unit';

export type VlSpec = TopLevelUnitSpec<any>
export type VgSpec = Spec;

type ScaleDomain = Pick<Scale, "domain" | "zero" | "nice">

export type MeasureType = Exclude<Type, "geojson">;
type UmweltDataSource = Exclude<DataSource, NamedData>
type ElaboratedUmweltDataSource = { values: OlliDataset }

type VisualPropName = "x" | "y" | "color" | "shape";
export type AudioPropName = "pitch" | "duration" | "volume";

export type AudioAggregateOp = "count" | "mean" // | "median" | "min" | "max"; //

type FieldName = string;

export interface ElaboratedFieldDef {
  name: string,
  type: MeasureType,
  scale: ScaleDomain
}

export interface FieldDef {
  name: string
  type?: MeasureType,
  scale?: ScaleDomain
}

export type VisualEncoding = {
  [prop in VisualPropName]: FieldName | FieldDefBase<FieldName>
}

export type ElaboratedVisualEncoding = {
  [prop in VisualPropName]: FieldDefBase<FieldName>
}

export type VisualSpec = {
  mark?: Mark
  encoding?: VisualEncoding
}

export type ElaboratedVisualSpec = {
  mark: Mark
  encoding: ElaboratedVisualEncoding
}

export type AudioEncoding = {
  [prop in AudioPropName]: FieldName | FieldDefBase<FieldName>
}

export type ElaboratedAudioEncoding = {
  [prop in AudioPropName]: FieldDefBase<FieldName>
}

export type AudioTraversal = {
  [field in FieldName]: "interaction" | "sequence"
}

export type AudioSpec = {
  encoding?: AudioEncoding,
  traversal?: AudioTraversal
}

export type ElaboratedAudioSpec = {
  encoding: ElaboratedAudioEncoding,
  traversal: AudioTraversal | "selection"
}

export interface SelectionSpec {
  predicate: LogicalComposition<FieldPredicate>;
}

export interface UmweltSpec {
  data: UmweltDataSource
  selection?: SelectionSpec
  fields: FieldDef[]
  visual?: VisualSpec | boolean
  audio?: AudioSpec | AudioSpec[] | boolean
  text?: boolean
}

export interface ElaboratedUmweltSpec {
  data: ElaboratedUmweltDataSource
  selection?: SelectionSpec
  fields: ElaboratedFieldDef[]
  visual: ElaboratedVisualSpec | false
  audio: ElaboratedAudioSpec[] | false
  text: boolean
}
