# OpenAI API 設定手順

## 1. OpenAIアカウント作成

1. [OpenAI Platform](https://platform.openai.com/) にアクセス
2. 「Sign up」でアカウント作成（Googleアカウント連携も可能）
3. 電話番号認証を完了

## 2. APIキーの取得

1. ログイン後、右上のアカウントアイコンをクリック
2. 「API keys」を選択
3. 「Create new secret key」をクリック
4. 名前を入力: `unisia-line-bot`
5. 「Create secret key」をクリック
6. 表示されたキーをコピー → `.env` の `OPENAI_API_KEY` に貼り付け

> ⚠️ キーは一度しか表示されません！必ずコピーして安全な場所に保存

## 3. 支払い設定

1. 左メニューの「Settings」→「Billing」
2. 「Add payment method」でクレジットカードを登録
3. 「Set up prepaid billing」で前払い設定

### 料金の目安
- GPT-4o-mini: $0.15 / 100万入力トークン
- 1回の会話で約500〜1000トークン使用
- 月1000件の会話で約$1〜2程度

## 4. 使用量制限の設定（推奨）

1. 「Settings」→「Limits」
2. 「Set a monthly budget」で月額上限を設定
   - 例: $10/月 で設定
3. 「Usage alerts」でアラート設定
   - 例: $5で通知

---

## 確認チェックリスト

- [ ] OpenAIアカウント作成完了
- [ ] APIキー取得 → `.env`に設定
- [ ] 支払い方法設定
- [ ] 月額上限設定（推奨）

---

## トラブルシューティング

### "You exceeded your current quota"
- 支払い設定が完了していない
- 月額上限に達した
- 解決: Billing設定を確認

### "Invalid API key"
- キーが正しくコピーされていない
- キーが削除/無効化されている
- 解決: 新しいキーを発行

### レスポンスが遅い
- API側の混雑
- モデルを `gpt-4o-mini` に変更（既に設定済み）
