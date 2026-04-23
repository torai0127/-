# 管理スクリプト

## データエクスポート

LINE会話データをCSVまたはJSONでエクスポートします。

```bash
# 全てエクスポート（CSV）
npx tsx scripts/export-data.ts --all

# JSON形式で
npx tsx scripts/export-data.ts --all --format=json

# 会話履歴のみ
npx tsx scripts/export-data.ts --conversations

# 未回答質問のみ
npx tsx scripts/export-data.ts --questions

# 保険相談データのみ
npx tsx scripts/export-data.ts --insurance

# 手動対応キューのみ
npx tsx scripts/export-data.ts --manual

# 過去7日分のみ
npx tsx scripts/export-data.ts --all --days=7
```

エクスポートファイルは `exports/` フォルダに保存されます。

## 統計レポート

会話データの統計を表示します。

```bash
npx tsx scripts/stats.ts
```

表示内容：
- 会話総数・ユニークユーザー数
- 本日・過去7日間の会話数
- 未回答質問のカテゴリ別集計
- 会話モード別ユーザー数
- 保険相談の人気渡航先
- 手動対応キューの状況
- 日別会話数グラフ
