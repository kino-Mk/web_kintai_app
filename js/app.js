// 状態
let currentEmployee = null;

// DOM 要素
const screens = {
    selection: document.getElementById('screen-employee-selection'),
    admin: document.getElementById('screen-admin'),
    'admin-employees': document.getElementById('screen-admin-employees'),
    'admin-attendance': document.getElementById('screen-admin-attendance'),
    'admin-calendar': document.getElementById('screen-admin-calendar'),
    'admin-rate-overview': document.getElementById('screen-admin-rate-overview'),
    'admin-employee-detail': document.getElementById('screen-admin-employee-detail'),
    'admin-error-logs': document.getElementById('screen-admin-error-logs'),
    timeStamp: document.getElementById('screen-time-stamp'),
    application: document.getElementById('screen-application')
};

const navBackBtn = document.getElementById('nav-back-btn');

// ナビゲーション関数
function showScreen(screenId) {
    // 全画面を非表示
    Object.values(screens).forEach(screen => {
        screen.classList.remove('active');
        screen.classList.add('hidden');
    });

    // ターゲット画面を表示
    const target = screens[screenId];
    if (target) {
        target.classList.remove('hidden');
        target.classList.add('active');

        // 管理者モードのクラス制御 (PC最適化用)
        const appContainer = document.getElementById('app');
        if (screenId.startsWith('admin')) {
            appContainer.classList.add('admin-mode');
        } else {
            appContainer.classList.remove('admin-mode');
        }

        // 画面変更フックを呼び出し (attendance.jsで定義)
        if (typeof onScreenChanged === 'function') {
            onScreenChanged(screenId);
        }
    }

    // 「戻る」ボタンの表示制御
    // ホーム（従業員選択画面）と管理者メニューのトップ画面では表示しない
    if (screenId === 'selection' || screenId === 'admin') {
        navBackBtn.classList.add('hidden');
        if (screenId === 'selection') currentEmployee = null; // 選択リセット
    } else {
        navBackBtn.classList.remove('hidden');
    }
}

// イベントリスナー
navBackBtn.addEventListener('click', () => {
    // 現在アクティブな画面を取得
    const activeScreen = Object.keys(screens).find(key => screens[key].classList.contains('active'));

    if (activeScreen === 'admin-employee-detail') {
        showScreen('admin-employees');
    } else if (activeScreen === 'admin-employees' || activeScreen === 'admin-attendance' || activeScreen === 'admin-calendar' || activeScreen === 'admin-rate-overview' || activeScreen === 'admin-error-logs') {
        showScreen('admin');
    } else if (activeScreen === 'application') {
        showScreen('timeStamp');
    } else if (activeScreen === 'admin' || activeScreen === 'timeStamp') {
        showScreen('selection');
    } else {
        showScreen('selection');
    }
});

// URLパラメータによる管理者アクセスチェック
function checkAdminAccess() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mode') === 'admin') {
        showScreen('admin');
        return true;
    }
    return false;
}

// 従業員選択から特定ページへ遷移
function selectEmployee(employee) {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (isMobile) {
        // スマホの場合はパスワード入力を求める
        openPasswordModal(employee);
    } else {
        // PC等の場合は即座に遷移
        finalizeEmployeeSelection(employee);
    }
}

// パスワード確認後に実行される最終的な遷移処理
function finalizeEmployeeSelection(employee) {
    currentEmployee = employee;

    // ラベル更新
    document.getElementById('ts-employee-name').textContent = `${employee.name} さん`;
    const appEmpName = document.getElementById('app-employee-name');
    if (appEmpName) appEmpName.textContent = `${employee.name} さんの申請`;

    // デフォルトで打刻画面を表示
    showScreen('timeStamp');
}

// パスワードモーダル制御
let pendingSelectionEmployee = null;

function openPasswordModal(employee) {
    pendingSelectionEmployee = employee;
    document.getElementById('modal-emp-name').textContent = `${employee.name} さん`;
    document.getElementById('modal-password-input').value = '';
    document.getElementById('modal-error-msg').classList.add('hidden');
    document.getElementById('password-modal').classList.remove('hidden');
    document.getElementById('modal-password-input').focus();
}

