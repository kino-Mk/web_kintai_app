// js/attendance.js

// メール通知送信（バックグラウンド、失敗しても申請には影響なし）
function sendNotificationEmail(payload) {
    fetch(GAS_WEBAPP_URL, {
        method: 'POST',
        body: JSON.stringify(payload)
    }).catch(error => console.error('メール通知送信エラー:', error));
}

// --- 状態管理 (従業員選択タブ用) ---
let currentSelectionTab = 'all';
let currentDayAttendanceStates = {}; // { empId: 'in' | 'out' }

// 本日の出勤状態を追跡する（リアルタイム）
function initAttendanceTracker() {
    const start = getStartOfToday();

    // 従業員の最新の打刻状態を取得
    db.collection('attendance')
        .where('timestamp', '>=', start)
        .orderBy('timestamp', 'asc') // 古い順に処理して最終状態を残す
        .onSnapshot((snapshot) => {
            currentDayAttendanceStates = {}; // リセット
            snapshot.forEach(doc => {
                const data = doc.data();
                // 最終的に上書きされるので最新が残る
                currentDayAttendanceStates[data.empId] = data.type;
            });

            // 状態が変わったらリストを再描画（admin.jsの関数を呼ぶ）
            if (typeof renderEmployeeSelection === 'function') {
                renderEmployeeSelection();
            }
        }, (error) => {
            console.error('Attendance Tracker Error:', error);
            if (typeof reportError === 'function') reportError(error, 'Attendance Tracker Error:');
        });
}

// タブ切り替え
function switchSelectionTab(tab) {
    currentSelectionTab = tab;

    // UI更新
    document.getElementById('tab-all').classList.toggle('active', tab === 'all');
    document.getElementById('tab-clocked-in').classList.toggle('active', tab === 'clocked-in');

    // 再描画
    if (typeof renderEmployeeSelection === 'function') {
        renderEmployeeSelection();
    }
}

// --- 打刻機能 ---

