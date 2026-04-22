#!/bin/bash
# 統合テストスクリプト

echo "🧪 Unisia LINE Bot 統合テスト"
echo "================================"
echo ""

# ヘルスチェック
echo "📍 Step 1: ヘルスチェック"
echo "---"
echo -n "Proxy (3000): "
curl -s http://localhost:3000/health | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅' if d.get('status')=='ok' else '❌')" 2>/dev/null || echo "❌ Not running"

echo -n "Flight Bot (3001): "
curl -s http://localhost:3001/health | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅' if d.get('status')=='ok' else '❌')" 2>/dev/null || echo "❌ Not running"

echo -n "Consultation Bot (3002): "
curl -s http://localhost:3002/health | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅' if d.get('status')=='ok' else '❌')" 2>/dev/null || echo "❌ Not running"

echo ""
echo "📍 Step 2: ルーティングテスト"
echo "---"

# テスト1: 航空券キーワード
echo -n "「航空券」→ flight bot: "
RESULT=$(curl -s -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"events":[{"type":"message","message":{"type":"text","text":"航空券を探して"},"source":{"type":"user","userId":"test123"},"replyToken":"test"}]}')
echo "$RESULT" | grep -q "success" && echo "✅" || echo "❌"

# テスト2: 留学キーワード
echo -n "「留学」→ consultation bot: "
RESULT=$(curl -s -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"events":[{"type":"message","message":{"type":"text","text":"留学について相談したい"},"source":{"type":"user","userId":"test123"},"replyToken":"test"}]}')
echo "$RESULT" | grep -q "success" && echo "✅" || echo "❌"

# テスト3: リッチメニューPostback
echo -n "Postback(menu_flight_ticket)→ flight: "
RESULT=$(curl -s -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"events":[{"type":"postback","postback":{"data":"menu_flight_ticket"},"source":{"type":"user","userId":"test123"},"replyToken":"test"}]}')
echo "$RESULT" | grep -q "success" && echo "✅" || echo "❌"

# テスト4: Postback保険
echo -n "Postback(menu_insurance)→ consultation: "
RESULT=$(curl -s -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"events":[{"type":"postback","postback":{"data":"menu_insurance"},"source":{"type":"user","userId":"test123"},"replyToken":"test"}]}')
echo "$RESULT" | grep -q "success" && echo "✅" || echo "❌"

echo ""
echo "📍 Step 3: 設定確認"
echo "---"
curl -s -H "x-api-key: test-api-key" http://localhost:3000/api/config 2>/dev/null | python3 -m json.tool 2>/dev/null || echo "設定確認API: 要APIキー"

echo ""
echo "================================"
echo "🎉 テスト完了"
echo ""
echo "次のステップ:"
echo "1. LINE_CHANNEL_ACCESS_TOKEN と LINE_CHANNEL_SECRET を.envに設定"
echo "2. OPENAI_API_KEY を.envに設定"
echo "3. ngrok http 3000 でWebhook公開"
echo "4. LINE DevelopersでWebhook URL設定"
