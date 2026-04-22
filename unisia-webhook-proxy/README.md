# Unisia Webhook Proxy

LINE Webhookを複数のボット・Lステップ・エルメに振り分ける中継サーバー。

## 概要

```
LINE Official Account
        ↓ Webhook
┌───────────────────────────────────────┐
│      Unisia Webhook Proxy             │
│                                       │
│  [リッチメニュー / キーワード で振り分け]  │
│                                       │
└───────────────────────────────────────┘
        ↓               ↓               ↓
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  海外相談   │ │  航空券     │ │ Lステップ   │
│  ボット    │ │  ボット     │ │ or エルメ   │
└─────────────┘ └─────────────┘ └─────────────┘
```

## 特徴

- ✅ **複数ボット対応**: 海外相談ボット、航空券ボット
- ✅ **Lステップ/エルメ両対応**: 環境変数で切り替え
- ✅ **リッチメニュー対応**: Postbackで振り分け
- ✅ **キーワード振り分け**: メッセージ内容で判定
- ✅ **モード維持**: 一度選択したモードを30分維持
- ✅ **転送ログ**: 全転送を記録

## セットアップ

### 1. インストール

```bash
cd unisia-webhook-proxy
npm install
```

### 2. 環境変数設定

```bash
cp .env.example .env
```

```env
# LINE
LINE_CHANNEL_ACCESS_TOKEN=your_token
LINE_CHANNEL_SECRET=your_secret

# 転送先
CONSULTATION_BOT_URL=https://consultation-bot.railway.app/webhook
FLIGHT_BOT_URL=https://flight-bot.railway.app/webhook

# Lステップ or エルメ（どちらか一方）
MA_TOOL=lstep
LSTEP_WEBHOOK_URL=https://manager.linestep.jp/webhook/xxx
# または
# MA_TOOL=elme
# ELME_WEBHOOK_URL=https://elme.me/webhook/xxx

# デフォルト転送先
DEFAULT_FORWARD=ma

PORT=3000
```

### 3. 起動

```bash
# 開発
npm run dev

# 本番
npm run build
npm run start
```

## 振り分けルール

### 優先順位

1. **Postback**（リッチメニュー）
2. **プレフィックス**（`@相談` など）
3. **現在のモード**（30分維持）
4. **キーワード**
5. **デフォルト**

### Postback設定

| Postback Data | 転送先 | 説明 |
|--------------|--------|------|
| `menu_consultation` | 海外相談ボット | 相談メニュー |
| `menu_flight` | 航空券ボット | 航空券メニュー |
| `menu_lstep` | Lステップ/エルメ | メインメニュー |

### キーワード設定

| キーワード | 転送先 |
|-----------|--------|
| 留学、ワーホリ、海外相談 | 海外相談ボット |
| 航空券、フライト、セール、治安 | 航空券ボット |

### モード切替コマンド

| コマンド | 動作 |
|---------|------|
| `@相談` | 海外相談モードに切替 |
| `@航空券` | 航空券モードに切替 |
| `@メイン` または `戻る` | デフォルトに戻る |

## リッチメニュー設定

LINE Official Account Managerで以下のように設定：

### ボタン1: 海外相談
- **アクション**: ポストバック
- **データ**: `menu_consultation`
- **表示テキスト**: 海外について相談する

### ボタン2: 航空券検索
- **アクション**: ポストバック
- **データ**: `menu_flight`
- **表示テキスト**: 航空券を探す

### ボタン3: メインメニュー
- **アクション**: ポストバック
- **データ**: `menu_lstep`
- **表示テキスト**: メニュー

## API

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | /health | ヘルスチェック | - |
| POST | /webhook | LINE Webhook | LINE署名 |
| GET | /api/stats | 転送統計 | API Key |
| GET | /api/config | 設定確認 | API Key |

## デプロイ構成

### 推奨構成（Railway）

```
┌─────────────────────────────────────────────┐
│ Railway Project: unisia-line                │
├─────────────────────────────────────────────┤
│ Service 1: webhook-proxy (port 3000)        │
│   └─ LINE Webhook URL をここに設定          │
│                                             │
│ Service 2: consultation-bot (port 3000)     │
│   └─ 内部URL: consultation-bot.internal     │
│                                             │
│ Service 3: flight-bot (port 3000)           │
│   └─ 内部URL: flight-bot.internal           │
└─────────────────────────────────────────────┘
```

### 環境変数（Railway内部通信）

```env
CONSULTATION_BOT_URL=http://consultation-bot.internal:3000/webhook
FLIGHT_BOT_URL=http://flight-bot.internal:3000/webhook
```

## Lステップ/エルメ設定

### Lステップの場合

1. Lステップ管理画面 → 設定 → Webhook
2. Webhook URLを取得
3. `.env` に設定:
   ```env
   MA_TOOL=lstep
   LSTEP_WEBHOOK_URL=https://manager.linestep.jp/webhook/xxx
   ```

### エルメの場合

1. エルメ管理画面 → 設定 → Webhook
2. Webhook URLを取得
3. `.env` に設定:
   ```env
   MA_TOOL=elme
   ELME_WEBHOOK_URL=https://elme.me/webhook/xxx
   ```

## トラブルシューティング

### 転送されない

1. `/api/config` で設定を確認
2. 転送先のサービスが起動しているか確認
3. ログで `❌ Failed to forward` を探す

### 署名エラー

- `LINE_CHANNEL_SECRET` が正しいか確認
- 転送先でも同じシークレットを使用

### モードが維持されない

- 30分のタイムアウトを確認
- `終了` `戻る` `メニュー` で明示的にリセット

## ライセンス

Private - Unisia Internal Use Only
