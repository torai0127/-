# Unisia LINE Bot

Unisia（ユニシア）の海外渡航相談LINEボット。
留学・ワーホリ・海外旅行を考えている方の無料相談に24時間対応。

## 機能

- 🤖 AIによる自動相談対応（GPT-4o-mini）
- 💬 会話履歴を考慮した文脈理解
- 📊 会話ログの自動保存・分析
- 📚 留学FAQ知識ベース

## 技術スタック

- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **LINE SDK**: @line/bot-sdk v9
- **AI**: OpenAI GPT-4o-mini
- **Database**: SQLite (better-sqlite3)
- **Server**: Express.js

## セットアップ

### 1. 依存関係のインストール

```bash
cd unisia-line-bot
npm install
```

### 2. 環境変数の設定

```bash
cp .env.example .env
```

`.env` を編集して以下を設定:

```env
# LINE Messaging API（LINE Developersで取得）
LINE_CHANNEL_ACCESS_TOKEN=your_channel_access_token
LINE_CHANNEL_SECRET=your_channel_secret

# OpenAI API（OpenAIで取得）
OPENAI_API_KEY=your_openai_api_key

# Server
PORT=3000
```

### 3. LINE Developersの設定

1. [LINE Developers](https://developers.line.biz/) にログイン
2. 新しいプロバイダーを作成（または既存を使用）
3. 「Messaging API」チャネルを作成
4. 「Messaging API設定」から:
   - チャネルアクセストークンを発行
   - チャネルシークレットを確認
5. Webhook URLを設定: `https://your-domain.com/webhook`
6. Webhookの利用をONに
7. 応答メッセージをOFFに（ボットが返信するため）

### 4. 開発サーバーの起動

```bash
npm run dev
```

### 5. ローカル開発時のトンネリング

LINE WebhookはHTTPS必須のため、ngrokなどを使用:

```bash
ngrok http 3000
```

表示されたURL（例: `https://xxxx.ngrok.io/webhook`）をLINE DevelopersのWebhook URLに設定。

## デプロイ

### Railway（推奨）

1. [Railway](https://railway.app/) でプロジェクト作成
2. GitHubリポジトリを連携
3. 環境変数を設定
4. 自動デプロイ完了後、URLをLINE Developersに設定

### Vercel

```bash
npm i -g vercel
vercel
```

## ディレクトリ構造

```
unisia-line-bot/
├── src/
│   ├── index.ts          # メインエントリ
│   ├── line/
│   │   ├── handler.ts    # LINEイベントハンドラ
│   │   └── client.ts     # LINE Client設定
│   ├── ai/
│   │   ├── openai.ts     # OpenAI設定
│   │   └── prompts.ts    # プロンプト定義
│   ├── db/
│   │   ├── index.ts      # DB接続
│   │   └── conversations.ts # 会話ログ管理
│   └── knowledge/
│       └── faq.ts        # 留学FAQ知識ベース
├── data/
│   └── conversations.db  # SQLiteデータベース（自動生成）
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## データ分析

会話データは `data/conversations.db` に保存されます。

### データ抽出例

```typescript
import { getAllConversations, getAnalytics, getTopQuestions } from './src/db/conversations';

// 過去30日の分析
const analytics = getAnalytics(30);

// よくある質問Top20
const topQuestions = getTopQuestions(20);

// 学習用データのエクスポート
const trainingData = exportConversationsForTraining();
```

## 改善サイクル

1. **データ収集**: 全ての会話がDBに自動保存
2. **分析**: よくある質問、対応できなかった質問を抽出
3. **改善**: プロンプトやFAQを更新
4. **反映**: 再デプロイ

## API エンドポイント

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | ヘルスチェック |
| POST | /webhook | LINE Webhook |

## トラブルシューティング

### Webhookが動作しない
- SSL証明書が有効か確認
- LINE DevelopersでWebhookの利用がONになっているか確認
- 応答メッセージがOFFになっているか確認

### 応答が遅い
- OpenAI APIのレイテンシを確認
- `gpt-4o-mini` を使用しているか確認（速度とコストのバランス）

### データベースエラー
- `data/` ディレクトリの書き込み権限を確認
- SQLiteファイルが破損していないか確認

## ライセンス

Private - Unisia Internal Use Only

## 連絡先

- 株式会社UNISIA
- 代表: トライ（井上 智羅）
