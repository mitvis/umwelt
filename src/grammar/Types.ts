import {Type} from 'vega-lite/src/type';
import {UrlData, InlineData} from 'vega-lite/src/data';
import {Mark} from 'vega-lite/src/mark';
import { Scale } from 'vega-lite/src/scale';
import { NonArgAggregateOp } from 'vega-lite/src/aggregate';
import { OlliDataset, OlliValue } from 'olli';
import { FieldPredicate } from 'vega-lite/src/predicate';
import { LogicalAnd, LogicalComposition } from 'vega-lite/src/logical';
import { Spec } from 'vega';
import { TopLevelUnitSpec } from 'vega-lite/src/spec/unit';

export type VlSpec = TopLevelUnitSpec<any>
export type VgSpec = Spec;

type ScaleDomain = {domain: OlliValue[]} & Pick<Scale, "zero" | "nice"> //  | "type"
type ScaleRange = Pick<Scale, "range"> //  | "reverse"

export type ScaleFunction = (value: any) => any;

export type MeasureType = Exclude<Type, "geojson">;
type UmweltDataSource = UrlData | InlineData
type ElaboratedUmweltDataSource = { values: OlliDataset }

export type VisualPropName = "x" | "y" | "color" | "shape" | "detail" | "facet" | "row" | "column";
export type AudioPropName = "pitch" | "duration" | "volume";
export type EncodingPropName = VisualPropName | AudioPropName;

export type AudioAggregateOp = "count" | "mean" // | "median" | "min" | "max"; //

type FieldName = string;

export interface ElaboratedFieldDef {
  name: FieldName,
  type: MeasureType,
  scale?: ScaleDomain
}

export interface FieldDef {
  name: FieldName
  type?: MeasureType,
  scale?: ScaleDomain
}

export interface EncodingFieldDef {
  field: FieldName,
  scale?: ScaleDomain & ScaleRange,
  aggregate?: NonArgAggregateOp,
  bin?: boolean
}

export interface AudioEncodingFieldDef extends EncodingFieldDef {
  bin: undefined;
}

export type AudioTraversalFieldDef = Omit<EncodingFieldDef, 'aggregate'>;

export type VisualEncoding = {
  [prop in VisualPropName]?: FieldName | EncodingFieldDef
}

export type ElaboratedVisualEncoding = {
  [prop in VisualPropName]?: EncodingFieldDef
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
  [prop in AudioPropName]?: FieldName | AudioEncodingFieldDef
}

export type ElaboratedAudioEncoding = {
  [prop in AudioPropName]?: AudioEncodingFieldDef
}

export type AudioTraversal = {
  interaction?: (FieldName | AudioTraversalFieldDef) | (FieldName | AudioTraversalFieldDef)[]
  sequence?: (FieldName | AudioTraversalFieldDef) | (FieldName | AudioTraversalFieldDef)[]
}

export type ElaboratedAudioTraversal = {
  interaction: AudioTraversalFieldDef[]
  sequence: AudioTraversalFieldDef[]
}

export type AudioSpec = {
  encoding?: AudioEncoding,
  traversal?: AudioTraversal | "selection"
}

export type ElaboratedAudioSpec = {
  encoding: ElaboratedAudioEncoding,
  traversal: ElaboratedAudioTraversal | "selection"
}

export interface TextNode {
  field?: string,
  predicate?: FieldPredicate,
  children?: TextNode[]
}

export interface ElaboratedLeafNode {
  fullPredicate: LogicalAnd<FieldPredicate>
}

export interface ElaboratedPredNode extends ElaboratedLeafNode {
  predicate: FieldPredicate
  children: ElaboratedGroupNode[] | ElaboratedLeafNode[]
}

export interface ElaboratedGroupNode extends ElaboratedLeafNode {
  field?: string
  children: ElaboratedPredNode[]
}

export type ElaboratedTextNode = ElaboratedPredNode | ElaboratedGroupNode | ElaboratedLeafNode;

export interface SelectionSpec {
  predicate: LogicalComposition<FieldPredicate>;
}

export interface UmweltSpec {
  data: UmweltDataSource
  selection?: SelectionSpec
  fields: FieldDef[]
  visual?: VisualSpec | boolean
  audio?: AudioSpec | AudioSpec[] | boolean
  text?: TextNode | TextNode[] | boolean
}

export interface ElaboratedUmweltSpec {
  data: ElaboratedUmweltDataSource
  selection?: SelectionSpec
  fields: ElaboratedFieldDef[]
  visual: ElaboratedVisualSpec | false
  audio: ElaboratedAudioSpec[] | false
  text: ElaboratedTextNode[] | false
}
