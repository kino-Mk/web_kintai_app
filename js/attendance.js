// js/attendance.js
console.log("attendance.js loaded");

// DBの初期化チェック
if (typeof db === 'undefined') {
    console.error("Firestore 'db' is not initialized. Check firebase-config.js.");
    alert("データベース接続エラー: 設定ファイル(firebase-config.js)を確認してください。");
}

// --- 打刻機能 ---

function handleStamp(type) {
    if (!currentEmployee) {
        alert("従業員が選択されていません");
        return;
    }

    const confirmMsg = type === 'in' ? '出勤しますか？' : '退勤しますか？';
    if (!confirm(confirmMsg)) return;

    db.collection("attendance").add({
        empId: currentEmployee.id,
        empName: currentEmployee.name,
        type: type, // 'in' or 'out'
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    })
        .then(() => {
            alert(type === 'in' ? "出勤しました" : "退勤しました");
            // オプション: 打刻成功後にホームへ戻る
            showScreen('selection');
        })
        .catch((error) => {
            console.error("Error stamping:", error);
            alert("打刻に失敗しました: " + error.message);
        });
}

document.getElementById('btn-clock-in').addEventListener('click', () => handleStamp('in'));
document.getElementById('btn-clock-out').addEventListener('click', () => handleStamp('out'));


// --- 申請機能 ---

document.getElementById('btn-submit-application').addEventListener('click', () => {
    if (!currentEmployee) {
        alert("従業員が選択されていません");
        return;
    }

    const type = document.getElementById('application-type').value;
    const date = document.getElementById('application-date').value;
    const reason = document.getElementById('application-reason').value;

    if (!date) {
        alert("日付を選択してください");
        return;
    }

    if (confirm(`${type}申請を行いますか？`)) {
        db.collection("applications").add({
            empId: currentEmployee.id,
            empName: currentEmployee.name,
            type: type,
            date: date,
            reason: reason,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        })
            .then(() => {
                alert("申請しました");
                // フォームをクリア
                document.getElementById('application-reason').value = "";
                showScreen('selection');
            })
            .catch((error) => {
                console.error("Error submitting application:", error);
                alert("申請に失敗しました: " + error.message);
            });
    }
});


// --- 履歴表示機能 ---

// 今日の開始時刻を取得 (00:00:00)
function getStartOfToday() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
}

// 画面表示時のフック
function onScreenChanged(screenId) {
    console.log("onScreenChanged called with:", screenId);
    if (screenId === 'selection') {
        loadTodayHistoryAll();
    } else if (screenId === 'timeStamp' && currentEmployee) {
        loadTodayHistoryPersonal(currentEmployee.id);
    }
}

// 1. 全体の本日の打刻履歴 (選択画面用)
function loadTodayHistoryAll() {
    console.log("loadTodayHistoryAll called");
    if (!db) {
        console.error("DB not ready");
        return;
    }
    const list = document.getElementById('today-history-list-all');
    list.innerHTML = '<li class="loading-text">読み込み中...</li>';

    const start = getStartOfToday();

    db.collection("attendance")
        .where("timestamp", ">=", start)
        .orderBy("timestamp", "desc")
        .limit(20) // 最新20件
        .onSnapshot((snapshot) => {
            list.innerHTML = "";
            if (snapshot.empty) {
                list.innerHTML = "<li>本日の打刻はありません</li>";
                return;
            }

            snapshot.forEach(doc => {
                const data = doc.data();
                renderHistoryItem(list, data, true); // true = show name
            });
        }, (error) => {
            console.error("Error loading all history:", error);
            list.innerHTML = "<li>読み込みエラー</li>";
        });
}

// 2. 個人の本日の打刻履歴 (打刻画面用)
function loadTodayHistoryPersonal(empId) {
    const list = document.getElementById('today-history-list-personal');
    list.innerHTML = '<li class="loading-text">読み込み中...</li>';

    const start = getStartOfToday();

    db.collection("attendance")
        .where("empId", "==", empId)
        .where("timestamp", ">=", start)
        .orderBy("timestamp", "desc")
        .onSnapshot((snapshot) => {
            list.innerHTML = "";
            if (snapshot.empty) {
                list.innerHTML = "<li>本日の打刻はありません</li>";
                return;
            }

            snapshot.forEach(doc => {
                const data = doc.data();
                renderHistoryItem(list, data, false); // false = hide name (already known)
            });
        }, (error) => {
            console.error("Error loading personal history:", error);
            list.innerHTML = "<li>読み込みエラー: インデックスが必要な可能性があります</li>";
            // 複合クエリ (empId + timestamp range) はFirestoreでインデックスが必要になる場合があります
            // コンソールにリンクが表示されるので作成してください
        });
}

function renderHistoryItem(container, data, showName) {
    const li = document.createElement('li');
    const date = data.timestamp ? data.timestamp.toDate() : new Date();
    const timeStr = date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    const typeLabel = data.type === 'in' ? '出勤' : '退勤';
    const typeClass = data.type === 'in' ? 'status-in' : 'status-out';

    let html = `
        <span class="${typeClass}">${typeLabel}</span>
        <span>${timeStr}</span>
    `;

    if (showName) {
        html = `
            <span>${data.empName}</span>
            ${html}
        `;
    }

    li.innerHTML = html;
    container.appendChild(li);
}
