# Unisia Flight Bot

Unisia（ユニシア）の航空券手配LINEボット。
ユーザーの希望に合った航空券を検索し、お得なセール情報を自動配信。

## 機能

### 基本機能
- ✈️ **航空券検索**: 条件からGoogle Flightsの**購入前エントリURL**を生成（往復・人数を自然文で指定。`/flights/booking?tfs=` は便確定後のみのためボットでは再現不可）
- 📝 **アンケート**: ユーザーの興味地域・予算などを登録
- 🌍 **治安情報**: 外務省データに基づく安全情報を提供
- 🤖 **AI相談**: GPT-4o-miniによる旅行相談

### 自動配信機能
- 🎉 **セール通知**: 興味地域のセール情報を自動配信
- 📢 **安全情報更新**: 治安状況の変化を通知
- 📊 **パーソナライズ配信**: ユーザーの登録情報に基づく情報提供

## 技術スタック

- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **LINE SDK**: @line/bot-sdk v9
- **AI**: OpenAI GPT-4o-mini
- **Database**: SQLite
- **Server**: Express.js
- **外部API**: 外務省海外安全情報

## セットアップ

### 1. 依存関係のインストール

```bash
cd unisia-flight-bot
npm install
```

### 2. 環境変数の設定

```bash
cp .env.example .env
```

`.env` を編集:

```env
LINE_CHANNEL_ACCESS_TOKEN=your_token
LINE_CHANNEL_SECRET=your_secret
OPENAI_API_KEY=your_api_key
ADMIN_API_KEY=your_admin_key  # 管理API用
PORT=3001
```

### 3. ローカル自己テスト（LINE不要）

```bash
npm run test:self
```

Google Flights URL 生成・治安情報・SQLite（アンケート保存）を検証します。`OPENAI_API_KEY` がある場合は抽出テストも実行します。

### 4. ビルド & 起動

```bash
# 開発
npm run dev

# 本番
npm run build
npm run start
```

## 使い方

### アンケート登録
ユーザーが初めてメッセージを送ると、自動でアンケートが開始されます。
または「アンケート」「登録」と送信。

### 航空券検索
```
韓国行きの航空券を探して
成田から台湾、5月1日出発
ハワイ往復、7月10日〜17日
```

### 治安情報
```
タイの治安は？
韓国は安全？
```

## 管理機能

### セール通知の送信

```bash
# コマンドライン
npx tsx src/scripts/send-notification.ts deal \
  --destination="韓国" \
  --price=29800 \
  --description="春のセール！"

# API経由
curl -X POST http://localhost:3001/api/notify/deal \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: your_admin_key" \
  -d '{
    "destination": "韓国",
    "originAirports": ["成田", "羽田"],
    "price": 29800,
    "validUntil": "2026-05-31",
    "description": "春のセール！"
  }'
```

### 一斉配信

```bash
npx tsx src/scripts/send-notification.ts broadcast \
  --message="新機能をリリースしました！"
```

### 治安情報の配信

```bash
npx tsx src/scripts/send-notification.ts safety \
  --country="タイ"
```

## API エンドポイント

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | /health | ヘルスチェック | - |
| POST | /webhook | LINE Webhook | LINE署名 |
| POST | /api/notify/deal | セール通知送信 | API Key |
| POST | /api/notify/broadcast | 一斉配信 | API Key |
| GET | /api/stats | 統計情報 | API Key |

## データベース

SQLiteを使用。`data/flight-bot.db` に保存。

### テーブル
- `users`: ユーザー基本情報
- `survey_responses`: アンケート回答
- `flight_searches`: 検索履歴
- `price_alerts`: 価格アラート設定
- `notifications`: 配信履歴
- `conversations`: 会話ログ

## 今後の拡張（Phase 2）

- [ ] Amadeus API連携（リアルタイム価格取得）
- [ ] 自動価格監視
- [ ] リッチメニュー対応
- [ ] Lステップ/エルメとの中継サーバー統合

## ライセンス

Private - Unisia Internal Use Only
