/**
 * 平文パスワード一括マイグレーションスクリプト
 *
 * 使い方:
 *   1. ブラウザの開発者ツール (F12) を開く
 *   2. 管理画面 (?mode=admin) でログインした状態で Console タブに以下を貼り付ける
 *   3. 実行すると、平文パスワードが残っている従業員を検出し、
 *      ソルト付きSHA-256ハッシュに変換して更新する
 *
 * 注意: このスクリプトは一度だけ実行してください。
 */

// === ここから Console に貼り付け ===

(async () => {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/11.3.0/firebase-app.js');
    const { getFirestore, collection, getDocs, updateDoc, doc } = await import('https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js');

    // Firebase設定（本番の値に置き換えてください）
    const app = initializeApp({
        // .env から取得した値をここに入れる
        apiKey: "YOUR_API_KEY",
        authDomain: "YOUR_AUTH_DOMAIN",
        projectId: "YOUR_PROJECT_ID"
    });
    const db = getFirestore(app);

    // ソルト生成
    function generateSalt() {
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // SHA-256 ハッシュ
    async function sha256(input) {
        const encoder = new TextEncoder();
        const data = encoder.encode(input);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // ソルト付きハッシュ化
    async function hashPassword(password) {
        const salt = generateSalt();
        const hash = await sha256(salt + password);
        return `${salt}:${hash}`;
    }

    console.log('=== 平文パスワード一括マイグレーション開始 ===');

    const snapshot = await getDocs(collection(db, 'employees'));
    let migrated = 0;
    let skipped = 0;
    let noPassword = 0;

    for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const empName = data.name || docSnap.id;

        if (data.password && data.password.trim()) {
            // 平文パスワードが存在 → ハッシュ化して移行
            const hashedPw = await hashPassword(data.password);
            await updateDoc(doc(db, 'employees', docSnap.id), {
                passwordHash: hashedPw,
                password: '' // 平文をクリア
            });
            console.log(`✅ ${empName}: 平文パスワードをハッシュ化しました`);
            migrated++;
        } else if (data.passwordHash) {
            // 既にハッシュ済み
            if (data.passwordHash.includes(':')) {
                console.log(`⏭️ ${empName}: ソルト付きハッシュ済み（スキップ）`);
            } else {
                // 旧形式ハッシュ → ソルト付きに更新（元のパスワードがないため不可）
                console.log(`⚠️ ${empName}: 旧形式ハッシュ（ログイン時に自動移行されます）`);
            }
            skipped++;
        } else {
            console.log(`❌ ${empName}: パスワード未設定`);
            noPassword++;
        }
    }

    console.log('=== マイグレーション完了 ===');
    console.log(`移行: ${migrated} 件, スキップ: ${skipped} 件, 未設定: ${noPassword} 件`);
})();

// === ここまで ===
