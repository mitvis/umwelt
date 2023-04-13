import { OlliDataset } from "olli";
import { Configuration, OpenAIApi } from "openai";
import { backOff } from "exponential-backoff";
import { LogicalComposition } from "vega-lite/src/logical";
import { FieldPredicate } from "vega-lite/src/predicate";

const secrets = require('../secrets/openai.json');
console.log(secrets);
const configuration = new Configuration(secrets);

const openai = new OpenAIApi(configuration);

// const FLAG = true;
const FLAG = false;

export async function describe(selection: OlliDataset): Promise<string> {
  const stringData = JSON.stringify(selection);

  const storageKey = String(hashCode(stringData));

  const cache = localStorage.getItem(storageKey);
  if (cache) {
    console.log('cache hit', cache);
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
          {role: "user", content: `describe trends or patterns in the data: ${stringData}. answer concisely in 50 words or less. round all numbers to 2 decimal places.`}
        ],
      })
    });
    const description = response.data.choices[0].message.content;
    console.log('api call returned');

    localStorage.setItem(storageKey, description);
    console.log('cache miss', description);
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