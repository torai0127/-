#!/bin/bash
# GitHubにプッシュするスクリプト
# 使用前にGitHubでリポジトリを作成してください

# 設定（GitHubユーザー名を入力）
GITHUB_USER="YOUR_GITHUB_USERNAME"

# 1. Webhook Proxy
cd "$(dirname "$0")/unisia-webhook-proxy"
git remote add origin "https://github.com/${GITHUB_USER}/unisia-webhook-proxy.git"
git branch -M main
git push -u origin main
echo "✅ unisia-webhook-proxy pushed"

# 2. Consultation Bot
cd "$(dirname "$0")/unisia-line-bot"
git remote add origin "https://github.com/${GITHUB_USER}/unisia-consultation-bot.git"
git branch -M main
git push -u origin main
echo "✅ unisia-consultation-bot pushed"

# 3. Flight Bot
cd "$(dirname "$0")/unisia-flight-bot"
git remote add origin "https://github.com/${GITHUB_USER}/unisia-flight-bot.git"
git branch -M main
git push -u origin main
echo "✅ unisia-flight-bot pushed"

echo ""
echo "🎉 All repositories pushed to GitHub!"
echo ""
echo "Next steps:"
echo "1. Go to https://render.com"
echo "2. Create 3 Web Services from these repos"
echo "3. Set environment variables"
