import { describe, test } from '@dxos/test';
import { createChainResources, createOllamaChainResources } from './vendors';
import { HumanMessage, SystemMessage } from 'langchain/schema';
import * as S from '@effect/schema/Schema';
import * as JSONSchema from '@effect/schema/JSONSchema';
import { inspect } from 'util';
import { cons } from 'effect/List';

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
  test.skip('basic', async () => {
    const cr = await createChainResources('ollama');

    const { content } = await cr.model.invoke([new HumanMessage('What is the weather in San Francisco?')]);

    console.log(content);
  });

  test.only('basic mistral', async () => {
    console.log(1);
    const res = await fetch(`http://127.0.0.1:11434/v1/chat/completions`, {
      method: 'POST',
      body: JSON.stringify({
        model: 'mistral',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: `Hello`,
          },
        ],
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const xxx = await res.json();
    console.log(xxx);
  });

  test('schema', async () => {
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
      const xxx = await res.json();
      console.log(xxx);
      const { choices } = xxx;
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
  }).timeout(1_000_000);

  describe.skip('pipeline', async () => {
    const P = null as any;

    const E = {
      ref: <T>(x: T) => x,
    };

    test('translate', () => {
      const Translation = S.struct({
        translatedText: S.string,
      });

      P.onCommand('/translate', ['language', 'text'])
        .prompt(({ command }: any) => `Translate the following text to ${command.language}; text: ${command.text} `)
        .outputOne(Translation)
        .runLLM()
        .insertChatReply(); // Pipeline<Translation>
    });

    test('chess hint', () => {
      const ChessGame = S.struct({
        pgn: S.string,
      });

      const ChessMove = S.struct({
        move: S.string.pipe(S.description('The move in standard algebraic notation')),
        comment: S.string.pipe(S.description('An optional comment about the move')),
      });

      // TODO(dmaretskyi): Teach LLM to use tools.
      P.onCommand('/hint')
        .onTimer(10_000)
        .requireAttention(ChessGame)
        .promptLLM(
          ({ command, attention }: any) => `
            You are a machine that is an expert chess player.
            
            The move history of the current game is: ${attention.pgn}
            
            Suggest the next move and very briefly explain your strategy in a couple of sentences.
          `,
        )
        .outputOne(ChessMove)
        .insertSuggestion(); // Pipeline<ChessMove>
    });

    test('explain', () => {
      const MarkdownDocument = S.struct({
        content: S.string,
      });

      const Cursor = S.struct({
        quotedText: S.string,
        begin: S.string,
        end: S.string,
      }).pipe(S.description('Automerge cursor'));

      const Quote = S.transform(
        S.string.pipe(S.description('Quoted text as it appears in the document')),
        Cursor,
        (quote) => null as any, // todo: quote to cursor,
        (cursor) => null as any, // todo: cursor to quote,
      );

      const Explanation = S.struct({
        quote: Quote,
        quotedDocument: E.ref(MarkdownDocument).pipe(P.llmIgnore),
        explanation: S.string.pipe(S.description('A couple sentences explaining the quote')),
      });

      P.onTimer(10_000)
        .requireAttention(MarkdownDocument)
        .promptLLM(
          ({ attention }: any) => `
            You are a machine that is an expert in the domain of the document.
            
            Pleas find the terms that need explanation in the document and provide a brief explanation.

            The document: ${attention.content}
          `,
        )
        .outputMultiple(Explanation)
        .dedupOn((explanation: S.Schema.To<typeof Explanation>) => [
          explanation.quote.quotedText,
          explanation.quotedDocument,
        ])
        .insertComments();
    });

    test('stockfish', () => {
      const ChessGame = S.struct({
        pgn: S.string,
      });

      const StockfishEval = S.struct({
        evaluation: S.number.pipe(S.description('The evaluation of the position after the best move')),
        moves: S.array(
          S.struct({
            move: S.string,
            evaluation: S.number,
          }).pipe(S.description('The best moves and their evaluations')),
        ),
      });

      const StockfishTool = P.defineTool({
        input: ChessGame,
        output: StockfishEval,
        description: 'A tool that uses Stockfish to evaluate the position and suggest best moves.',
        run: async (game: S.Schema.To<typeof ChessGame>): Promise<S.Schema.To<typeof StockfishEval>> => null as any, // todo
      });

      const ChessMove = S.struct({
        move: S.string.pipe(S.description('The move in standard algebraic notation')),
        comment: S.string.pipe(S.description('An optional comment about the move')),
      });

      P.onCommand('/hint')
        .onTimer(10_000)
        .requireAttention(ChessGame)
        .runTool(StockfishTool) // Pipeline<StockfishEval>
        .mapResult(
          (evaluation: S.Schema.To<typeof StockfishEval>): S.Schema.To<typeof ChessMove> => ({
            move: evaluation.moves[0].move,
            comment: 'Best move according to Stockfish.',
          }),
        )
        .insertSuggestion(); // Pipeline<ChessMove>
    });
  });
});

type Signal = {};