function closePasswordModal() {
    document.getElementById('password-modal').classList.add('hidden');
    pendingSelectionEmployee = null;
}

// モーダルイベント設定
document.getElementById('btn-modal-cancel').addEventListener('click', closePasswordModal);

document.getElementById('btn-modal-submit').addEventListener('click', () => {
    const inputPass = document.getElementById('modal-password-input').value;
    const correctPass = pendingSelectionEmployee.password || '';
    const errorMsg = document.getElementById('modal-error-msg');

    // パスワードが未設定の場合
    if (!correctPass) {
        errorMsg.textContent = 'パスワードが設定されていません。管理者に設定を依頼してください。';
        errorMsg.classList.remove('hidden');
        return;
    }

    // パスワード照合
    if (inputPass === correctPass) {
        const emp = pendingSelectionEmployee;
        closePasswordModal();
        finalizeEmployeeSelection(emp);
    } else {
        errorMsg.textContent = 'パスワードが正しくありません';
        errorMsg.classList.remove('hidden');
        document.getElementById('modal-password-input').value = '';
        document.getElementById('modal-password-input').focus();
    }
});

// Enterキーでの認証
document.getElementById('modal-password-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('btn-modal-submit').click();
    }
});

// --- パスワードリセット申請 ---

// GAS WebApp URL
const GAS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbzz2AyAjBQFQhL2sofqH0woLy-KA9tH201r0cIDHd2RGgwMgEZjQym3yXSxIWwhjf4c/exec';

// 「パスワードを忘れた方はこちら」リンク
document.getElementById('link-forgot-password').addEventListener('click', (e) => {
    e.preventDefault();
    // パスワード入力画面を隠してリセット画面を表示
    document.getElementById('password-input-view').classList.add('hidden');
    document.getElementById('password-reset-view').classList.remove('hidden');
    document.getElementById('reset-emp-id-input').value = '';
    document.getElementById('reset-email-input').value = '';
    document.getElementById('reset-status-msg').classList.add('hidden');
    document.getElementById('reset-emp-id-input').focus();
});

// リセット画面の「戻る」ボタン
document.getElementById('btn-reset-back').addEventListener('click', () => {
    document.getElementById('password-reset-view').classList.add('hidden');
    document.getElementById('password-input-view').classList.remove('hidden');
    document.getElementById('modal-password-input').focus();
});

// リセット画面の「送信」ボタン
document.getElementById('btn-reset-send').addEventListener('click', async () => {
    const empId = document.getElementById('reset-emp-id-input').value.trim();
    const inputEmail = document.getElementById('reset-email-input').value.trim();
    const statusMsg = document.getElementById('reset-status-msg');
    const sendBtn = document.getElementById('btn-reset-send');

    if (!empId || !inputEmail) {
        statusMsg.textContent = '従業員IDとメールアドレスの両方を入力してください。';
        statusMsg.style.background = '#fff3cd';
        statusMsg.style.color = '#856404';
        statusMsg.classList.remove('hidden');
        return;
    }

    // ボタンを無効化
    sendBtn.disabled = true;
    sendBtn.textContent = '送信中...';
    statusMsg.classList.add('hidden');

    try {
        // 1. Firestoreから従業員情報を取得して照合
        const empDoc = await db.collection('employees').doc(empId).get();
        if (!empDoc.exists) {
            statusMsg.textContent = '従業員IDまたはメールアドレスが正しくありません。';
            statusMsg.style.background = '#f8d7da';
            statusMsg.style.color = '#721c24';
            statusMsg.classList.remove('hidden');
            sendBtn.disabled = false;
            sendBtn.textContent = '送信';
            return;
        }

        const empData = empDoc.data();
        const registeredEmail = (empData.email || '').toLowerCase();

        if (!registeredEmail || registeredEmail !== inputEmail.toLowerCase()) {
            statusMsg.textContent = '従業員IDまたはメールアドレスが正しくありません。';
            statusMsg.style.background = '#f8d7da';
            statusMsg.style.color = '#721c24';
            statusMsg.classList.remove('hidden');
            sendBtn.disabled = false;
            sendBtn.textContent = '送信';
            return;
        }

        // 2. トークン生成 (64文字のランダム英数字)
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let token = '';
        for (let i = 0; i < 64; i++) {
            token += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        // 3. トークンをFirestoreに保存（有効期限: 1時間）
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1);

        await db.collection('passwordResetTokens').add({
            empId: empId,
            token: token,
            expiresAt: firebase.firestore.Timestamp.fromDate(expiresAt),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 4. GASにメール送信をリクエスト
        const response = await fetch(GAS_WEBAPP_URL, {
            method: 'POST',
            body: JSON.stringify({
                empId: empId,
                email: registeredEmail,
                token: token,
                empName: empData.name || empId
            })
        });

        const result = await response.json();

        if (result.success) {
            statusMsg.textContent = 'リセットリンクを送信しました。メールをご確認ください。';
            statusMsg.style.background = '#d4edda';
            statusMsg.style.color = '#155724';
        } else {
            statusMsg.textContent = result.message || 'メール送信に失敗しました。';
            statusMsg.style.background = '#f8d7da';
            statusMsg.style.color = '#721c24';
        }
    } catch (error) {
        console.error('Reset request error:', error);
        statusMsg.textContent = 'エラーが発生しました: ' + error.message;
        statusMsg.style.background = '#f8d7da';
        statusMsg.style.color = '#721c24';
    } finally {
        statusMsg.classList.remove('hidden');
        sendBtn.disabled = false;
        sendBtn.textContent = '送信';
    }
});

// リセット画面のEnterキー対応
document.getElementById('reset-email-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('btn-reset-send').click();
    }
});

