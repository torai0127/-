# 航空券検索Bot 開発進捗

## 最終更新: 2026-04-28

## 概要
LINE公式アカウント用の航空券検索チャットボット。
複数の航空券予約サイトの価格を内部で比較し、**最安値1件のみ**を提示する。

## 実装済み機能

### 1. 価格比較システム
- **Kiwi.com Tequila API** - 複数OTA・航空会社を集約して比較
- **Skyscanner API (Sky Scrapper)** - 複数予約サイトの価格を集約
- 並列でAPIを呼び出し、荷物(20kg)込みの総額で比較
- 最安値のサイト1件のみを表示（サイト名は非表示）

### 2. ディープリンク生成（11サイト対応）
- Google Flights
- Skyscanner
- Kayak
- Trip.com
- エアトリ
- トラベルコ
- スカイチケット
- さくらトラベル
- Kiwi.com
- eDreams
- Momondo

### 3. LINE Bot機能
- テキストメッセージからの航空券検索パラメータ抽出
- 入力テンプレート表示機能
- Postbackイベント対応（リッチメニュー連携）
- アンケート機能

### 4. 外部連携
- OpenAI GPT-4o-mini（パラメータ抽出・一般応答）
- 外務省安全情報取得

## 環境変数設定

```env
# LINE
LINE_CHANNEL_ACCESS_TOKEN=（設定済み）
LINE_CHANNEL_SECRET=（設定済み）

# OpenAI
OPENAI_API_KEY=（設定済み・クォータ確認必要）

# RapidAPI (Skyscanner)
RAPIDAPI_KEY=（設定済み・CAPTCHA問題あり）

# Kiwi.com Tequila API
KIWI_API_KEY=（未設定 ← 次のステップ）
```

## 現在の課題

| 課題 | 状態 | 対応 |
|------|------|------|
| OpenAI クォータ不足 | ⚠️ | 課金設定が必要 |
| Skyscanner CAPTCHA | ⚠️ | Aviasalesで代替 |
| Kiwi.com APIキー | ⏸️ | 保留（申請制） |
| Travelpayouts API | ✅ | 設定完了 |

## ファイル構成

```
src/
├── flight/
│   ├── aviasales-api.ts     # Aviasales/Travelpayouts API ← NEW
│   ├── kiwi-api.ts          # Kiwi.com API統合
│   ├── skyscanner-api.ts    # Skyscanner API統合
│   ├── price-comparator.ts  # 複数API価格比較 ← 更新
│   ├── multi-site-search.ts # ディープリンク生成
│   └── google-flights.ts    # Google Flights URL生成
├── line/
│   ├── handler.ts           # LINE Webhook処理
│   └── client.ts            # LINE SDK設定
├── ai/
│   ├── openai.ts            # OpenAI統合
│   └── prompts.ts           # プロンプト定義
├── db/
│   ├── index.ts             # SQLite設定
│   ├── users.ts             # ユーザーデータ
│   └── conversations.ts     # 会話履歴
└── index.ts                 # エントリーポイント
```

## 動作フロー

```
ユーザー: 「フィリピン、6月15〜20日、2人、福岡出発」
    ↓
1. パラメータ抽出（テキスト解析 + OpenAI）
    ↓
2. 並列API検索
   ├── Kiwi.com API → 最安値取得
   └── Skyscanner API → 最安値取得
    ↓
3. 内部比較（荷物20kg込み総額）
    ↓
4. 最安値1件のみ表示
   「💰 ¥45,800〜 / 1名」
   「🔗 予約はこちら [リンク]」
```

## 次のステップ

1. [x] Kiwi.com APIキー取得
2. [ ] Renderにデプロイ
3. [ ] LINE Webhook URL更新
4. [ ] 本番テスト
