# 航空券価格比較API セットアップガイド

このガイドでは、複数サイトからの航空券価格取得に必要なAPIの登録手順を説明します。

---

## 必要なAPI

| API | 用途 | 料金 | 優先度 |
|-----|------|------|--------|
| **RapidAPI (Sky Scrapper)** | Skyscannerの実際の価格取得 | 無料枠100回/月、$10/月で1000回 | ⭐必須 |
| **Travelpayouts** | アフィリエイト収益化、Trip.com連携 | 無料 | 推奨 |

---

## 1. RapidAPI (Sky Scrapper) の登録

Skyscannerの航空券価格をリアルタイムで取得するために必要です。

### 登録手順

1. **RapidAPIアカウント作成**
   - https://rapidapi.com/ にアクセス
   - 「Sign Up」からアカウント作成（Googleアカウントでも可）

2. **Sky Scrapper APIを検索**
   - 検索バーで「Sky Scrapper」を検索
   - または直接アクセス: https://rapidapi.com/apiheya/api/sky-scrapper

3. **APIを購読**
   - 「Pricing」タブをクリック
   - 「Basic」プラン（無料）の「Subscribe」をクリック
   - 支払い情報を入力（無料枠内なら課金されません）

4. **APIキーを取得**
   - 「Endpoints」タブに戻る
   - 右側のコードスニペット欄にある `X-RapidAPI-Key` をコピー

5. **環境変数に設定**
   ```bash
   RAPIDAPI_KEY=your_rapidapi_key_here
   ```

### 料金プラン

| プラン | 月額 | リクエスト数 |
|--------|------|--------------|
| Basic | 無料 | 100回/月 |
| Pro | $10 | 1,000回/月 |
| Ultra | $50 | 10,000回/月 |

> 💡 1回の検索で約2〜3リクエストを消費します（空港検索 + フライト検索）

---

## 2. Travelpayouts の登録

アフィリエイト収益化とTrip.com等のデータ取得に使用します。

### 登録手順

1. **Travelpayoutsアカウント作成**
   - https://www.travelpayouts.com/ にアクセス
   - 「Join」または「Sign Up」からアカウント作成

2. **プログラムに参加**
   - ダッシュボードで「Programs」→「Aviasales」を探す
   - 「Join」をクリック

3. **Trip.comプログラムに参加**
   - 「Programs」で「Trip.com」を検索
   - 「Join」をクリック

4. **APIトークンを取得**
   - 「Tools」→「API」に移動
   - 「Data Access API」のトークンをコピー

5. **マーカーIDを取得**
   - ダッシュボードの「Tools」→「White Label」
   - または「Developers」→「API」でマーカーIDを確認

6. **環境変数に設定**
   ```bash
   TRAVELPAYOUTS_TOKEN=your_token_here
   TRAVELPAYOUTS_MARKER=your_marker_id_here
   ```

### アフィリエイト報酬

| サービス | 報酬率 |
|----------|--------|
| Trip.com 国際航空券 | 1%〜 |
| Trip.com ホテル | 5%〜7% |
| Aviasales | 〜50%（クリックあたり） |

---

## 3. 環境変数の設定

`.env` ファイルに以下を追加：

```bash
# RapidAPI (Sky Scrapper)
RAPIDAPI_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Travelpayouts
TRAVELPAYOUTS_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxx
TRAVELPAYOUTS_MARKER=123456
```

---

## 4. 動作確認

### コマンドラインでテスト

```bash
# RapidAPI のテスト
curl --request GET \
  --url 'https://sky-scrapper.p.rapidapi.com/api/v1/flights/searchAirport?query=Tokyo&locale=ja-JP' \
  --header 'X-RapidAPI-Key: YOUR_RAPIDAPI_KEY' \
  --header 'X-RapidAPI-Host: sky-scrapper.p.rapidapi.com'
```

### Botでテスト

LINEで以下のようなメッセージを送信：

```
いきたい地域: セブ
いきたい時期: 6月15日〜20日
人数: 2人
出発: 福岡
```

期待される応答：
- 最安値の価格（Skyscanner調べ）
- Google Flightsのリンク
- Skyscannerで購入リンク（価格付き）
- 他サイトの比較リンク

---

## トラブルシューティング

### APIキーが認識されない

```bash
# 環境変数が設定されているか確認
echo $RAPIDAPI_KEY
echo $TRAVELPAYOUTS_TOKEN
```

### 価格が取得できない

1. APIキーが正しいか確認
2. 無料枠の上限に達していないか確認（RapidAPIダッシュボードで確認）
3. ネットワーク接続を確認

### レスポンスが遅い

- Skyscanner APIは5〜15秒かかることがあります
- タイムアウト設定を確認（デフォルト: 15秒）

---

## 対応サイト一覧

現在の実装で対応しているサイト：

| サイト | 価格取得 | リンク生成 | アフィリエイト |
|--------|----------|------------|----------------|
| Google Flights | ❌ | ✅ | ❌ |
| Skyscanner | ✅ | ✅ | ✅ |
| Trip.com | ⚠️参考価格 | ✅ | ✅ |
| エアトリ | ❌ | ✅ | ❌ |
| トラベルコ | ❌ | ✅ | ❌ |
| スカイチケット | ❌ | ✅ | ❌ |
| さくらトラベル | ❌ | ✅ | ❌ |
| Kayak | ❌ | ✅ | ❌ |
| Momondo | ❌ | ✅ | ❌ |
| Kiwi.com | ❌ | ✅ | ❌ |
| eDreams | ❌ | ✅ | ❌ |

> ⚠️ 他サイトの価格取得は、公式APIがないためリンク生成のみとなります

---

## 今後の拡張予定

- [ ] Trip.com Affiliate API での価格取得
- [ ] Kayak Partner API（申請中）
- [ ] アフィリエイトリンクのトラッキング機能
