# エルメ（L Message）統合ガイド

## 概要

このガイドでは、2つのチャットボットをエルメと統合する方法を説明します。

```
┌─────────────────┐
│     ユーザー     │
└────────┬────────┘
         │ LINE メッセージ
         ▼
┌─────────────────┐
│   LINE公式      │
│   アカウント     │
└────────┬────────┘
         │ Webhook
         ▼
┌─────────────────┐
│  中継サーバー    │◄── エルメでこのURLを設定
│(Webhook Proxy)  │
└────────┬────────┘
         │ 振り分け
    ┌────┴────┬────────────┐
    ▼         ▼            ▼
┌───────┐ ┌───────┐ ┌─────────┐
│相談Bot│ │航空券Bot│ │ エルメ  │
└───────┘ └───────┘ └─────────┘
```

## Step 1: サーバーをデプロイ

### 必要なサーバー（計3つ）

| サービス | ポート | 用途 |
|---------|-------|------|
| unisia-webhook-proxy | 3000 | LINE Webhook受信・振り分け |
| unisia-line-bot | 3002 | 海外相談チャットボット |
| unisia-flight-bot | 3001 | 航空券チャットボット |

### デプロイ先の選択肢

- **Render.com**（推奨・無料枠あり）
- Railway
- Heroku
- VPS（さくら、ConoHa など）

### Render.com でのデプロイ例

1. GitHubにプッシュ
2. Render.com で「New Web Service」
3. 各プロジェクトを個別にデプロイ

## Step 2: 環境変数の設定

### 中継サーバー（unisia-webhook-proxy）

```env
# LINE設定（LINE Developersから取得）
LINE_CHANNEL_SECRET=xxxxx

# ボットのURL（デプロイ後のURL）
CONSULTATION_BOT_URL=https://your-consultation-bot.onrender.com/webhook
FLIGHT_BOT_URL=https://your-flight-bot.onrender.com/webhook

# エルメ設定
MA_TOOL=elme
ELME_WEBHOOK_URL=https://lme.jp/p/xxxxx/webhook
# ※ エルメの「Webhook URL（外部連携用）」

# デフォルトの転送先
DEFAULT_FORWARD=ma

# 管理API
ADMIN_API_KEY=your-secure-api-key
```

### 相談ボット（unisia-line-bot）

```env
LINE_CHANNEL_ACCESS_TOKEN=xxxxx
LINE_CHANNEL_SECRET=xxxxx
OPENAI_API_KEY=sk-xxxxx
```

### 航空券ボット（unisia-flight-bot）

```env
LINE_CHANNEL_ACCESS_TOKEN=xxxxx
LINE_CHANNEL_SECRET=xxxxx
OPENAI_API_KEY=sk-xxxxx
```

## Step 3: エルメの設定

### 3-1. Webhook URLの設定

1. エルメ管理画面にログイン
2. **「設定」→「外部連携」→「Webhook」** へ移動
3. **Webhook URL** に中継サーバーのURLを設定

```
https://your-webhook-proxy.onrender.com/webhook
```

**重要**: LINE Developers側のWebhook URLではなく、中継サーバーのURLを設定します。

### 3-2. リッチメニューの作成

エルメ管理画面でリッチメニューを作成します。

#### 推奨レイアウト（6分割）

```
┌─────────────┬─────────────┬─────────────┐
│   格安航空券  │  海外保険   │   海外LINE  │
│   サポート   │  案内サポート │   サポート  │
├─────────────┼─────────────┼─────────────┤
│  帰国後転職  │ 海外留学無料 │   海外緊急  │
│   サポート   │    相談会   │    対応    │
└─────────────┴─────────────┴─────────────┘
```

#### 各ボタンのアクション設定

| ボタン | アクション種別 | 設定値 |
|-------|--------------|--------|
| 格安航空券サポート | ポストバック | `menu_flight_ticket` |
| 海外保険案内サポート | ポストバック | `menu_insurance` |
| 海外LINEサポート | ポストバック | `menu_line_support` |
| 帰国後転職サポート | ポストバック | `menu_job_support` |
| 海外留学無料相談会 | ポストバック | `menu_study_abroad` |
| 海外緊急対応 | ポストバック | `menu_emergency` |

### 3-3. エルメでのポストバック設定手順

1. **リッチメニュー作成**
   - 「リッチメニュー」→「新規作成」
   - テンプレートを選択（6分割推奨）

2. **各エリアの設定**
   - アクションタイプ: 「ポストバック」を選択
   - データ: 上記の `menu_xxxxx` を入力
   - 表示テキスト: 任意（「格安航空券サポート」など）

3. **リッチメニューを有効化**
   - 「デフォルト表示」をON
   - 対象: 全員 or タグで絞り込み

## Step 4: LINE Developersの設定

### Webhook URLの設定

LINE Developers Console で:

1. 対象のチャネルを選択
2. **Messaging API** タブ
3. **Webhook URL** に中継サーバーのURLを設定

```
https://your-webhook-proxy.onrender.com/webhook
```

4. **Webhookの利用** をON
5. **検証** ボタンでテスト

## Step 5: 動作確認

### 確認手順

1. LINE公式アカウントを友だち追加
2. リッチメニューが表示されることを確認
3. 各ボタンをタップして、正しいボットが応答することを確認

### 期待される動作

| 操作 | 応答ボット |
|------|-----------|
| 「格安航空券サポート」タップ | 航空券ボット |
| その他のメニュータップ | 相談ボット |
| 「航空券」「フライト」などを入力 | 航空券ボット |
| 「留学」「相談したい」などを入力 | 相談ボット |
| その他のメッセージ | エルメ（MA） |

### トラブルシューティング

```bash
# 中継サーバーのヘルスチェック
curl https://your-webhook-proxy.onrender.com/health

# 設定確認（要APIキー）
curl -H "x-api-key: your-api-key" \
  https://your-webhook-proxy.onrender.com/api/config
```

## ルーティングルール詳細

### 優先順位

1. **Postback** - リッチメニューのボタンからのアクション
2. **Prefix** - `@航空券` `@相談` などの接頭辞
3. **Keyword** - メッセージに含まれるキーワード
4. **Default** - 上記に該当しない場合 → エルメへ

### キーワードルーティング

#### 航空券ボットへ
- 航空券、フライト、飛行機、格安、セール、治安、アンケート

#### 相談ボットへ
- 留学、ワーホリ、海外相談、相談したい、保険、転職、就職、相談会、緊急、トラブル、助けて

## カスタマイズ

### ルーティングルールの変更

`src/config/routes.ts` を編集:

```typescript
export const ROUTE_RULES: RouteRule[] = [
  // 新しいルールを追加
  { type: 'keyword', pattern: '新キーワード', target: 'consultation', description: '説明' },
  // ...
];
```

### エルメ側での自動応答

チャットボットが対応しないメッセージはエルメに転送されるため、エルメ側で:

- シナリオ配信
- 自動応答
- タグ付け
- リマインダー

などの設定が可能です。

## セキュリティ

- LINE署名検証により、正規のLINEからのリクエストのみ処理
- 環境変数でシークレットを管理
- HTTPS必須（Renderなどは自動対応）

## 次のステップ

1. [ ] サーバー3つをデプロイ
2. [ ] 環境変数を設定
3. [ ] エルメでリッチメニュー作成
4. [ ] LINE DevelopersでWebhook URL設定
5. [ ] 動作確認
6. [ ] 本番運用開始
