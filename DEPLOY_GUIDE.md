# Unisia LINE Bot システム - デプロイガイド

## システム構成

```
LINE公式アカウント
      │
      ▼
┌────────────────────┐
│ unisia-webhook-proxy│  ← Webhook受信・振り分け
│     (Port 3000)     │
└────────┬───────────┘
         │
    ┌────┴────┬──────────┐
    ▼         ▼          ▼
┌─────────┐ ┌─────────┐ ┌─────┐
│相談Bot  │ │航空券Bot │ │エルメ│
│(3002)   │ │ (3001)  │ │     │
└─────────┘ └─────────┘ └─────┘
```

## クイックスタート（Render.com）

### 1. GitHubにプッシュ

```bash
# 各プロジェクトを別リポジトリにするか、モノレポにする
cd projects/unisia-webhook-proxy
git init && git add . && git commit -m "Initial commit"
gh repo create unisia-webhook-proxy --public --source=. --push

cd ../unisia-line-bot
git init && git add . && git commit -m "Initial commit"
gh repo create unisia-consultation-bot --public --source=. --push

cd ../unisia-flight-bot
git init && git add . && git commit -m "Initial commit"
gh repo create unisia-flight-bot --public --source=. --push
```

### 2. Render.com でデプロイ

1. https://render.com にログイン
2. 「New」→「Web Service」
3. GitHubリポジトリを選択
4. 設定:
   - **Name**: unisia-xxx
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
5. 環境変数を設定（下記参照）
6. 「Create Web Service」

### 3. 環境変数の設定

#### 中継サーバー（unisia-webhook-proxy）

| 変数名 | 値 | 説明 |
|--------|---|------|
| `LINE_CHANNEL_SECRET` | LINE Developersから | 署名検証用 |
| `CONSULTATION_BOT_URL` | `https://xxx.onrender.com/webhook` | 相談ボットのURL |
| `FLIGHT_BOT_URL` | `https://xxx.onrender.com/webhook` | 航空券ボットのURL |
| `MA_TOOL` | `elme` | エルメを使用 |
| `ELME_WEBHOOK_URL` | エルメの外部連携URL | エルメへの転送先 |
| `DEFAULT_FORWARD` | `ma` | デフォルト転送先 |
| `ADMIN_API_KEY` | 任意の文字列 | 管理API用 |

#### 相談ボット（unisia-consultation-bot）

| 変数名 | 値 |
|--------|---|
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Developersから |
| `LINE_CHANNEL_SECRET` | LINE Developersから |
| `OPENAI_API_KEY` | OpenAIから |
| `PORT` | `3002` |

#### 航空券ボット（unisia-flight-bot）

| 変数名 | 値 |
|--------|---|
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Developersから |
| `LINE_CHANNEL_SECRET` | LINE Developersから |
| `OPENAI_API_KEY` | OpenAIから |
| `PORT` | `3001` |

### 4. エルメの設定

1. エルメ管理画面 → 設定 → 外部連携
2. Webhook URL に中継サーバーのURLを設定:
   ```
   https://unisia-webhook-proxy.onrender.com/webhook
   ```

### 5. LINE Developersの設定

1. Messaging API → Webhook URL:
   ```
   https://unisia-webhook-proxy.onrender.com/webhook
   ```
2. 「Webhookの利用」をON
3. 「検証」で接続テスト

### 6. リッチメニューの作成（エルメ）

6ボタンレイアウト:

| ボタン | Postback Data |
|--------|---------------|
| 格安航空券サポート | `menu_flight_ticket` |
| 海外保険案内サポート | `menu_insurance` |
| 海外LINEサポート | `menu_line_support` |
| 帰国後転職サポート | `menu_job_support` |
| 海外留学無料相談会 | `menu_study_abroad` |
| 海外緊急対応 | `menu_emergency` |

## 動作確認

### ヘルスチェック

```bash
curl https://unisia-webhook-proxy.onrender.com/health
# {"status":"ok","service":"unisia-webhook-proxy",...}
```

### 設定確認

```bash
curl -H "x-api-key: YOUR_API_KEY" \
  https://unisia-webhook-proxy.onrender.com/api/config
```

### テストメッセージ

| 入力 | 期待される応答 |
|------|---------------|
| 「航空券を探して」 | 航空券ボットが応答 |
| 「留学について相談したい」 | 相談ボットが応答 |
| 「こんにちは」 | エルメが応答 |

## トラブルシューティング

### Webhook検証が失敗する

- LINE_CHANNEL_SECRET が正しいか確認
- URLが正しいか確認（`/webhook` まで含める）

### ボットが応答しない

- 各ボットのヘルスチェックを確認
- 環境変数が設定されているか確認
- ログを確認（Render.com のLogs タブ）

### エルメに転送されない

- ELME_WEBHOOK_URL が正しいか確認
- MA_TOOL が `elme` になっているか確認

## 料金目安（Render.com）

- **Free tier**: 月750時間まで無料（3サービス × 24時間 = 問題なし）
- **注意**: 無料プランは15分無通信でスリープ

→ 本番運用では Starter プラン（$7/月/サービス）推奨

## 関連ドキュメント

- [エルメ統合ガイド](./unisia-webhook-proxy/docs/ELME_INTEGRATION.md)
- [リッチメニュー設定](./unisia-webhook-proxy/docs/RICH_MENU_SETUP.md)
- [Postbackリファレンス](./unisia-webhook-proxy/docs/POSTBACK_REFERENCE.md)
