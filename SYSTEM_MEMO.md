# Unisia LINE Bot システム 完全ドキュメント

## 最終更新: 2026-04-23 16:15

---

## システム概要

Unisia公式LINE向けの自動応答システム。3つのサービスで構成され、エルメと連携して動作。

---

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
  - テキストから直接パラメータ抽出
  - `tfs=`パラメータでGoogle Flights検索リンク生成
  - **主要空港**: Place ID使用（成田、羽田、関空、福岡、名古屋、札幌、那覇）
  - **地方空港**: 空港コード直接使用（熊本、長崎、鹿児島、松山、宮崎、高松、石垣など）

### 3. 相談ボット (`unisia-consultation-bot`)
- **URL**: `https://unisia-consultation-bot.onrender.com/webhook`
- **機能**: 海外渡航に関する総合相談、リッチメニュー対応、保険チャットボット

---

## リッチメニュー対応（相談ボット）

### 会話終了条件
- **10分以上返信がない場合** → 会話モードをリセット
- **別のリッチメニューをタップした場合** → 新しいモードに切り替え
- **保険モード中に一般質問が来た場合** → overseas_qaに自動切替

### 各リッチメニューの対応

| メニュー | キーワード | 対応方法 | フロー |
|---------|-----------|---------|-------|
| 海外緊急サポート | `緊急対応サポート`、`いかがなさいましたでしょうか` | 手動 | キューに追加→継続対応 |
| 海外留学相談会 | `lin.ee/ZgWRQ6U`、`海外留学の無料相談` | 誘導 | 別LINE誘導→以降対応なし |
| 帰国後転職サポート | `帰国後転職サポート` | 手動 | キューに追加→継続対応 |
| 海外保険案内サポート | `海外保険の無料相談`、テンプレート形式 | Bot | チャットボット対応 |
| 海外LINEサポート | `海外LINEサポート`、`質問等あれば` | Bot | AI Q&A対応 |
| 格安航空券サポート | ルーティング | Bot | Flight Botへ転送 |

### 保険モードからの自動切替キーワード
以下のキーワードが含まれる場合、overseas_qaに自動切替：
- 気温/天気/気候/季節
- 治安/安全/危険
- 物価/費用/相場
- おすすめ/お店/レストラン/観光
- Wi-Fi/SIM/ネット
- 文化/マナー/言語
- 食事/グルメ/料理

---

## 海外保険チャットボット詳細

### フロー
```
1. リッチメニュータップ
   ↓
2. エルメが自動送信（テンプレート表示）
   ↓
3. ユーザーがテンプレートに記入して送信
   ↓
4. ボットが解析
   ├─ 予算0円 → クレカ質問へ
   └─ 予算あり → 有料保険提案
   ↓
5. (予算0円の場合) クレカ入力
   ↓
6. クレカ付帯保険の活用法を提案
```

### テンプレート入力の検出
- `isInsuranceTemplateInput()` で記入済みテンプレートを最優先検出
- 渡航期間・予算・到着国の3つ全てに値が入っている場合のみ検出
- 空のテンプレート（エルメからの自動送信）は検出しない

### 対応クレジットカード
楽天カード、エポスカード、三井住友カード、JCBカード、セゾンカード、アメックス、dカード、イオンカード

### クレカ活用の提案内容
- 各カードの補償期間・治療費用・条件
- 3枚で最大9ヶ月（270日）カバー可能
- 自動付帯カードの説明
- エポスカードは自動付帯で最強

---

## 海外Q&A機能

### 対応国（10カ国）
アメリカ、フィリピン、韓国、タイ、台湾、ハワイ、グアム、オーストラリア、ベトナム、シンガポール

### 提供情報
- **治安情報**: 危険度、注意エリア、具体的対策、緊急連絡先、ビザ情報
- **気候情報**: ベストシーズン、季節ごとの特徴
- **物価情報**: 食事・ホテル・交通の相場
- **Wi-Fi/SIM**: 購入方法、価格、おすすめキャリア
- **グルメ**: 名物料理、おすすめの店舗・エリア
- **文化/マナー**: 現地のルール、タブー

### 会話の文脈理解
- 「韓国のグルメは？」→「お店を教えて」の流れで韓国の店舗情報を返す
- 会話履歴から国名を自動検出

---

## データベース構造

### conversations テーブル
| カラム | 型 | 説明 |
|--------|-----|------|
| id | INTEGER | 主キー |
| line_user_id | TEXT | LINEユーザーID |
| user_message | TEXT | ユーザーのメッセージ |
| bot_response | TEXT | ボットの応答 |
| timestamp | TEXT | 日時 |