async function handleStamp(type) {
    if (!currentEmployee) {
        await showAlert('従業員が選択されていません');
        return;
    }

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
        await showAlert('スマートフォンからの打刻は許可されていません。');
        return;
    }

    const currentState = currentDayAttendanceStates[currentEmployee.id];

    if (type === 'in') {
        if (currentState === 'in') {
            await showAlert('既に出勤打刻済みです。');
            return;
        }
        if (currentState === 'out') {
            await showAlert('本日は既に退勤済みです。');
            return;
        }
    } else if (type === 'out') {
        if (currentState === 'out') {
            await showAlert('既に退勤打刻済みです。');
            return;
        }
        if (!currentState) {
            await showAlert('出勤打刻がされていません。');
            return;
        }
    }

    const confirmMsg = type === 'in' ? '出勤しますか？' : '退勤しますか？';
    if (!(await showConfirm(confirmMsg))) return;

    try {
        await db.collection('attendance').add({
            empId: currentEmployee.id,
            empName: currentEmployee.name,
            type: type,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        await showAlert(type === 'in' ? "出勤しました" : "退勤しました");
        showScreen('selection');
    } catch (error) {
        console.error('Error stamping:', error);
        if (typeof reportError === 'function') reportError(error, 'Error stamping:');
        await showAlert("打刻に失敗しました: " + error.message);
    }
}

document.getElementById('btn-clock-in').addEventListener('click', () => handleStamp('in'));
document.getElementById('btn-clock-out').addEventListener('click', () => handleStamp('out'));


// --- 申請機能 ---

document.getElementById('btn-submit-application').addEventListener('click', async () => {
    if (!currentEmployee) {
        await showAlert('従業員が選択されていません');
        return;
    }

    const type = document.getElementById('application-type').value;
    const date = document.getElementById('application-date').value;
    const reason = document.getElementById('application-reason').value;

    const timeGroup = document.getElementById('time-input-group');
    const isTimeInputVisible = !timeGroup.classList.contains('hidden');

    let startTime = null;
    let endTime = null;

    if (isTimeInputVisible) {
        startTime = document.getElementById('application-start-time').value;
        endTime = document.getElementById('application-end-time').value;

        if (type === '残業' || type === '早退') {
            if (!endTime) {
                await showAlert('退勤時刻を入力してください。');
                return;
            }
        } else if (type === '遅刻') {
            if (!startTime) {
                await showAlert('出勤時刻を入力してください。');
                return;
            }
        } else {
            if (!startTime || !endTime) {
                await showAlert('出勤時刻と退勤時刻の両方を入力してください。');
                return;
            }
        }
    }

    if (!date) {
        await showAlert('日付を選択してください');
        return;
    }

    let typeName = type;
    if (type === '有給') typeName = '有給 (全休) (1日消費)';
    if (type === '半休(午前)') typeName = '有給 (半休・午前) (0.5日消費)';
    if (type === '半休(午後)') typeName = '有給 (半休・午後) (0.5日消費)';

    if (!(await showConfirm(`${typeName} の申請を行いますか？`))) return;

    const applicationData = {
        empId: currentEmployee.id,
        empName: currentEmployee.name,
        type: type,
        date: date,
        reason: reason,
        status: 'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (isTimeInputVisible) {
        applicationData.startTime = startTime;
        applicationData.endTime = endTime;
    }

    try {
        await db.collection('applications').add(applicationData);

        // メール通知（バックグラウンド）
        sendNotificationEmail({
            action: 'notifyApplication',
            empId: currentEmployee.id,
            empName: currentEmployee.name,
            type: type,
            date: date,
            reason: reason
        });

        await showAlert('申請しました');
        document.getElementById('application-reason').value = '';
        document.getElementById('application-start-time').value = '';
        document.getElementById('application-end-time').value = '';
        showScreen('selection');
    } catch (error) {
        console.error('Error submitting application:', error);
        if (typeof reportError === 'function') reportError(error, 'Error submitting application:');
        await showAlert("申請に失敗しました: " + error.message);
    }
});

// 申請種別変更時の時刻入力欄の表示切替
document.getElementById('application-type').addEventListener('change', (e) => {
    const type = e.target.value;
    const timeGroup = document.getElementById('time-input-group');
    const startTimeContainer = document.getElementById('application-start-time').parentElement;
    const endTimeContainer = document.getElementById('application-end-time').parentElement;
    const startTimeInput = document.getElementById('application-start-time');
    const endTimeInput = document.getElementById('application-end-time');

    if (type === '遅刻') {
        timeGroup.classList.remove('hidden');
        startTimeContainer.style.display = 'block'; // 出勤時刻表示
        endTimeContainer.style.display = 'none'; // 退勤時刻非表示
        endTimeInput.value = ''; // 値をクリア
    } else if (type === '早退' || type === '残業') {
        timeGroup.classList.remove('hidden');
        startTimeContainer.style.display = 'none'; // 出勤時刻非表示
        endTimeContainer.style.display = 'block'; // 退勤時刻表示
        startTimeInput.value = ''; // 値をクリア
    } else {
        // 全休、欠勤、および新しく追加した半休(午前/午後)は時刻入力不要
        timeGroup.classList.add('hidden');
        // 非表示にする際は値をクリア
        startTimeInput.value = '';
        endTimeInput.value = '';
    }
});


// --- 履歴表示機能 ---

// 履歴表示用ユーティリティは utils.js に移動済み

// 画面表示時のフック
function onScreenChanged(screenId) {
    if (screenId === 'selection') {
        loadTodayHistoryAll();
    } else if (screenId === 'timeStamp' && currentEmployee) {
        loadTodayHistoryPersonal(currentEmployee.id);
    } else if (screenId === 'application' && currentEmployee) {
        updatePaidLeaveDisplay(currentEmployee.id);
    } else if (screenId === 'admin') {
        // 管理者ダッシュボードのアラート読み込み
        if (typeof loadAdminAlerts === 'function') {
            loadAdminAlerts();
        }
    }
}

// 有給残日数を表示 (履歴ベースの計算)
async function updatePaidLeaveDisplay(empId) {
    const infoDiv = document.getElementById('application-balance-info');
    infoDiv.textContent = "読み込み中...";

    try {
        // 1. 付与履歴を取得
        const grantsSnapshot = await db.collection('leaveGrants')
            .where('empId', '==', empId)
            .orderBy('grantDate', 'asc')
            .get();

        const grants = [];
        grantsSnapshot.forEach(doc => {
            const data = doc.data();
            grants.push(data);
        });

        // 2. 使用済み申請を取得 (有給・半休、ステータス=completed)
        const appsSnapshot = await db.collection('applications')
            .where('empId', '==', empId)
            .where('status', '==', 'completed')
            .get();

        let totalUsedDays = 0;
        appsSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.type === '有給') totalUsedDays += 1.0;
            else if (data.type && data.type.startsWith('半休')) totalUsedDays += 0.5;
        });

        // 3. 計算実行 (admin.js で定義された関数を利用)
        if (typeof calculateRemainingPaidLeave === 'function') {
            const results = calculateRemainingPaidLeave(grants, totalUsedDays);
            infoDiv.textContent = `現在の有給残日数: ${results.summary.remaining} 日`;
        } else {
            // 万が一関数が読み込まれていない場合 (念のため)
            infoDiv.textContent = "システムエラー (計算元未定義)";
        }

    } catch (error) {
        console.error('Error fetching paid leave details:', error);
        if (typeof reportError === 'function') reportError(error, 'Error fetching paid leave details:');
        infoDiv.textContent = "残日数読み込みエラー";
    }
}

