import { OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { LanceDB } from "@langchain/community/vectorstores/lancedb";
import { connect } from "@lancedb/lancedb";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

// ESモジュールでの __dirname の代用
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  console.log("🚀 学習を開始します...");

  // リポジトリルート（agentフォルダの2つ上）を指定
  const rootDir = path.resolve(__dirname, "../../");
  console.log(`Target Directory: ${rootDir}`);

  // 1. GoコードとMarkdownドキュメントを読み込む
  const loader = new DirectoryLoader(rootDir, {
    ".md": (path) => new TextLoader(path),
    ".go": (path) => new TextLoader(path),
  });

  const rawDocs = await loader.load();
  
  // agentディレクトリ自身や隠しファイルを除外するフィルタ
  const docs = rawDocs.filter(doc => 
    !doc.metadata.source.includes("/agent/") && 
    !doc.metadata.source.includes("/.git/") &&
    !doc.metadata.source.includes("/node_modules/")
  );

  console.log(`📄 読み込みファイル数: ${docs.length}`);
  docs.forEach(d => console.log(` - ${path.basename(d.metadata.source)}`));

  // 2. 分割
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  const splitDocs = await splitter.splitDocuments(docs);

  // 3. ベクトルDB保存 (agent/data/lancedb に保存)
  const dbPath = path.join(__dirname, "../data/lancedb");
  
  // ディレクトリ作成
  if (!fs.existsSync(path.dirname(dbPath))) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  console.log(`💾 DB作成中: ${dbPath}`);
  const db = await connect(dbPath);
  
  const table = await db.createTable("vectors", 
    [{ vector: Array(1536), text: "sample", source: "sample" }], 
    { mode: "overwrite" }
  );
  
  await LanceDB.fromDocuments(
    splitDocs,
    new OpenAIEmbeddings(),
    { table }
  );

  console.log("✅ 学習完了！知識が更新されました。");
}

run();
