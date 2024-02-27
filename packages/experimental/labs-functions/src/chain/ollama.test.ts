import { describe, test } from '@dxos/test';
import { createChainResources, createOllamaChainResources } from './vendors';
import { HumanMessage, SystemMessage } from 'langchain/schema';
import * as S from '@effect/schema/Schema';
import * as JSONSchema from '@effect/schema/JSONSchema';
import { inspect } from 'util';

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const extractJsonFromText = (text: string): Result<string> => {
  const startingCharMatch = /[\[\{]/.exec(text);
  if (!startingCharMatch) return { ok: false, error: "I couldn't see any JSON in the output" };

  const startingIndex = startingCharMatch.index;
  const startingChar = text[startingIndex];
  const endingChar = startingChar === '{' ? '}' : ']';
  let index = startingIndex + 1;
  let openBrackets = 1;
  while (openBrackets > 0 && index < text.length) {
    if (text[index] === startingChar) openBrackets++;
    if (text[index] === endingChar) openBrackets--;
    index++;
  }
  if (openBrackets > 0) return { ok: false, error: "I couldn't find the end of the JSON" };
  return { ok: true, data: text.substring(startingIndex, index) };
};

const parseLlmResponse = <T>(schema: S.Schema<T>, response: string): Result<T> => {
  const json = extractJsonFromText(response);
  if (!json.ok) return { ok: false, error: json.error };

  let parsed;
  try {
    parsed = JSON.parse(json.data);
  } catch (err: any) {
    return { ok: false, error: `I couldn't parse the JSON: ${err.message}` };
  }
  try {
    const value = S.decodeSync(schema)(parsed);
    return { ok: true, data: value };
  } catch (err: any) {
    return {
      ok: false,
      error: `Your response does not adhere to the schema: ${err.message.split('\n').slice(-4).join('\n')}`,
    };
  }
};

describe('ollama', () => {
  test('basic', async () => {
    const cr = await createChainResources('ollama');

    const { content } = await cr.model.invoke([new HumanMessage('What is the weather in San Francisco?')]);

    console.log(content);
  });

  test
    .only('schema', async () => {
      const Employee = S.struct({
        name: S.string,
        position: S.string,
      });

      const Organization = S.struct({
        name: S.string,
        description: S.string,
        // ceo: Employee,
        departments: S.array(S.struct({ name: S.string, description: S.string, departmentHead: Employee })),
        // revenue: S.number.pipe(S.lessThan(100)),
      });

      const cr = await createChainResources('ollama');

      type ChatMessage = {
        role: string;
        content: string;
      };

      const history: ChatMessage[] = [];

      const push = (prompts: ChatMessage[]) => {
        prompts.forEach((p) => {
          console.log(`${p.role} ${p.content}\n`);
        });
        history.push(...prompts);
      };

      const execute = async () => {
        const res = await fetch(`http://127.0.0.1:11434/v1/chat/completions`, {
          method: 'POST',
          body: JSON.stringify({
            model: 'llama2',
            response_format: { type: 'json_object' },
            messages: history,
          }),
          headers: {
            'Content-Type': 'application/json',
          },
        });
        const { choices } = await res.json();
        const content = choices[0].message.content;

        console.log(`${content}\n`);
        history.push({ role: 'assistant', content });
        return content;
      };

      const schema = S.struct({ items: S.array(Organization) });

      push([
        {
          role: 'system',
          content: `SYSTEM: As a genius expert, your task is to understand the content and provide
        the parsed objects in JSON that match the following json_schema: ${JSON.stringify(JSONSchema.make(schema))}\.`,
        },
      ]);

      push([{ role: 'user', content: 'List 2 biggest companies in the world.' }]);

      let resultData: any;
      while (true) {
        console.log('Executing...');
        const begin = performance.now();
        const llmReply = await execute();
        console.log('Executed in', performance.now() - begin, 'ms');
        const parsed = parseLlmResponse(schema, llmReply);
        if (parsed.ok) {
          resultData = parsed.data;
          break;
        } else {
          push([{ role: 'system', content: parsed.error }]);
        }
      }

      console.log(inspect(resultData, false, null, true));
    })
    .timeout(1_000_000);
});
