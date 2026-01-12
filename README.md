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
