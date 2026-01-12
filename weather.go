package weatherlib

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
)

// WeatherConfig はクライアント設定を保持します
// 注意: V2からは APIKey は Environment 変数ではなく、Config構造体で渡す必要があります。
type WeatherConfig struct {
	APIKey  string
	Region  string // "JP", "US", "EU" など (現在はURL構築には未使用ですが将来用)
	IsDebug bool
}

// WeatherData は取得した天気情報を表します
type WeatherData struct {
	City        string
	Temperature float64
	Condition   string
}

// openWeatherMapResponse はAPIからのJSONレスポンスをパースするための内部構造体です
type openWeatherMapResponse struct {
	Weather []struct {
		Main string `json:"main"`
	} `json:"weather"`
	Main struct {
		Temp float64 `json:"temp"`
	} `json:"main"`
	Name string `json:"name"`
	Cod  int    `json:"cod"`
}

// NewClient は新しい天気クライアントを作成します
func NewClient(apiKey string, region string) *WeatherConfig {
	return &WeatherConfig{
		APIKey: apiKey,
		Region: region,
	}
}

// GetCurrentWeather は指定された都市の天気を取得します
// 注意: 都市名は必ず英語で指定してください（例: "Tokyo"）。日本語はサポートされていません。
func (c *WeatherConfig) GetCurrentWeather(city string) (*WeatherData, error) {
	if c.APIKey == "" {
		return nil, errors.New("API Key is required")
	}

	// URLの構築 (OpenWeatherMap v2.5 weather endpoint)
	baseURL := "https://api.openweathermap.org/data/2.5/weather"
	u, err := url.Parse(baseURL)
	if err != nil {
		return nil, err
	}

	q := u.Query()
	q.Set("q", city)
	q.Set("appid", c.APIKey)
	q.Set("units", "metric") // 摂氏で取得
	u.RawQuery = q.Encode()

	if c.IsDebug {
		fmt.Printf("Debug: Requesting URL: %s\n", u.String())
	}

	// リクエストの実行
	resp, err := http.Get(u.String())
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API request failed with status: %d", resp.StatusCode)
	}

	// レスポンスのパース
	var apiResp openWeatherMapResponse
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return nil, err
	}

	if len(apiResp.Weather) == 0 {
		return nil, errors.New("weather condition not found in response")
	}

	return &WeatherData{
		City:        apiResp.Name,
		Temperature: apiResp.Main.Temp,
		Condition:   apiResp.Weather[0].Main,
	}, nil
}
