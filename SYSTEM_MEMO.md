# Unisia LINE Bot システム メモ

## 最終更新: 2026-04-23

## システム構成

### 1. Webhook Proxy (`unisia-webhook-proxy`)
- **URL**: `https://unisia-webhook-proxy-42av.onrender.com/webhook`
- **役割**: LINEからのWebhookを受け取り、適切なボットとエルメに転送
- **転送ルール**:
  - 「航空券」「フライト」「いきたい地域」「泊」→ Flight Bot
  - 「留学」「保険」「転職」「緊急」→ Consultation Bot
  - デフォルト → Consultation Bot
- **エルメへの同時転送**: 全イベントをエルメにも転送

### 2. 航空券ボット (`unisia-flight-bot`)
- **URL**: `https://unisia-flight-bot.onrender.com/webhook`
- **機能**:
  - エルメのリッチメニューからの入力形式に対応
  - テキストから直接パラメータ抽出（`extractFlightParamsFromText`）
  - OpenAIでもパラメータ抽出（フォールバック）
  - `tfs=`パラメータでGoogle Flights検索リンク生成
  - 条件（出発地、目的地、日付、人数）が全て反映される

### 3. 相談ボット (`unisia-consultation-bot`)
- **URL**: `https://unisia-consultation-bot.onrender.com/webhook`
- **機能**: 海外渡航に関する一般相談

### 4. エルメ連携
- **Webhook URL**: `https://cb.lmes.jp/line/callback/add/168878`
- **リッチメニュー**: エルメで管理
- **顧客管理・ステップ配信**: エルメで実施

## 航空券ボット 入力フォーマット

```
いきたい地域: フィリピン
いきたい時期: 3月ごろ
期間: 5泊6日
人数: 3人 妻・子供
空港: 福岡
```

## 対応空港（IATA/Place ID）

- 福岡(FUK), 成田(NRT), 羽田(HND), 関空(KIX), 中部(NGO), 新千歳(CTS)
- その他多数の国際空港に対応

## GitHub リポジトリ
- `https://github.com/torai0127/-/`

## Render.com サービス
- unisia-webhook-proxy
- unisia-consultation-bot
- unisia-flight-bot