// 1. 全体の本日の打刻履歴 (選択画面用)
function loadTodayHistoryAll() {
    const list = document.getElementById('today-history-list-all');
    list.innerHTML = '<li class="loading-text">読み込み中...</li>';

    const start = getStartOfToday();

    db.collection('attendance')
        .where('timestamp', '>=', start)
        .orderBy('timestamp', 'desc')
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
            console.error('Error loading all history:', error);
            if (typeof reportError === 'function') reportError(error, 'Error loading all history:');
            list.innerHTML = "<li>読み込みエラー</li>";
        });
}

// 2. 個人の本日の打刻履歴 (打刻画面用)
function loadTodayHistoryPersonal(empId) {
    const list = document.getElementById('today-history-list-personal');
    list.innerHTML = '<li class="loading-text">読み込み中...</li>';

    const start = getStartOfToday();

    db.collection('attendance')
        .where('empId', '==', empId)
        .where('timestamp', '>=', start)
        .orderBy('timestamp', 'desc')
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
            console.error('Error loading personal history:', error);
            if (typeof reportError === 'function') reportError(error, 'Error loading personal history:');
            list.innerHTML = "<li>読み込みエラー: インデックスが必要な可能性があります</li>";
            // 複合クエリ (empId + timestamp range) はFirestoreでインデックスが必要になる場合があります
            // コンソールにリンクが表示されるので作成してください
        });
}

function renderHistoryItem(container, data, showName) {
    const li = document.createElement('li');
    const date = toDate(data.timestamp);
    const timeStr = formatTime(date);
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

// --- スマートフォンからの打刻制限 ---
function applyMobileRestriction() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
        const btnIn = document.getElementById('btn-clock-in');
        const btnOut = document.getElementById('btn-clock-out');
        if (btnIn && btnOut) {
            btnIn.disabled = true;
            btnOut.disabled = true;

            // 警告メッセージの追加
            const actionsDiv = document.querySelector('.timestamp-actions');
            if (actionsDiv && !document.getElementById('mobile-warning')) {
                const warningMsg = document.createElement('p');
                warningMsg.id = 'mobile-warning';
                warningMsg.style.color = 'var(--danger-color)';
                warningMsg.style.fontWeight = 'bold';
                warningMsg.style.marginBottom = '15px';
                warningMsg.style.textAlign = 'center';
                warningMsg.textContent = '※スマートフォンからの打刻は許可されていません。';
                actionsDiv.insertBefore(warningMsg, btnIn);
            }
        }
    }
}

// 読み込み時に制限を適用
applyMobileRestriction();

// --- 打刻修正申請機能 ---

// 打刻修正申請ボタン（従業員選択画面に設置）
document.getElementById('btn-stamp-correction').addEventListener('click', () => {
    openStampCorrectionModal();
});

