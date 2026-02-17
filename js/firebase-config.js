// TODO: 2つのFirebaseプロジェクトの設定に置き換えてください

// 1. 本番環境 (GitHub Pages用)
const firebaseConfigProd = {
    apiKey: "AIzaSyBGvGIeD2rlK4FGZeVX10IUrbNKCbkdVaY",
    authDomain: "kintai-f2c7f.firebaseapp.com",
    projectId: "kintai-f2c7f",
    storageBucket: "kintai-f2c7f.firebasestorage.app",
    messagingSenderId: "452090687947",
    appId: "1:452090687947:web:d794ad91948756145ac64e",
    measurementId: "G-XRYQKKGGM0"
};

// 2. テスト環境 (ローカル開発用: localhost / 127.0.0.1)
const firebaseConfigDev = {
    apiKey: "AIzaSyDoQLL35HsODD1wR4DTAEbvBFGXlo_OG34",
    authDomain: "kintai-test-server.firebaseapp.com",
    projectId: "kintai-test-server",
    storageBucket: "kintai-test-server.firebasestorage.app",
    messagingSenderId: "653500342831",
    appId: "1:653500342831:web:f16e66aa2e815e1248dcda",
    measurementId: "G-HMMLHVD434"
};
// 環境判定ロジック
const hostname = window.location.hostname;
let configToUse;

if (hostname === "localhost" || hostname === "127.0.0.1") {
    console.log("Environment: Development (Test)");
    configToUse = firebaseConfigDev;
} else {
    console.log("Environment: Production");
    configToUse = firebaseConfigProd;
}

// Firebase 初期化
if (!firebase.apps.length) {
    // 設定が空の場合は初期化しない（エラー回避）
    if (configToUse.apiKey !== "YOUR_DEV_API_KEY" && configToUse.apiKey !== "YOUR_PROD_API_KEY") {
        firebase.initializeApp(configToUse);
    } else {
        console.warn("Firebase config is missing for this environment.");
    }
}

// 設定がまだプレースホルダーの場合の警告
function checkConfig() {
    if (configToUse.apiKey.includes("YOUR_")) {
        const envName = (configToUse === firebaseConfigDev) ? "テスト環境 (Dev)" : "本番環境 (Prod)";
        alert(`【注意】${envName} のFirebase設定が完了していません。\njs/firebase-config.js を編集して正しい設定値を入力してください。`);
    }
}

// 初期化されていればDB取得
let db;
if (firebase.apps.length) {
    db = firebase.firestore();
} else {
    // 設定未完了時でもエラーで止まらないように空のオブジェクト等にしておくか、
    // またはチェック関数を呼んでアラートを出す
    checkConfig();
}
