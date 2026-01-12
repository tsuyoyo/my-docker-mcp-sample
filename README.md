# WeatherLib (Go)

シンプルな天気予報取得ライブラリです。
バックエンドとして [OpenWeatherMap](https://openweathermap.org/) を使用しています。

## 特徴
- 非常に軽量
- 3つのリージョンに対応

## 重要な変更点 (v2.0)
以前のバージョンでは環境変数からAPIキーを読み込んでいましたが、v2.0からは `NewClient` 関数で直接渡す仕様に変更されました。

## 使い方

1. OpenWeatherMapで無料のAPIキーを取得してください。

```go
package main

import (
    "fmt"
    "github.com/my-org/weatherlib"
)

func main() {
    // APIキーとリージョンを指定
    client := weatherlib.NewClient("your-api-key", "JP")

    // 天気を取得 (都市名は英語のみ！)
    weather, err := client.GetCurrentWeather("Tokyo")
    if err != nil {
        panic(err)
    }

    fmt.Printf("%s の天気: %.1f℃ (%s)\n", weather.City, weather.Temperature, weather.Condition)
}
```

---

## 🤖 AIエージェント (MCP) の使い方

このライブラリには、実装方法やトラブルシュートをサポートする専属AIエージェントが付属しています。
CursorやClaude DesktopなどのMCP対応エディタから利用できます。

### 前提条件

このエージェントはローカルLLM (Ollama) を使用します。

1. [Ollama](https://ollama.com/) をインストールしてください。
2. 推奨モデル `gemma3` をプルしてください。
   ```bash
   ollama pull gemma3
   ```
3. Ollamaサーバーを起動しておいてください。
   ```bash
   ollama serve
   ```

### Cursorでの設定

設定画面 (`Cmd + ,`) > `Features` > `MCP` > `Add New MCP Server` から、または `.cursor/mcp.json` に以下を追加してください。

> **Note**: `ghcr.io/tsuyoyo/my-docker-mcp-sample-agent:latest` の部分は、実際のイメージ名に置き換えてください。

```json
{
  "mcpServers": {
    "weather-agent": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "--add-host=host.docker.internal:host-gateway",
        "-e", "OLLAMA_BASE_URL=http://host.docker.internal:11434",
        "ghcr.io/tsuyoyo/my-docker-mcp-sample-agent:latest"
      ]
    }
  }
}
```

### 何ができるの？

エディタのチャットで `@weather-agent` と呼びかけて質問できます。

*   「東京の天気を取得するコードを書いて」
*   「APIキーの設定方法は？」
*   「エラーが出たんだけど、原因を教えて」
