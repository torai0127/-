# Unisia LINE Bot System

LINE公式アカウント向けのチャットボットシステム。エルメと連携し、複数のボットを振り分けます。

## アーキテクチャ

```
LINE公式アカウント
      │
      ▼
┌────────────────────┐
│ unisia-webhook-proxy│  ← Webhook受信・振り分け
└────────┬───────────┘
         │
    ┌────┴────┬──────────┐
    ▼         ▼          ▼
┌─────────┐ ┌─────────┐ ┌─────┐
│相談Bot  │ │航空券Bot │ │エルメ│
└─────────┘ └─────────┘ └─────┘
```

## プロジェクト構成

| ディレクトリ | 説明 | ポート |
|-------------|------|--------|
| `unisia-webhook-proxy/` | LINE Webhook振り分け | 3000 |
| `unisia-line-bot/` | 海外相談チャットボット | 3002 |
| `unisia-flight-bot/` | 航空券検索チャットボット | 3001 |

## 機能

### 航空券ボット
- Google Flights検索リンク生成（検索結果ページ直接表示）
- 曖昧な日付対応（「5月」「5月末」→最安値検索）
- 外務省治安情報連携
- アンケート機能

### 相談ボット
- AI応答（GPT-4o-mini）
- 海外渡航FAQ
- 会話履歴保持

### 中継サーバー
- リッチメニューPostback振り分け
- キーワードによるルーティング
- エルメ/Lステップ連携

## デプロイ（Render.com）

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

### 手動デプロイ

1. このリポジトリをFork
2. Render.comで「New Blueprint」
3. リポジトリを選択
4. 環境変数を設定

### 環境変数

| 変数名 | 説明 |
|--------|------|
| `LINE_CHANNEL_SECRET` | LINE署名検証用 |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINEメッセージ送信用 |
| `OPENAI_API_KEY` | AI応答用 |
| `ELME_WEBHOOK_URL` | エルメ転送先 |

## ローカル開発

```bash
# 各プロジェクトで
npm install
npm run dev

# 統合テスト
./test-integration.sh
```

## ドキュメント

- [エルメ統合ガイド](./unisia-webhook-proxy/docs/ELME_INTEGRATION.md)
- [デプロイガイド](./DEPLOY_GUIDE.md)
- [リッチメニュー設定](./unisia-webhook-proxy/docs/RICH_MENU_SETUP.md)

## ライセンス

Private - Unisia Inc.
