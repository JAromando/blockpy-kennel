import {Configuration, OpenAIApi} from "openai";

const OPENAI_API_KEY = "";

const openaiConfig = new Configuration({ apiKey: OPENAI_API_KEY });
const openai = new OpenAIApi(openaiConfig);

/**
 * Sends a prompt to an OpenAI model and retrieves the response.
 * @param prompt The prompt to generate a response from.
 * @param model An OpenAI model. See https://platform.openai.com/docs/models for which models are valid.
 * @param maxTokens The maximum number of tokens in the response. One token is roughly one word.
 * @param temperature The randomness of the response, between 0 and 2, with 0 being mostly deterministic and 2 being mostly random.
 * @returns {Promise<string>}
 */
export function runGPTPrompt(prompt, model = "gpt-3.5-turbo", maxTokens = 500, temperature = 0) {
    // Uncomment this and comment out the rest of the function if you don't want to waste credits
    //return new Promise((resolve) => resolve("Test response! Doesn't use your precious \"credits\" ;)"));

    if (OPENAI_API_KEY === "") {
        console.error("No OpenAI key set in openai.js!!");
    }
    return openai.createChatCompletion({
        model: model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: maxTokens,
        temperature: temperature,
    }).then(completion => completion.data.choices[0].message.content);
}
