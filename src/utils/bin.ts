// this is from olli/Structure/index.ts
export function axisValuesToIntervals(values: string[] | number[]): ([number, number])[] {

  const ensureAxisValuesNumeric = (values: any[]): {values: number[], isDate?: boolean} => {
      const isStringArr = values.every(v => typeof v === 'string' || v instanceof String);
      if (isStringArr) {
          return {
              values: values.map(s => Number(s.replaceAll(',', '')))
          };
      }
      const isDateArr = values.every(v => v instanceof Date);
      if (isDateArr) {
          return {
              values: values.map(d => d.getTime()),
              isDate: true
          };
      }
      return {
          values
      };
  }

  const getEncodingValueIncrements = (incrementArray: [number, number][], currentValue: number, index: number, array: number[]): [number, number][] => {
      let bounds: [number, number]
      let reducedIndex = index - 1;
      if (index === 0 && currentValue === 0) {
          return incrementArray
      } else if (reducedIndex === -1 && currentValue !== 0) {
          const incrementDifference: number = (array[index + 1] as number) - currentValue
          bounds = [(currentValue - incrementDifference), currentValue];
      } else if (index === array.length - 1) {
          const incrementDifference: number = currentValue - (array[index - 1] as number)
          const finalIncrement = currentValue + incrementDifference;
          incrementArray.push([array[reducedIndex] as number, currentValue])
          bounds = [currentValue, finalIncrement];

      } else {
          bounds = [array[reducedIndex] as number, array[reducedIndex + 1] as number];
      }
      incrementArray.push([bounds[0], bounds[1]])
      return incrementArray
  }

  const res = ensureAxisValuesNumeric(values);
  const increments = res.values.reduce(getEncodingValueIncrements, []);
  // if (res.isDate) {
  //     return increments.map(value => [new Date(value[0]), new Date(value[1])])
  // }
  return increments;
}