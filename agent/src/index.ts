import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { LanceDB } from "@langchain/community/vectorstores/lancedb";
import { connect } from "@lancedb/lancedb";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence, RunnablePassthrough } from "@langchain/core/runnables";
import { formatDocumentsAsString } from "langchain/util/document";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- RAG Setup ---
const dbPath = path.join(__dirname, "../data/lancedb");
const db = await connect(dbPath);
const table = await db.openTable("vectors");
const vectorStore = new LanceDB(new OpenAIEmbeddings(), { table });

const retriever = vectorStore.asRetriever(4);
const model = new ChatOpenAI({ modelName: "gpt-4o", temperature: 0 });

const prompt = PromptTemplate.fromTemplate(`
あなたはGoライブラリ "weatherlib" の専任サポートエンジニアです。
以下の「ソースコード」および「ドキュメント」に基づいて、ユーザーの質問に回答してください。

特に以下の点に注意してください：
- コードのバージョンや仕様変更（v2.0など）に敏感であること。
- 型定義や関数シグネチャに基づいた正確なGo言語のサンプルコードを提示すること。
- 情報がない場合は正直にそう伝えること。

【コンテキスト】
{context}

【質問】
{question}

回答:
`);

const ragChain = RunnableSequence.from([
  {
    context: retriever.pipe(formatDocumentsAsString),
    question: new RunnablePassthrough(),
  },
  prompt,
  model,
  new StringOutputParser(),
]);

// --- MCP Server Setup ---
const server = new McpServer({
  name: "weatherlib-agent",
  version: "1.0.0",
});

server.tool(
  "ask_weatherlib",
  { question: z.string().describe("weatherlibの使い方や仕様に関する質問") },
  async ({ question }) => {
    const answer = await ragChain.invoke(question);
    return {
      content: [{ type: "text", text: answer }],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
