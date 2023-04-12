import { OlliDataset } from "olli";
import { Configuration, OpenAIApi } from "openai";

const secrets = require('../secrets/openai.json');
console.log(secrets);
const configuration = new Configuration(secrets);

const openai = new OpenAIApi(configuration);

export async function describe(selection: OlliDataset) {
  const stringData = JSON.stringify(selection);

  const cache = localStorage.getItem(stringData);
  if (cache) {
    return cache;
  }
  else {
    const response = await openai.createCompletion({
      model: "gpt-3.5-turbo",
      prompt: `describe patterns or trends in this data. return a concise description less than 50 words: ${stringData}`,
      temperature: 0,
    });
    const description = response.data.choices[0].text.trim();

    localStorage.setItem(stringData, description);
    return description;
  }

}