// 状態
let currentEmployee = null;

// DOM 要素
const screens = {
    selection: document.getElementById('screen-employee-selection'),
    admin: document.getElementById('screen-admin'),
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
        // 画面変更フックを呼び出し (attendance.jsで定義)
        if (typeof onScreenChanged === 'function') {
            onScreenChanged(screenId);
        }
    }

    // 「戻る」ボタンの表示制御
    if (screenId === 'selection') {
        navBackBtn.classList.add('hidden');
        currentEmployee = null; // 選択リセット
    } else {
        navBackBtn.classList.remove('hidden');
    }
}

// イベントリスナー
navBackBtn.addEventListener('click', () => {
    // 戻るボタンのロジックは現在の画面に依存するが、
    // 簡易版として常に選択画面(ホーム)に戻る
    showScreen('selection');
});

// URLパラメータによる管理者アクセスチェック
function checkAdminAccess() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mode') === 'admin') {
        showScreen('admin');
        loadAdminData(); // admin.js で定義
        return true;
    }
    return false;
}

// document.getElementById('btn-go-admin').addEventListener('click', () => {
//     showScreen('admin');
//     loadAdminData(); // admin.js で定義
// });

// 従業員選択から特定ページへ遷移
function selectEmployee(employee) {
    currentEmployee = employee;

    // ラベル更新
    document.getElementById('ts-employee-name').textContent = `${employee.name} さん`;
    document.getElementById('app-employee-name').textContent = `${employee.name} さんの申請`;

    // デフォルトで打刻画面を表示
    showScreen('timeStamp');
}

// グローバル初期化
document.addEventListener('DOMContentLoaded', () => {
    loadEmployeesForSelection(); // admin.js で定義 (共有ロジック)
    if (!checkAdminAccess()) {
        // 管理者モードでない場合、デフォルトで選択画面を表示（ここで履歴読み込みもトリガーされる）
        showScreen('selection');
    }
});

// 日付入力用に今日の日付文字列を取得するユーティリティ
function getTodayDateString() {
    return new Date().toISOString().split('T')[0];
}

document.getElementById('application-date').value = getTodayDateString();

document.getElementById('btn-go-application').addEventListener('click', () => {
    showScreen('application');
});
