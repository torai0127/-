# Postbackデータ リファレンス

フラットサポートのリッチメニューに設定するPostbackデータの一覧。

## リッチメニュー配置

```
┌─────────────────┬─────────────────┬─────────────────┐
│ 格安購入券      │ 海外保険案内    │ 海外LINE       │
│ サポート        │ サポート        │ サポート        │
│                 │                 │                 │
│ menu_flight_    │ menu_insurance  │ menu_line_      │
│ ticket          │                 │ support         │
│                 │                 │                 │
│ → 航空券ボット  │ → 相談ボット    │ → 相談ボット    │
├─────────────────┼─────────────────┼─────────────────┤
│ 帰国後転職      │ 海外留学無料    │ 海外緊急対応    │
│ サポート        │ 相談会          │                 │
│                 │                 │                 │
│ menu_job_       │ menu_study_     │ menu_emergency  │
│ support         │ abroad          │                 │
│                 │                 │                 │
│ → 相談ボット    │ → 相談ボット    │ → 相談ボット    │
└─────────────────┴─────────────────┴─────────────────┘
```

## コピペ用 Postbackデータ

### 航空券ボットへ転送

```
menu_flight_ticket
```

### 相談ボットへ転送

```
menu_insurance
menu_line_support
menu_job_support
menu_study_abroad
menu_emergency
```

### Lステップ/エルメへ転送（上部タブ）

```
tab_advance
tab_premium
tab_other
```

## 振り分け早見表

| ボタン | Postbackデータ | 転送先 |
|--------|---------------|--------|
| 格安購入券サポート | `menu_flight_ticket` | ✈️ 航空券ボット |
| 海外保険案内サポート | `menu_insurance` | 🌍 相談ボット |
| 海外LINEサポート | `menu_line_support` | 🌍 相談ボット |
| 帰国後転職サポート | `menu_job_support` | 🌍 相談ボット |
| 海外留学無料 相談会 | `menu_study_abroad` | 🌍 相談ボット |
| 海外緊急対応 | `menu_emergency` | 🌍 相談ボット |
| アドバンス プラン | `tab_advance` | 📋 Lステップ/エルメ |
| プレミアム プラン | `tab_premium` | 📋 Lステップ/エルメ |
| その他質問 | `tab_other` | 📋 Lステップ/エルメ |

## Lステップ/エルメでの設定方法

### Lステップの場合

リッチメニューのアクション設定で：
1. 「ポストバック」を選択
2. データ欄に上記のPostbackデータを入力

### エルメの場合

同様にポストバックアクションで設定。

### 注意点

- Lステップ/エルメのリッチメニュー機能を使う場合も、
  Postbackデータを上記の値にすれば中継サーバーが正しく振り分けます
- LINE Official Account Managerで直接設定する場合も同様
