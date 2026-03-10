---
description: Firebase へのデプロイ手順（hosting + firestore rules）
---

# Firebase デプロイ

プロジェクトの変更を Git にコミット・プッシュし、Firebase にデプロイする手順です。

## 手順

// turbo-all

1. 変更を Git にステージングする:
```powershell
& "C:\Program Files\Git\cmd\git.exe" add -A
```

2. コミットする（メッセージは変更内容に応じて適切に設定すること）:
```powershell
& "C:\Program Files\Git\cmd\git.exe" commit -m "変更内容の要約"
```

3. リモートにプッシュする:
```powershell
& "C:\Program Files\Git\cmd\git.exe" push
```

4. Firebase Hosting と Firestore ルールをデプロイする:
```
npx -y firebase-tools@latest deploy
```

## 注意事項
- `sw.js` の `CACHE_NAME` バージョンを更新してからデプロイすること
- コミットメッセージは日本語で変更内容を具体的に記載すること
- デプロイ先: `kintai-f2c7f`