### user_conversation_state テーブル
| カラム | 型 | 説明 |
|--------|-----|------|
| line_user_id | TEXT | LINEユーザーID（UNIQUE） |
| current_mode | TEXT | 現在のモード（idle/insurance/overseas_qa等） |
| mode_data | TEXT | モード固有データ（JSON） |
| last_message_at | TEXT | 最終メッセージ日時 |

### insurance_consultations テーブル
| カラム | 型 | 説明 |
|--------|-----|------|
| line_user_id | TEXT | LINEユーザーID |
| travel_period | TEXT | 渡航期間 |
| budget | TEXT | 予算 |
| destination | TEXT | 目的地 |
| credit_cards | TEXT | 所持クレカ |
| status | TEXT | ステータス |
| recommendation | TEXT | 提案内容 |

### unanswered_questions テーブル
| カラム | 型 | 説明 |
|--------|-----|------|
| id | INTEGER | 主キー |
| line_user_id | TEXT | LINEユーザーID |
| question | TEXT | 質問内容 |
| category | TEXT | カテゴリ |
| status | TEXT | 対応状況 |
| created_at | TEXT | 作成日時 |

### manual_support_queue テーブル
| カラム | 型 | 説明 |
|--------|-----|------|
| line_user_id | TEXT | LINEユーザーID |
| support_type | TEXT | サポート種別（emergency/job_change） |
| initial_message | TEXT | 初期メッセージ |
| status | TEXT | 対応状況 |
| assigned_to | TEXT | 担当者 |
| notes | TEXT | メモ |

---

## GitHub / Render

### リポジトリ
`https://github.com/torai0127/-/`

### Render.comサービス
- `unisia-webhook-proxy`
- `unisia-consultation-bot`
- `unisia-flight-bot`

### 環境変数（Render.com）
| 変数名 | 必要なサービス |
|--------|---------------|
| LINE_CHANNEL_ACCESS_TOKEN | 全て |
| LINE_CHANNEL_SECRET | 全て |
| OPENAI_API_KEY | consultation-bot |
| ELME_WEBHOOK_URL | webhook-proxy |
| CONSULTATION_BOT_URL | webhook-proxy |
| FLIGHT_BOT_URL | webhook-proxy |

---

## エルメ連携

### Webhook URL
`https://cb.lmes.jp/line/callback/add/168878`

### 利用機能
- リッチメニュー
- ステップ配信
- タグによる顧客管理

---

## ファイル構成

### 相談ボット (`unisia-line-bot/`)
```
src/
├── index.ts                    # エントリーポイント
├── line/
│   ├── handler.ts              # メインハンドラー（モード切替ロジック）
│   └── client.ts               # LINEクライアント
├── ai/
│   ├── openai.ts               # AI応答生成、国別情報、FAQ検索
│   └── prompts.ts              # プロンプト定義
├── db/
│   ├── index.ts                # DB初期化
│   ├── conversations.ts        # 会話履歴管理
│   ├── questions.ts            # 質問管理
│   └── conversation-state.ts   # 会話モード管理
└── handlers/
    └── insurance.ts            # 保険チャットボットロジック
```

### 航空券ボット (`unisia-flight-bot/`)
```
src/
├── index.ts                    # エントリーポイント
├── line/
│   ├── handler.ts              # メインハンドラー
│   └── client.ts               # LINEクライアント
├── flight/
│   └── google-flights.ts       # URL生成、空港コード管理
└── db/
    └── index.ts                # DB初期化
```

### Webhookプロキシ (`unisia-webhook-proxy/`)
```
src/
├── index.ts                    # エントリーポイント
└── config/
    └── routes.ts               # ルーティング設定
```

---

## テスト方法

### 相談ボットのテスト
```bash
cd unisia-line-bot
npx tsx test-rich-menu.ts
```

### TypeScriptコンパイルチェック
```bash
npx tsc --noEmit
```

---

## トラブルシューティング

### 問題: リッチメニュー切替が効かない
**原因**: エルメの自動送信メッセージがWebhookに届かない
**解決**: 一般的な海外質問キーワードで自動モード切替を実装

### 問題: 地方空港（熊本等）のリンクが正しく動作しない
**原因**: Place IDがマイナー空港で正しく認識されない
**解決**: 地方空港は空港コード（KMJ等）を直接使用

### 問題: 保険テンプレートが2度送られる
**原因**: キーワード検出が緩すぎて再検出される
**解決**: `isInsuranceTemplateInput()`で記入済みのみ検出

### 問題: Google Flightsリンクが検索フォームに飛ぶ
**原因**: `#flt=`形式のURLが効かない
**解決**: `tfs=`パラメータ（Protocol Buffers + Base64）を使用

---

## 今後の改善点（TODO）
- [ ] 緊急サポートの通知機能（管理者へのプッシュ通知）
- [ ] 保険相談の統計ダッシュボード
- [ ] 未回答質問の学習機能
- [ ] 多言語対応
- [ ] 会話データのCSVエクスポート機能
