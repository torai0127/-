# Unisia Flight Bot システムメモ

## 最終更新: 2026-04-24

---

## 航空券検索ボット（エルメ連携）

### 概要
- LINEボット（エルメ経由）で航空券検索リンクを生成
- ホスト: Render (unisia-flight-bot.onrender.com)
- リポジトリ: github.com/torai0127/-

### URL生成方式

**採用方式: `q=`パラメータ（自然言語クエリ）**

```
https://www.google.com/travel/flights?q=Flights%20from%20KMJ%20to%20KIX%20on%202026-05-24%20through%202026-05-25%201%20adults&curr=JPY&hl=ja
```

**理由:**
- `tfs=`パラメータ（Protocol Buffers + Base64）は地方空港（KMJ等）で出発地が認識されない問題があった
- `q=`パラメータはシンプルで、Google Flightsが正しく解析できる

### 日付解析パターン

| 入力例 | 解析結果 |
|--------|---------|
| 「5月24〜25」「5月24日〜25日」 | departureDate: 05-24, returnDate: 05-25 |
| 「5月24日」 | departureDate: 05-24（具体的な日付） |
| 「5月」 | 5/1〜5/31の中央（5/15頃）を出発日に設定 |
| 「5月上旬」「5月頭」 | 5/1〜5/10の中央を出発日に設定 |
| 「5月中旬」 | 5/11〜5/20の中央を出発日に設定 |
| 「5月下旬」「5月末」 | 5/21〜月末の中央を出発日に設定 |

### 2026-04-24 修正履歴

1. **日付解析バグ修正**
   - 「5月24日」と入力しても日にちが無視されるバグを修正
   - 月だけでなく日にちも正しく抽出するよう修正

2. **日付範囲パターン追加**
   - 「5月24〜25」形式を認識するよう追加
   - `[〜~ー－\-]` で様々な区切り文字に対応

3. **URL生成方式変更**
   - `tfs=`パラメータ → `q=`パラメータに変更
   - 地方空港でも確実に検索結果が表示されるように

### 主要ファイル

- `src/line/handler.ts` - LINE Webhookハンドラ、日付解析ロジック
- `src/flight/google-flights.ts` - URL生成、空港コード変換
- `src/ai/openai.ts` - OpenAIによるパラメータ抽出

### 空港コード対応

日本の主要空港は `AIRPORT_CODES` で定義済み:
- 熊本 → KMJ
- 大阪 → KIX
- 東京 → NRT
- 福岡 → FUK
- 札幌 → CTS
- 那覇 → OKA
- その他多数

### テスト方法

```bash
cd projects/unisia-flight-bot
npm run build
node -e "
const { generateGoogleFlightsQueryUrl, getAirportCode } = require('./dist/flight/google-flights.js');
console.log(getAirportCode('大阪')); // KIX
console.log(generateGoogleFlightsQueryUrl({
  origin: '熊本',
  destination: '大阪',
  departureDate: '2026-05-24',
  returnDate: '2026-05-25',
  adults: 1,
  tripType: 'round_trip',
}));
"
```

---

## 過去の問題と解決策

### 問題: Google Flightsリンクが検索フォームに飛ぶ

**原因**: `tfs=`パラメータ（Protocol Buffers + Base64）で地方空港のエンコードが正しくない

**解決**: `q=`パラメータ（自然言語クエリ）を使用
```
?q=Flights from KMJ to KIX on 2026-05-24 through 2026-05-25 1 adults
```

### 問題: 日付が21日固定になる

**原因**: 
1. 「5月24日」から日にちを抽出せず月だけ取得
2. `departureDateEnd`に常に14日加算されるバグ

**解決**: 
1. `(\d+)月\s*(\d+)日` パターンで日にちも抽出
2. 条件分岐を修正して不要な加算を防止
