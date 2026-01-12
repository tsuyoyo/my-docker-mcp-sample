import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ChatOllama } from "@langchain/ollama";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/hf_transformers";
import { LanceDB } from "@langchain/community/vectorstores/lancedb";
import { connect } from "@lancedb/lancedb";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence, RunnablePassthrough } from "@langchain/core/runnables";
import { Document } from "@langchain/core/documents";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- 1. RAG Setup (Modern Approach) ---

// DB接続
const dbPath = path.join(__dirname, "../data/lancedb");
const db = await connect(dbPath);
const table = await db.openTable("vectors");

// ローカルモデルを使用 (Ingest側と合わせる必須あり)
const embeddings = new HuggingFaceTransformersEmbeddings({
  modelName: "Xenova/all-MiniLM-L6-v2",
});

const vectorStore = new LanceDB(embeddings, { table });

// Retriever: 検索結果数を少し多めに取得 (Context Windowが許す限り情報を入れたい)
const retriever = vectorStore.asRetriever(6);

// Model: ローカルLLM (Ollama) を使用
const model = new ChatOllama({
  baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434", // Dockerからは http://host.docker.internal:11434 を指定
  model: "gemma3", 
  temperature: 0,
});

// Prompt: Roleを明確に分けたチャットプロンプトテンプレート
const prompt = ChatPromptTemplate.fromMessages([
  ["system", `あなたはGo言語ライブラリ "weatherlib" の専任テクニカルサポートエージェントです。
提供されたコンテキスト（ソースコードやドキュメント）のみに基づいて、正確に回答してください。

以下のガイドラインを厳守してください：
1. **言語制限**: コード例は **必ず Go言語 (Golang)** で記述してください。PythonやJavaScriptなどは禁止です。
2. **正確性**: 提供されたコードの関数名、引数、戻り値を正確に使用してください。存在しない関数を捏造しないでください。
3. **完全性**: コードを求められた場合は、\`package main\` から始まる、コンパイル可能な完全なコードブロックを提供してください。
4. **バージョン対応**: "v2.0" などの仕様変更に関する記述がある場合は、最新の仕様に従ってください。
5. **出典の明示**: 回答の根拠となるファイル名（例: README.md, weather.go）がコンテキストに含まれている場合、可能な限り言及してください。
6. **正直さ**: コンテキストに情報がない場合は、「提供された情報内には見当たりません」と正直に答えてください。
`],
  ["human", `以下のコンテキスト情報を参照して、質問に答えてください。

【コンテキスト】
{context}

【質問】
{question}`],
]);

// Helper: ドキュメントを文字列化する際に、ファイル名(source)を含める
const formatDocumentsWithSource = (docs: Document[]): string => {
  return docs
    .map((doc) => {
      const source = doc.metadata.source || "unknown";
      const content = doc.pageContent;
      return `--- [File: ${source}] ---\n${content}\n`;
    })
    .join("\n");
};

// LCEL Chain: Retrieval QA Chain
const ragChain = RunnableSequence.from([
  {
    context: retriever.pipe(formatDocumentsWithSource),
    question: new RunnablePassthrough(),
  },
  prompt,
  model,
  new StringOutputParser(),
]);

// --- 2. MCP Server Setup ---

const server = new McpServer({
  name: "weatherlib-agent",
  version: "1.0.0",
});

server.tool(
  "ask_weatherlib",
  { 
    question: z.string().describe("weatherlibライブラリの実装方法、仕様、トラブルシューティングに関する質問") 
  },
  async ({ question }) => {
    // [Server Log] ターミナルに受信ログを表示 (stderrに出すことで通信を邪魔しない)
    console.error(`\n🔍 [Request Received] Question: "${question}"`);
    console.error("   Thinking...");

    try {
      const answer = await ragChain.invoke(question);
      
      console.error("✅ [Response Ready]");
      
      // [Client Response] 挨拶を付与して返却
      const formattedAnswer = `🤖 **WeatherLib Agent**\n\n${answer}`;

      return {
        content: [{ type: "text", text: formattedAnswer }],
      };
    } catch (error) {
      console.error("❌ [Error]", error);
      return {
        content: [{ type: "text", text: "申し訳ありません。回答の生成中にエラーが発生しました。" }],
        isError: true,
      };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
