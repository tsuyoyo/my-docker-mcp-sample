import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/hf_transformers";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { connect } from "@lancedb/lancedb";
import { LanceDB } from "@langchain/community/vectorstores/lancedb";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { Document } from "@langchain/core/documents";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  console.log("🚀 学習プロセスを開始します (Modern LangChain Practice)...");

  // リポジトリルートの特定
  const rootDir = path.resolve(__dirname, "../../");
  console.log(`📂 Target Directory: ${rootDir}`);

  // 1. ファイルの読み込み
  const loader = new DirectoryLoader(rootDir, {
    ".md": (path) => new TextLoader(path),
    ".go": (path) => new TextLoader(path),
  });

  const rawDocs = await loader.load();

  // フィルタリング: agentディレクトリ、.git、node_modules、隠しファイルを除外
  const docs = rawDocs.filter((doc) => {
    const relPath = path.relative(rootDir, doc.metadata.source);
    return (
      !relPath.startsWith("agent") &&
      !relPath.startsWith(".git") &&
      !relPath.includes("node_modules") &&
      !path.basename(doc.metadata.source).startsWith(".")
    );
  });

  // メタデータの相対パス化 (LLMが理解しやすいように)
  docs.forEach((doc) => {
    doc.metadata.source = path.relative(rootDir, doc.metadata.source);
  });

  console.log(`📄 対象ファイル数: ${docs.length}`);

  // 2. 言語別の高度な分割 (Splitting)
  const goDocs = docs.filter((d) => d.metadata.source.endsWith(".go"));
  const mdDocs = docs.filter((d) => d.metadata.source.endsWith(".md"));
  const otherDocs = docs.filter(
    (d) => !d.metadata.source.endsWith(".go") && !d.metadata.source.endsWith(".md")
  );

  let splitDocs: Document[] = [];

  // Goファイル: 言語構造を意識した分割
  if (goDocs.length > 0) {
    const goSplitter = RecursiveCharacterTextSplitter.fromLanguage("go", {
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const splitGoDocs = await goSplitter.splitDocuments(goDocs);
    splitDocs = splitDocs.concat(splitGoDocs);
    console.log(`   - Go files split into ${splitGoDocs.length} chunks`);
  }

  // Markdownファイル: ヘッダーなどを意識した分割が可能だが、今回は汎用Splitterを使用
  if (mdDocs.length > 0) {
    const mdSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const splitMdDocs = await mdSplitter.splitDocuments(mdDocs);
    splitDocs = splitDocs.concat(splitMdDocs);
    console.log(`   - Markdown files split into ${splitMdDocs.length} chunks`);
  }

  // その他
  if (otherDocs.length > 0) {
    const genericSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    splitDocs = splitDocs.concat(await genericSplitter.splitDocuments(otherDocs));
  }

  // 3. ベクトルDB保存 (LanceDB)
  const dbPath = path.join(__dirname, "../data/lancedb");
  if (!fs.existsSync(path.dirname(dbPath))) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  console.log(`💾 DB保存先: ${dbPath}`);
  const db = await connect(dbPath);
  
  // テーブルが存在する場合は上書き作成
  // 注意: LangChainのLanceDBラッパーはテーブル管理を抽象化しているため、
  // 直接テーブルを作成して渡す
  const table = await db.createTable(
    "vectors",
    [{ vector: Array(384).fill(0), text: "placeholder", source: "placeholder" }],
    { mode: "overwrite" }
  );
  
  // ローカルモデルを使用 (Xenova/all-MiniLM-L6-v2)
  const embeddings = new HuggingFaceTransformersEmbeddings({
    modelName: "Xenova/all-MiniLM-L6-v2",
  });

  await LanceDB.fromDocuments(
    splitDocs,
    embeddings,
    { table }
  );

  console.log("✅ 学習完了: 知識ベースが最新化されました。");
}

run().catch((err) => {
  console.error("❌ 学習中にエラーが発生しました:", err);
  process.exit(1);
});
