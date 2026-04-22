# Railway デプロイ手順

Railwayは無料枠があり、簡単にNode.jsアプリをデプロイできます。

## 1. Railwayアカウント作成

1. [Railway](https://railway.app/) にアクセス
2. 「Start a New Project」をクリック
3. GitHubアカウントで連携（推奨）

## 2. プロジェクト作成

### 方法A: GitHubリポジトリから（推奨）

1. まずGitHubにリポジトリを作成してpush:
   ```bash
   cd unisia-line-bot
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/your-username/unisia-line-bot.git
   git push -u origin main
   ```

2. Railwayで「Deploy from GitHub repo」を選択
3. リポジトリを選択
4. 自動でビルド・デプロイが開始

### 方法B: CLI から直接

1. Railway CLIをインストール:
   ```bash
   npm install -g @railway/cli
   ```

2. ログイン:
   ```bash
   railway login
   ```

3. プロジェクト作成＆デプロイ:
   ```bash
   cd unisia-line-bot
   railway init
   railway up
   ```

## 3. 環境変数の設定

1. Railwayダッシュボードでプロジェクトを開く
2. 「Variables」タブをクリック
3. 以下を追加:

| Variable | Value |
|----------|-------|
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Developersで取得したトークン |
| `LINE_CHANNEL_SECRET` | LINE Developersで取得したシークレット |
| `OPENAI_API_KEY` | OpenAIで取得したAPIキー |
| `PORT` | 3000 |
| `NODE_ENV` | production |

4. 「Deploy」ボタンで再デプロイ

## 4. ドメインの設定

1. 「Settings」タブ
2. 「Networking」セクション
3. 「Generate Domain」をクリック
4. 生成されたURL（例: `unisia-line-bot-production.up.railway.app`）をコピー

## 5. LINE WebhookにURLを設定

1. LINE Developersを開く
2. 「Messaging API設定」→「Webhook URL」
3. Railwayのドメイン + `/webhook` を設定:
   ```
   https://unisia-line-bot-production.up.railway.app/webhook
   ```
4. 「検証」ボタンで接続確認

---

## 動作確認

1. LINEでボットを友だち追加（QRコードから）
2. 「こんにちは」とメッセージを送信
3. ボットから返信が来れば成功！

---

## Railway 料金

### 無料枠（Hobby Plan）
- 月$5分のクレジット付与
- 小規模なボットなら無料枠で十分

### 有料プラン
- 使った分だけ課金
- CPU/メモリ使用量ベース

---

## トラブルシューティング

### デプロイが失敗する
- ビルドログを確認
- `package.json` の `engines` でNode.jsバージョンを指定

### Webhook検証が失敗
- ドメインが正しいか確認
- `/webhook` が末尾についているか確認
- デプロイが完了しているか確認

### レスポンスが遅い/タイムアウト
- Railway側でスリープしている可能性
- 初回アクセス時は起動に数秒かかる

---

## 便利なコマンド

```bash
# ログを確認
railway logs

# 環境変数を確認
railway variables

# ローカルで環境変数を使ってテスト
railway run npm run dev
```