// 打刻修正申請モーダルを開く（当日の全打刻を表示）
async function openStampCorrectionModal() {
    const modal = document.getElementById('stamp-correction-modal');
    const listContainer = document.getElementById('correction-stamp-list');
    const reasonInput = document.getElementById('correction-reason');

    // リセット
    listContainer.innerHTML = '<p class="loading-text">読み込み中...</p>';
    reasonInput.value = '';
    modal.classList.remove('hidden');

    try {
        // 当日の全打刻データを取得
        const start = getStartOfToday();
        const snapshot = await db.collection('attendance')
            .where('timestamp', '>=', start)
            .orderBy('timestamp', 'asc')
            .get();

        listContainer.innerHTML = '';

        if (snapshot.empty) {
            listContainer.innerHTML = '<p style="padding: 15px; text-align: center; color: #666;">本日の打刻データはありません</p>';
            return;
        }

        // 従業員ごとにグループ化
        const grouped = {};
        snapshot.forEach(doc => {
            const data = doc.data();
            const empId = data.empId;
            if (!grouped[empId]) {
                grouped[empId] = {
                    empName: data.empName || empId,
                    stamps: []
                };
            }
            grouped[empId].stamps.push({ docId: doc.id, ...data });
        });

        // 従業員ごとに表示
        Object.entries(grouped).forEach(([empId, group]) => {
            // 従業員ヘッダー
            const header = document.createElement('div');
            header.style.cssText = 'font-weight: 700; font-size: 0.9rem; padding: 8px 4px 4px; color: var(--text-main); border-bottom: 1px solid var(--border-color); margin-top: 6px;';
            header.textContent = `${group.empName} (${empId})`;
            listContainer.appendChild(header);

            // 各打刻アイテム
            group.stamps.forEach(stamp => {
                const dateObj = toDate(stamp.timestamp);
                const timeStr = formatTime(dateObj);
                const typeLabel = stamp.type === 'in' ? '出勤' : '退勤';
                const typeColor = stamp.type === 'in' ? 'var(--success-color)' : 'var(--danger-color)';

                const item = document.createElement('div');
                item.className = 'correction-stamp-item';
                item.innerHTML = `
                    <input type="checkbox" class="correction-checkbox" value="${stamp.docId}"
                        data-type="${stamp.type}" data-time="${dateObj.toISOString()}"
                        data-emp-id="${empId}" data-emp-name="${group.empName}"
                        style="width: auto; margin: 0; transform: scale(1.3);">
                    <span style="color: ${typeColor}; font-weight: bold; min-width: 40px;">${typeLabel}</span>
                    <span style="font-size: 1rem;">${timeStr}</span>
                `;
                listContainer.appendChild(item);
            });
        });
    } catch (error) {
        console.error('Error loading stamps for correction:', error);
        if (typeof reportError === 'function') reportError(error, 'Error loading stamps for correction:');
        listContainer.innerHTML = '<p style="color: var(--danger-color);">読み込みに失敗しました</p>';
    }
}

// モーダルキャンセル
document.getElementById('btn-correction-cancel').addEventListener('click', () => {
    document.getElementById('stamp-correction-modal').classList.add('hidden');
});

// 打刻修正申請の送信
document.getElementById('btn-correction-submit').addEventListener('click', async () => {
    const checkboxes = document.querySelectorAll('.correction-checkbox:checked');
    if (checkboxes.length === 0) {
        await showAlert('削除したい打刻を選択してください。');
        return;
    }

    const reason = document.getElementById('correction-reason').value.trim();

    if (!(await showConfirm(`選択した ${checkboxes.length} 件の打刻について修正申請を行いますか？`))) return;

    try {
        const batch = db.batch();

        checkboxes.forEach(cb => {
            const docRef = db.collection('stampCorrections').doc();
            batch.set(docRef, {
                empId: cb.dataset.empId,
                empName: cb.dataset.empName,
                attendanceDocId: cb.value,
                attendanceType: cb.dataset.type,
                attendanceTime: firebase.firestore.Timestamp.fromDate(new Date(cb.dataset.time)),
                reason: reason,
                status: 'pending',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });

        await batch.commit();

        // メール通知（バックグラウンド）
        const details = Array.from(checkboxes).map(cb => ({
            empId: cb.dataset.empId,
            empName: cb.dataset.empName,
            type: cb.dataset.type,
            time: new Date(cb.dataset.time).toLocaleString('ja-JP')
        }));
        sendNotificationEmail({
            action: 'notifyStampCorrection',
            count: checkboxes.length,
            reason: reason,
            details: details
        });

        await showAlert('打刻修正申請を送信しました。管理者の承認をお待ちください。');
        document.getElementById('stamp-correction-modal').classList.add('hidden');
    } catch (error) {
        console.error('Stamp correction request error:', error);
        if (typeof reportError === 'function') reportError(error, 'Stamp correction request error:');
        await showAlert("申請に失敗しました: " + error.message);
    }
});
