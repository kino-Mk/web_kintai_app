// --- CSV エクスポート機能 ---

// 1. 生データエクスポート: "従業員ID, 氏名, YYYYMMDDHHMM"
document.getElementById('btn-export-csv').addEventListener('click', async () => {
    try {
        const snapshot = await db.collection('attendance').orderBy('timestamp', 'desc').get();

        let csvContent = "従業員ID, 従業員氏名, 打刻日時\n";

        snapshot.forEach(doc => {
            const data = doc.data();
            const date = toDate(data.timestamp);
            const formattedTime = formatCsvTime(date);
            csvContent += `${data.empId}, ${data.empName}, ${formattedTime}\n`;
        });

        downloadCSV(csvContent, 'attendance_raw.csv');
    } catch (error) {
        console.error('Export error:', error);
        await showAlert("エクスポートに失敗しました: " + error.message);
    }
});

// 2. 月次集計エクスポート
document.getElementById('btn-export-monthly-csv').addEventListener('click', async () => {
    const monthInput = document.getElementById('export-month-selector');
    const selectedMonth = monthInput ? monthInput.value : '';

    if (!selectedMonth) {
        await showAlert('対象月を選択してください。');
        return;
    }

    try {
        // 例: selectedMonth が "2024-02" の場合
        // startDate = 2024-01-21 00:00:00 (前月21日)
        // endDate   = 2024-02-21 00:00:00 (当月21日、これの直前までが20日分)

        let [yearStr, monthStr] = selectedMonth.split('-');
        let year = parseInt(yearStr, 10);
        let month = parseInt(monthStr, 10); // 1〜12

        // 前月を計算
        let prevYear = year;
        let prevMonth = month - 1;
        if (prevMonth === 0) {
            prevMonth = 12;
            prevYear--;
        }

        // 月は 0〜11 のインデックスになるため -1 する
        const startDate = new Date(prevYear, prevMonth - 1, 21, 0, 0, 0);
        const endDate = new Date(year, month - 1, 21, 0, 0, 0);

        // 選択された月のデータのみ取得
        const snapshot = await db.collection('attendance')
            .where('timestamp', '>=', startDate)
            .where('timestamp', '<', endDate)
            .orderBy('timestamp', 'asc')
            .get();

        if (snapshot.empty) {
            await showAlert(`${selectedMonth}月次 (${prevYear}/${prevMonth}/21 〜 ${year}/${month}/20) の打刻データはありません。`);
            return;
        }

        // 構造: Map<EmpID, Map<DateString, {in: String, out: String}>>
        const records = {};

        snapshot.forEach(doc => {
            const data = doc.data();
            if (!data.timestamp) return;

            const dateObj = toDate(data.timestamp);
            const dateKey = formatDate(dateObj);
            const formattedTime = formatCsvTime(dateObj);

            if (!records[data.empId]) records[data.empId] = { name: data.empName, days: {} };
            if (!records[data.empId].days[dateKey]) records[data.empId].days[dateKey] = {};

            if (data.type === 'in') {
                if (!records[data.empId].days[dateKey].in) {
                    records[data.empId].days[dateKey].in = formattedTime;
                }
            } else if (data.type === 'out') {
                records[data.empId].days[dateKey].out = formattedTime;
            }
        });

        let csvContent = "従業員ID,従業員名,打刻種別,打刻日時\n";

        for (const empId in records) {
            const emp = records[empId];
            // 日付順にソートして出力する
            const sortedDates = Object.keys(emp.days).sort();
            for (const dateKey of sortedDates) {
                const day = emp.days[dateKey];
                if (day.in) {
                    // 出勤は 1
                    csvContent += `${empId},${emp.name},1,${day.in}\n`;
                }
                if (day.out) {
                    // 退勤は 2
                    csvContent += `${empId},${emp.name},2,${day.out}\n`;
                }
            }
        }

        downloadCSV(csvContent, `attendance_monthly_${selectedMonth}.csv`);
    } catch (error) {
        console.error('Export error:', error);
        await showAlert("エクスポートに失敗しました: " + error.message);
    }
});

function downloadCSV(content, filename) {
    // 文字化け対策（BOMを付与する）
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}


// --- 申請表示 (ワークフロー) ---