// グローバル初期化
document.addEventListener('DOMContentLoaded', () => {
    loadEmployeesForSelection(); // admin.js で定義 (共有ロジック)
    initAttendanceTracker();    // attendance.js で定義

    // 勤怠申請ボタンの表示制御 (モバイル端末のみ表示)
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const goAppBtn = document.getElementById('btn-go-application');
    const clockInBtn = document.getElementById('btn-clock-in');
    const clockOutBtn = document.getElementById('btn-clock-out');

    if (isMobile) {
        // モバイル: 打刻ボタンを隠し、申請ボタンを大きく表示
        if (clockInBtn) clockInBtn.classList.add('hidden');
        if (clockOutBtn) clockOutBtn.classList.add('hidden');
        if (goAppBtn) {
            goAppBtn.classList.remove('btn-secondary');
            goAppBtn.classList.add('btn-go-app-large');
        }
        // モバイル: 打刻修正申請ボタンを非表示
        const stampCorrBtn = document.getElementById('btn-stamp-correction');
        if (stampCorrBtn) stampCorrBtn.classList.add('hidden');
    } else {
        // PC: 申請ボタンを隠す
        if (goAppBtn) goAppBtn.classList.add('hidden');
    }

    // 日付入力の初期値設定
    const dateInput = document.getElementById('application-date');
    if (dateInput) {
        dateInput.value = formatDate(new Date());
    }

    if (!checkAdminAccess()) {
        showScreen('selection');
    }
});

document.getElementById('btn-go-application').addEventListener('click', () => {
    showScreen('application');
});

// PWA Service Worker 登録と強力なキャッシュクリアロジック
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').then(reg => {
            // ブラウザのキャッシュを無視して、sw.jsのアップデートがないか毎回確認する
            reg.update();

            // 更新が見つかった場合の処理
            reg.onupdatefound = () => {
                const installingWorker = reg.installing;
                installingWorker.onstatechange = () => {
                    if (installingWorker.state === 'installed') {
                        if (navigator.serviceWorker.controller) {
                            // 新しいコンテンツが利用可能になった
                            console.log('New content is available; purging cache and reloading...');

                            // キャッシュを強制的に全削除してからリロードする
                            if ('caches' in window) {
                                caches.keys().then(names => {
                                    Promise.all(names.map(name => caches.delete(name)))
                                        .then(() => {
                                            window.location.reload(true); // キャッシュを無視してリロード
                                        });
                                });
                            } else {
                                window.location.reload(true);
                            }
                        }
                    }
                };
            };
        });
    });

    // Service Workerが更新されたら自動的にリロードして最新版を適用
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
            window.location.reload(true);
            refreshing = true;
        }
    });
}
