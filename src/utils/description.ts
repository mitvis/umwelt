import { OlliDataset } from "olli";
import { Configuration, OpenAIApi } from "openai";
import { backOff } from "exponential-backoff";

const secrets = require('../secrets/openai.json');
console.log(secrets);
const configuration = new Configuration(secrets);

const openai = new OpenAIApi(configuration);

export async function describe(selection: OlliDataset): Promise<string> {
  const stringData = JSON.stringify(selection);

  const cache = localStorage.getItem(stringData);
  if (cache) {
    console.log('cache hit', stringData, cache);
    return cache;
  }
  else {
    console.log('attempting api call');
    const response = await backOff(() => {
      return openai.createCompletion({
        model: "text-ada-001",
        prompt: `describe patterns or trends in this data. return a concise description less than 50 words: ${stringData}`,
        max_tokens: 75,
        temperature: 0,
      })
    })
    console.log('api call returned');

    const description = response.data.choices[0].text.trim();

    localStorage.setItem(stringData, description);
    console.log('cache miss', stringData, description);
    return description;
  }
}