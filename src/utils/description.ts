import { OlliDataset } from "olli";
import { Configuration, OpenAIApi } from "openai";
import { backOff } from "exponential-backoff";
import { LogicalComposition } from "vega-lite/src/logical";
import { FieldPredicate } from "vega-lite/src/predicate";
import { isDate } from "vega";

const secrets = process.env.NODE_ENV === 'development' ? require('../secrets/openai.json') : {};
const configuration = new Configuration(secrets);

const openai = new OpenAIApi(configuration);

// const FLAG = true;
const FLAG = false;

export async function describe(selection: OlliDataset): Promise<string> {
  let csvData: string = '';
  csvData += Object.keys(selection[0]).join() + '\n';
  csvData += selection.map(d => Object.values(d).map(v => isDate(v) ? v.toLocaleDateString() : v.toString()).join()).join('\n');

  const storageKey = String(hashCode(csvData));

  const cache = localStorage.getItem(storageKey);
  if (cache) {
    console.log('cache hit');
    return cache;
  }
  else if (FLAG) {
    console.log('attempting api call');
    const response = await backOff(() => {
      return openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: [
          // {role: "system", content: "You help write text descriptions of patterns or trends in data. Do not explain what the query matches. Do not report errors. Answer concisely in 50 words or less."},
          // {role: "user", content: `the full dataset is ${stringData}. describe the data matching this query: ${stringPred}`}
          {role: "user", content: prompt(csvData)}
        ],
      })
    });
    const description = response.data.choices[0].message.content;
    console.log('api call returned');

    localStorage.setItem(storageKey, description);
    return description;
  }
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0, len = str.length; i < len; i++) {
      let chr = str.charCodeAt(i);
      hash = (hash << 5) - hash + chr;
      hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

function prompt(stringData: string): string {
//   const prompt =
// `You are an expert chart captioner. You will be given a JSON data structure that is a list of data points from a visualization.
// Please describe trends or patterns in the data.

// ### Response Format ###

// Respond with the following format:

// # Thought #
// You should always think about what to do. Work this out in a step by step way to be sure we produce the right output.

// # Output #
// A description of the trends or patterns in the data. Answer concisely in 50 words or less. Round all numbers to 2 decimal places.

// Begin!

// ### Data ###

// ${stringData}`
const prompt = `Here's an example description.

Overall, women have a slightly higher life expectancy than men. Women live around 5 to 10 years longer than men. The low income countries are more scattered than the high income countries. There is a visible gap between high and low income countries, indicated by the Income-Age Divide line. People living in low-income countries tend to have a lower life expectancy than the people living in high-income countries, likely due to many societal factors, including access to healthcare, food, other resources, and overall quality of life. People who live in lower income countries are more likely to experience deprivation and poverty, which can cause related health problems.

Please generate a description in this style for the following data:

${stringData}`

return prompt;
}