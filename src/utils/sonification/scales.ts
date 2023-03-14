import { AudioPropName } from "../../grammar/Types";

export const volume_range: [number, number] = [-60, 0]; // in decibels
export const pitch_range: [number, number] = [36, 76]; // in MIDI
export const duration_range: [number, number] = [.25, 1]; // in seconds

export function scale(value: number, domainExtent: [number, number], rangeExtent: [number, number]) {
  const fraction = (value - domainExtent[0]) / (domainExtent[1] - domainExtent[0]);
  const scaled = fraction * (rangeExtent[1] - rangeExtent[0]) + rangeExtent[0];
  return scaled;
}

export function getRange(prop: AudioPropName) {
  switch (prop) {
    case 'pitch': return pitch_range;
    case 'volume': return volume_range;
    case 'duration': return duration_range;
  }
}