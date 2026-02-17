// TODO: ご自身のFirebaseプロジェクト設定オブジェクトに置き換えてください
// Firebaseコンソール -> プロジェクトを設定 -> 全般 -> マイアプリ から取得できます
const firebaseConfig = {
    apiKey: "AIzaSyBGvGIeD2rlK4FGZeVX10IUrbNKCbkdVaY",
    authDomain: "kintai-f2c7f.firebaseapp.com",
    projectId: "kintai-f2c7f",
    storageBucket: "kintai-f2c7f.firebasestorage.app",
    messagingSenderId: "452090687947",
    appId: "1:452090687947:web:d794ad91948756145ac64e",
    measurementId: "G-XRYQKKGGM0"
};

// Firebase 初期化
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// 設定がプレースホルダーのままか確認するヘルパー
function isConfigured() {
    return firebaseConfig.apiKey !== "YOUR_API_KEY";
}

if (!isConfigured()) {
    console.warn("Firebase not configured! Please update js/firebase-config.js");
    alert("Firebaseの設定が完了していません。js/firebase-config.jsを編集してください。");
}