// 申請を完了ステータスにする
async function completeApplication(docId) {
    if (!(await showConfirm('この申請を承認し「処理済み」にしますか？\n（承認録として打刻データが自動生成されます）'))) return;

    try {
        const appDoc = await db.collection('applications').doc(docId).get();
        if (!appDoc.exists) {
            await showAlert('申請データが見つかりません。');
            return;
        }

        const appData = appDoc.data();
        let attType = null;
        let targetTimeStr = null;

        if (appData.type === '遅刻') {
            attType = 'in';
            targetTimeStr = appData.startTime;
        } else if (appData.type === '早退' || appData.type === '残業') {
            attType = 'out';
            targetTimeStr = appData.endTime;
        }

        // 打刻データの自動生成 (遅刻・早退・残業のみ)
        if (attType && targetTimeStr) {
            const [years, months, days] = appData.date.split('-').map(Number);
            const [hours, minutes] = targetTimeStr.split(':').map(Number);
            const targetDate = new Date(years, months - 1, days, hours, minutes);

            await db.collection('attendance').add({
                empId: appData.empId,
                empName: appData.empName,
                type: attType,
                timestamp: firebase.firestore.Timestamp.fromDate(targetDate),
                remark: `${appData.type}承認による自動登録`,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        // 申請ステータスを更新
        await db.collection('applications').doc(docId).update({
            status: 'completed',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 成功（リアルタイムリスナーが自動で反映）

    } catch (error) {
        console.error('Complete application error:', error);
        await showAlert("処理に失敗しました: " + error.message);
    }
}

// 画面ロード時に月選択の初期値を現在の月に設定
document.addEventListener('DOMContentLoaded', () => {
    const monthSelector = document.getElementById('export-month-selector');
    const filterAttMonth = document.getElementById('filter-att-month');

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const currentMonthStr = `${yyyy}-${mm}`;

    if (monthSelector) {
        monthSelector.value = currentMonthStr;
    }
    if (filterAttMonth) {
        filterAttMonth.value = currentMonthStr;
    }

    // 驚かし演出の状態チェックはファイル末尾の checkAdminLock() で管理
});


// --- 打刻データの管理・削除機能 ---

// 打刻データを検索・表示する
async function loadAdminAttendanceData(month, empId) {
    const listAtt = document.getElementById('admin-attendance-list');
    const countSpan = document.getElementById('att-record-count');
    const delBtn = document.getElementById('btn-delete-selected-att');

    listAtt.innerHTML = '<p class="loading-text">検索中...</p>';
    countSpan.textContent = '';
    delBtn.style.display = 'none';

    try {
        let query = db.collection('attendance');

        if (month) {
            const startDate = new Date(`${month}-01T00:00:00`);
            const endDate = new Date(startDate);
            endDate.setMonth(endDate.getMonth() + 1);
            query = query.where('timestamp', '>=', startDate).where('timestamp', '<', endDate);
        }

        if (empId) {
            query = query.where('empId', '==', empId);
        }

        const snapshot = await query.orderBy('timestamp', 'desc')
            .limit(100)
            .get();

        listAtt.innerHTML = "";

        if (snapshot.empty) {
            listAtt.innerHTML = "<p>該当する打刻データはありません。</p>";
            return;
        }

        countSpan.textContent = `表示件数: ${snapshot.size}件 (最大100件まで)`;
        delBtn.style.display = 'inline-block';

        snapshot.forEach(doc => {
            const data = doc.data();
            const div = document.createElement('div');
            div.className = 'application-item';
            div.style.marginBottom = '10px';
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            div.style.gap = '15px';
            div.style.borderLeft = data.type === 'in' ? '4px solid var(--primary-color)' : '4px solid var(--danger-color)';

            const dateObj = toDate(data.timestamp);
            const timeStr = formatDateTime(dateObj);
            const typeStr = data.type === 'in' ? '出勤' : '退勤';

            div.innerHTML = `
                <input type="checkbox" class="att-delete-checkbox" value="${doc.id}" style="transform: scale(1.5);">
                <div style="flex: 1;">
                    <div style="font-size: 0.9rem; color: #666;">${timeStr}</div>
                    <div><strong>${typeStr}</strong> : ${data.empName} (${data.empId})</div>
                </div>
            `;
            listAtt.appendChild(div);
        });
    } catch (error) {
        console.error('Error loading attendance data:', error);
        listAtt.innerHTML = `<p>エラー: ${error.message}</p>`;
    }
}

// 検索ボタンクリック
document.getElementById('btn-filter-att-apply').addEventListener('click', () => {
    const month = document.getElementById('filter-att-month').value;
    const empId = document.getElementById('filter-att-employee').value;
    loadAdminAttendanceData(month, empId);
});

// 選択したデータを削除ボタン
document.getElementById('btn-delete-selected-att').addEventListener('click', async () => {
    const checkboxes = document.querySelectorAll('.att-delete-checkbox:checked');
    if (checkboxes.length === 0) {
        await showAlert('削除する打刻データを選択してください。');
        return;
    }

    if (!(await showConfirm(`選択した ${checkboxes.length} 件の打刻データを本当に削除しますか？\n（この操作は元に戻せません）`))) {
        return;
    }

    try {
        const batch = db.batch();
        checkboxes.forEach(cb => {
            const docId = cb.value;
            batch.delete(db.collection('attendance').doc(docId));
        });
        await batch.commit();

        await showAlert(`${checkboxes.length} 件のデータを削除しました。`);
        // リストを再読み込み
        const month = document.getElementById('filter-att-month').value;
        const empId = document.getElementById('filter-att-employee').value;
        loadAdminAttendanceData(month, empId);
    } catch (error) {
        console.error('Delete error:', error);
        await showAlert("削除に失敗しました: " + error.message);
    }
});


// --- 打刻修正申請 管理者機能 ---

// タブ切替
function switchAdminAttTab(tab) {
    // タブボタンの切替
    document.querySelectorAll('.admin-att-tab-btn').forEach((btn, index) => {
        btn.classList.toggle('active', (tab === 'data' && index === 0) || (tab === 'corrections' && index === 1));
    });

    // タブコンテンツの切替
    document.getElementById('tab-admin-att-data').classList.toggle('active', tab === 'data');
    document.getElementById('tab-admin-att-corrections').classList.toggle('active', tab === 'corrections');

    // 修正申請タブ表示時にデータをロード
    if (tab === 'corrections') {
        loadStampCorrections();
    }
}

// 打刻修正申請の読み込み（リアルタイム）
let correctionUnsubscribe = null;
let correctionCompletedUnsubscribe = null;

function loadStampCorrections() {
    const pendingList = document.getElementById('admin-correction-list');
    const completedList = document.getElementById('admin-correction-completed-list');

    // 既存リスナーを解除
    if (correctionUnsubscribe) correctionUnsubscribe();
    if (correctionCompletedUnsubscribe) correctionCompletedUnsubscribe();

    // 未処理申請リスナー
    correctionUnsubscribe = db.collection('stampCorrections')
        .where('status', '==', 'pending')
        .orderBy('createdAt', 'desc')
        .onSnapshot(snapshot => {
            pendingList.innerHTML = '';

            if (snapshot.empty) {
                pendingList.innerHTML = '<p style="padding: 15px; text-align: center; color: #666;">未処理の申請はありません</p>';
            } else {
                snapshot.forEach(doc => {
                    const data = doc.data();
                    renderCorrectionCard(pendingList, doc.id, data, false);
                });
            }

            // バッジ更新
            updateCorrectionBadge(snapshot.size);
        }, error => {
            console.error('Error loading corrections:', error);
            pendingList.innerHTML = '<p style="color: var(--danger-color);">読み込みエラー</p>';
        });

    // 処理済み申請リスナー（最新20件）
    correctionCompletedUnsubscribe = db.collection('stampCorrections')
        .where('status', "in", ["completed", "rejected"])
        .orderBy('updatedAt', 'desc')
        .limit(20)
        .onSnapshot(snapshot => {
            completedList.innerHTML = '';

            if (snapshot.empty) {
                completedList.innerHTML = '<p style="padding: 15px; text-align: center; color: #666;">処理済みの申請はありません</p>';
            } else {
                snapshot.forEach(doc => {
                    const data = doc.data();
                    renderCorrectionCard(completedList, doc.id, data, true);
                });
            }
        }, error => {
            console.error('Error loading completed corrections:', error);
            completedList.innerHTML = '<p style="color: var(--danger-color);">読み込みエラー</p>';
        });
}

// 修正申請カードの描画
function renderCorrectionCard(container, docId, data, isCompleted) {
    const card = document.createElement('div');
    card.className = `correction-request-card${isCompleted ? ' completed' : ''}`;

    const timeObj = toDate(data.attendanceTime);
    const timeStr = formatDateTime(timeObj);
    const typeLabel = data.attendanceType === 'in' ? '出勤' : '退勤';
    const typeColor = data.attendanceType === 'in' ? 'var(--success-color)' : 'var(--danger-color)';
    const createdAt = data.createdAt ? toDate(data.createdAt) : new Date();
    const createdStr = formatDateTime(createdAt);

    let statusBadge = '';
    if (data.status === 'completed') {
        statusBadge = '<span style="background: var(--success-bg); color: var(--success-color); padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; font-weight: 700;">承認済み</span>';
    } else if (data.status === 'rejected') {
        statusBadge = '<span style="background: var(--danger-bg); color: var(--danger-color); padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; font-weight: 700;">却下</span>';
    }

    card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <div>
                <strong>${data.empName}</strong> <span style="color: #888; font-size: 0.85rem;">(${data.empId})</span>
                ${statusBadge}
            </div>
            <span style="font-size: 0.75rem; color: #999;">申請: ${createdStr}</span>
        </div>
        <div style="background: var(--background-color); padding: 10px; border-radius: 8px; margin-bottom: 8px;">
            <span style="color: ${typeColor}; font-weight: bold;">${typeLabel}</span>
            <span style="margin-left: 8px;">${timeStr}</span>
        </div>
        ${data.reason ? `<div style="font-size: 0.85rem; color: #666; margin-bottom: 8px;">理由: ${data.reason}</div>` : ''}
        ${!isCompleted ? `
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
            <button class="btn-secondary" style="padding: 6px 15px; width: auto; font-size: 0.85rem;"
                onclick="rejectStampCorrection('${docId}')">却下</button>
            <button class="btn-primary" style="padding: 6px 15px; width: auto; font-size: 0.85rem;"
                onclick="approveStampCorrection('${docId}', '${data.attendanceDocId}')">承認 (打刻を削除)</button>
        </div>` : ''}
    `;

    container.appendChild(card);
}

// 修正申請を承認 → 打刻データ削除
async function approveStampCorrection(correctionDocId, attendanceDocId) {
    if (!(await showConfirm('この修正申請を承認しますか？\n承認すると該当の打刻データが自動的に削除されます。'))) return;

    try {
        // 打刻データを削除
        await db.collection('attendance').doc(attendanceDocId).delete();

        // 申請ステータスを更新
        await db.collection('stampCorrections').doc(correctionDocId).update({
            status: 'completed',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await showAlert('承認しました。打刻データを削除しました。');
    } catch (error) {
        console.error('Approve correction error:', error);
        await showAlert("承認処理に失敗しました: " + error.message);
    }
}

// 修正申請を却下
async function rejectStampCorrection(correctionDocId) {
    if (!(await showConfirm('この修正申請を却下しますか？'))) return;

    try {
        await db.collection('stampCorrections').doc(correctionDocId).update({
            status: 'rejected',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await showAlert('申請を却下しました。');
    } catch (error) {
        console.error('Reject correction error:', error);
        await showAlert("却下処理に失敗しました: " + error.message);
    }
}

// 未処理申請バッジの更新
function updateCorrectionBadge(count) {
    const badge = document.getElementById('correction-badge');
    if (!badge) return;

    if (count > 0) {
        badge.textContent = count;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

// 管理者画面の打刻データ管理に遷移した時、未処理件数を表示するためのリスナーを起動
function initCorrectionBadgeListener() {
    db.collection('stampCorrections')
        .where('status', '==', 'pending')
        .onSnapshot(snapshot => {
            updateCorrectionBadge(snapshot.size);
        }, error => {
            console.error('Badge listener error:', error);
        });
}

// 管理者モード時にバッジリスナーを起動
initCorrectionBadgeListener();


