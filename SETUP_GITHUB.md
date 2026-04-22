# GitHub & Render.com セットアップ手順

## Step 1: GitHubでリポジトリ作成

1. https://github.com/new にアクセス
2. 以下の設定でリポジトリ作成:
   - **Repository name**: `unisia-line-bot-system`
   - **Description**: `LINE Bot System with Elme integration`
   - **Visibility**: Private（推奨）
   - **Initialize**: チェックなし（既存コードをプッシュするため）
3. 「Create repository」クリック

## Step 2: ローカルからプッシュ

ターミナルで以下を実行（`YOUR_USERNAME`を置き換え）:

```bash
cd "/Users/user/Library/Mobile Documents/com~apple~CloudDocs/Odsidian/トライ/02_ビジネス/ユニシア/projects"

# リモートを追加
git remote add origin https://github.com/YOUR_USERNAME/unisia-line-bot-system.git

# プッシュ
git branch -M main
git push -u origin main
```

## Step 3: Render.comでデプロイ

1. https://render.com にログイン（GitHubアカウントで）
2. 「New」→「Blueprint」を選択
3. リポジトリ `unisia-line-bot-system` を選択
4. 「Apply」をクリック

## Step 4: 環境変数を設定

Render.comのダッシュボードで各サービスに環境変数を設定:

### unisia-webhook-proxy
| 変数名 | 値 |
|--------|---|
| `LINE_CHANNEL_SECRET` | LINE Developersから取得 |
| `CONSULTATION_BOT_URL` | `https://unisia-consultation-bot.onrender.com/webhook` |
| `FLIGHT_BOT_URL` | `https://unisia-flight-bot.onrender.com/webhook` |
| `ELME_WEBHOOK_URL` | エルメの外部連携URLから取得 |

### unisia-consultation-bot
| 変数名 | 値 |
|--------|---|
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Developersから取得 |
| `LINE_CHANNEL_SECRET` | LINE Developersから取得 |
| `OPENAI_API_KEY` | OpenAIから取得 |

### unisia-flight-bot
| 変数名 | 値 |
|--------|---|
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Developersから取得 |
| `LINE_CHANNEL_SECRET` | LINE Developersから取得 |
| `OPENAI_API_KEY` | OpenAIから取得 |

## Step 5: LINE Developersの設定

1. https://developers.line.biz/ にログイン
2. 対象のチャネルを選択
3. Messaging API → Webhook URL:
   ```
   https://unisia-webhook-proxy.onrender.com/webhook
   ```
4. 「Webhookの利用」をON
5. 「検証」で接続テスト

## Step 6: エルメの設定

1. エルメ管理画面にログイン
2. 設定 → 外部連携 → Webhook
3. Webhook URL: `https://unisia-webhook-proxy.onrender.com/webhook`
4. リッチメニュー作成（RICH_MENU_SETUP.md参照）

## 完了確認

各サービスのヘルスチェック:
```bash
curl https://unisia-webhook-proxy.onrender.com/health
curl https://unisia-consultation-bot.onrender.com/health
curl https://unisia-flight-bot.onrender.com/health
```

すべて `{"status":"ok",...}` が返ればOK！
