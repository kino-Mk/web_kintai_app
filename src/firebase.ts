import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// オフライン永続化の有効化
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
        // 複数タブで開いている場合などは失敗するが、動作には支障なし
        console.warn('Firestore persistence failed-precondition: Multiple tabs open?');
    } else if (err.code === 'unimplemented') {
        // ブラウザがサポートしていない場合
        console.warn('Firestore persistence unimplemented: Browser not supported');
    }
});

