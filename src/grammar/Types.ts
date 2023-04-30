import {Type} from 'vega-lite/src/type';
import {UrlData, InlineData} from 'vega-lite/src/data';
import {Mark} from 'vega-lite/src/mark';
import { NonArgAggregateOp } from 'vega-lite/src/aggregate';
import { OlliDataset, OlliValue } from 'olli';
import { FieldPredicate } from 'vega-lite/src/predicate';
import { LogicalAnd, LogicalComposition } from 'vega-lite/src/logical';
import { Spec } from 'vega';
import { TopLevelUnitSpec } from 'vega-lite/src/spec/unit';

export type VlSpec = TopLevelUnitSpec<any>
export type VgSpec = Spec;

type ScaleDomain = {
  domain?: OlliValue[],
  zero?: boolean,
  nice?: boolean | number
} //  | "type"
type ScaleRange = {
  range?: number[] | string[]
} //  | "reverse"

export type MeasureType = Exclude<Type, "geojson">;
type UmweltDataSource = UrlData | InlineData
type ElaboratedUmweltDataSource = { values: OlliDataset }

export type VisualPropName = "x" | "y" | "color" | "opacity" | "shape" | "detail" | "facet" | "row" | "column";
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

export interface EncodingFieldDef extends Omit<FieldDef, 'name'> {
  field: FieldName,
  scale?: ScaleDomain & ScaleRange,
  aggregate?: NonArgAggregateOp,
  bin?: boolean
}

export interface ElaboratedEncodingFieldDef extends Omit<ElaboratedFieldDef, 'name'> {
  field: FieldName,
  scale: ScaleDomain & ScaleRange,
  aggregate?: NonArgAggregateOp,
  bin?: boolean
}

export interface AudioEncodingFieldDef extends EncodingFieldDef {
  bin: undefined;
}

export interface AudioTraversalFieldDef extends EncodingFieldDef {
  aggregate: undefined;
}

export interface ElaboratedAudioEncodingFieldDef extends ElaboratedEncodingFieldDef {
  bin: undefined;
}

export interface ElaboratedAudioTraversalFieldDef extends ElaboratedEncodingFieldDef {
  aggregate: undefined;
}

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
  [prop in AudioPropName]?: ElaboratedAudioEncodingFieldDef
}

export type AudioTraversal = (FieldName | AudioTraversalFieldDef) | (FieldName | AudioTraversalFieldDef)[];

export type ElaboratedAudioTraversal = ElaboratedAudioTraversalFieldDef[];

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

export interface ElaboratedPredNode {
  fullPredicate: LogicalAnd<FieldPredicate>
  predicate: FieldPredicate
  children: ElaboratedGroupNode[] | ElaboratedLeafNode[]
}

export interface ElaboratedGroupNode {
  fullPredicate: LogicalAnd<FieldPredicate>
  field?: string
  children: ElaboratedPredNode[]
}

export function isPredNode(node: ElaboratedTextNode): node is ElaboratedPredNode {
  return (node as any).predicate;
}

export function isGroupNode(node: ElaboratedTextNode): node is ElaboratedGroupNode {
  return Boolean((node as ElaboratedGroupNode).field) || ((node as any).children && !(node as any).predicate);
}

export function isLeafNode(node: ElaboratedTextNode): node is ElaboratedLeafNode {
  return !(node as any).children;
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
