// js/admin.js

// --- 従業員管理 ---

let allEmployeesCache = [];

// 管理者リストと選択画面の両方に従業員を読み込む
function loadEmployeesForSelection() {
    const listAdmin = document.getElementById('admin-employee-list-view');

    db.collection('employees').orderBy('id').onSnapshot((snapshot) => {
        allEmployeesCache = [];
        listAdmin.innerHTML = "";

        snapshot.forEach((doc) => {
            const emp = doc.data();
            emp.docId = doc.id;
            allEmployeesCache.push(emp);

            // 管理者画面用の描画 (ここでのみ管理)
            renderAdminEmployeeItem(listAdmin, emp);
        });

        // フィルタ用プルダウン
        updateFilterEmployeeDropdown(snapshot);

        // 従業員詳細画面の切替ドロップダウンを更新
        updateDetailEmployeeSwitcher();

        // 従業員選択リストの描画
        renderEmployeeSelection();
    }, (error) => {
        console.error('Error loading employees:', error);
        reportError(error, '従業員一覧読み込み');
    });
}

// 従業員選択画面の描画 (タブ対応)
function renderEmployeeSelection() {
    const listSelection = document.getElementById('employee-list');
    if (!listSelection) return;

    listSelection.innerHTML = "";

    const filtered = allEmployeesCache.filter(emp => {
        // 非表示設定の従業員は除外（管理者画面以外）
        if (emp.isHidden) return false;

        if (currentSelectionTab === 'all') return true;
        // 出勤中のみ: currentDayAttendanceStates[id] が 'in' の者
        return currentDayAttendanceStates[emp.id] === 'in';
    });

    if (filtered.length === 0) {
        const msg = currentSelectionTab === 'all' ? "従業員が登録されていません。" : "現在出勤中の従業員はいません。";
        listSelection.innerHTML = `<p class="loading-text">${msg}</p>`;
        return;
    }

    filtered.forEach(emp => {
        const btn = document.createElement('div');
        const isClockedInTab = currentSelectionTab === 'clocked-in';

        // 出勤中のみタブの場合はクリック不可にし、ホバー背景もない別のクラスを使用するかスタイル調整
        btn.className = isClockedInTab ? 'employee-item-static' : 'employee-item';

        // 出勤状態に応じたインジケーターを表示
        const isClockedIn = currentDayAttendanceStates[emp.id] === 'in';
        const statusClass = isClockedIn ? 'clocked-in' : 'clocked-out';
        const indicator = `<span class="status-indicator ${statusClass}"></span> `;

        btn.innerHTML = `${indicator}<strong>${emp.id}</strong>: ${emp.name}`;

        if (!isClockedInTab) {
            btn.onclick = () => selectEmployee(emp);
        } else {
            // 静的表示用のスタイル
            btn.style.cursor = 'default';
        }
        listSelection.appendChild(btn);
    });
}

function renderAdminEmployeeItem(container, emp) {
    const li = document.createElement('li');
    li.className = 'admin-list-item';
    li.id = `emp-row-${emp.id}`;
    li.style.display = 'flex';
    li.style.justifyContent = 'space-between';
    li.style.alignItems = 'center';
    li.style.padding = '12px 15px';
    li.style.borderBottom = '1px solid #eee';
    li.style.cursor = 'pointer';
    li.style.transition = 'background 0.2s';

    // 有給残日数用のspan IDを一意にする
    const leaveSpanId = `emp-leave-val-${emp.id}`;

    li.innerHTML = `
        <div style="font-weight: bold; font-size: 1rem;">
            ${emp.id}: ${emp.name} ${emp.isHidden ? '<span style="color: #d9534f; font-size: 0.75rem; margin-left: 5px;">(非表示)</span>' : ''}
        </div>
        <div style="font-size: 0.85rem; color: #888;">
            有給残: <span id="${leaveSpanId}">...</span> ▶
        </div>
    `;

    // ホバーエフェクト
    li.addEventListener('mouseenter', () => { li.style.background = 'var(--background-color)'; });
    li.addEventListener('mouseleave', () => { li.style.background = ''; });

    // クリックで従業員詳細ページへ遷移
    li.addEventListener('click', () => {
        openEmployeeDetail(emp.id);
    });

    container.appendChild(li);

    // 非同期で正しい有給残日数を計算して表示
    calculateLeaveBalanceForList(emp.id, leaveSpanId);
}

// 従業員一覧用: 有給残日数を非同期で計算して表示する
async function calculateLeaveBalanceForList(empId, spanId) {
    try {
        // 付与履歴を取得
        const grantsSnapshot = await db.collection('leaveGrants')
            .where('empId', '==', empId)
            .orderBy('grantDate', 'asc')
            .get();

        const grants = [];
        grantsSnapshot.forEach(doc => {
            const data = doc.data();
            data.docId = doc.id;
            grants.push(data);
        });

        // 使用済み申請を取得 (有給・半休、ステータス=completed)
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

        // 計算実行
        const results = calculateRemainingPaidLeave(grants, totalUsedDays);
        const remaining = results.summary.remaining;

        // DOMに反映
        const span = document.getElementById(spanId);
        if (span) {
            span.textContent = remaining;
        }
    } catch (error) {
        console.error('Leave balance calc error for', empId, error);
        const span = document.getElementById(spanId);
        if (span) {
            span.textContent = "?";
        }
    }
}

// フィルター用ドロップダウン（管理者画面）の更新
function updateFilterEmployeeDropdown(snapshot) {
    const selects = [
        document.getElementById('filter-employee'),
        document.getElementById('filter-att-employee')
    ].filter(s => s !== null);

    if (selects.length === 0) return;

    const currentValues = selects.map(s => s.value);

    // リストの初期化
    selects.forEach(s => s.innerHTML = '<option value="">全ての従業員</option>');

    snapshot.forEach((doc) => {
        const emp = doc.data();
        selects.forEach(s => {
            const option = document.createElement('option');
            option.value = emp.id;
            option.textContent = emp.name;
            s.appendChild(option);
        });
    });

    // 選択されていた値を復元
    selects.forEach((s, i) => {
        if (currentValues[i]) s.value = currentValues[i];
    });
}

// 従業員追加
document.getElementById('btn-add-employee').addEventListener('click', async () => {
    const idInput = document.getElementById('admin-emp-id');
    const nameInput = document.getElementById('admin-emp-name');
    const id = idInput.value.trim();
    const name = nameInput.value.trim();

    if (!id || !name) {
        await showAlert('IDと氏名を入力してください');
        return;
    }

    try {
        await db.collection('employees').doc(id).set({
            id: id,
            name: name,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await showAlert('従業員を登録しました');
        idInput.value = '';
        nameInput.value = '';
    } catch (error) {
        console.error('Error adding employee: ', error);
        await showAlert("エラーが発生しました: " + error.message);
    }
});

// 従業員削除
async function deleteEmployee(docId, name) {
    if (!(await showConfirm(`${name} さんを削除してもよろしいですか？`))) return;
    try {
        await db.collection('employees').doc(docId).delete();
        await showAlert('削除しました');
    } catch (error) {
        await showAlert("削除に失敗しました: " + error.message);
    }
}

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

// --- カレンダー設定 ---

document.getElementById('btn-calendar-load').addEventListener('click', async () => {
    const month = document.getElementById('calendar-month-selector').value;
    if (month) {
        renderCalendar(month);
    } else {
        await showAlert('対象月を選択してください。');
    }
});

function renderCalendar(monthStr) {
    const grid = document.getElementById('calendar-grid');
    const msg = document.getElementById('calendar-message');

    // monthStr format: "YYYY-MM"
    const [year, month] = monthStr.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);

    // Firestoreから該当月の休日データを取得
    // クエリ: ドキュメントIDが YYYY-MM で始まるもの (厳密には範囲指定が正確)
    const startDateStr = `${monthStr}-01`;
    const endDateStr = `${monthStr}-${String(lastDay.getDate()).padStart(2, '0')}`;

    db.collection('holidays')
        .where(firebase.firestore.FieldPath.documentId(), '>=', startDateStr)
        .where(firebase.firestore.FieldPath.documentId(), '<=', endDateStr)
        .get()
        .then(snapshot => {
            const holidays = {}; // {"YYYY-MM-DD": true}
            snapshot.forEach(doc => {
                holidays[doc.id] = true;
            });

            // カレンダー構築
            buildCalendarHTML(year, month - 1, firstDay, lastDay, holidays);

            msg.style.display = 'none';
            grid.classList.remove('hidden');
        })
        .catch(error => {
            console.error('Error loading holidays:', error);
            msg.textContent = "休日データの読み込みに失敗しました。";
        });
}

function buildCalendarHTML(year, monthIndex, firstDay, lastDay, holidays) {
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';

    // ヘッダー (日〜土)
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    days.forEach(d => {
        const div = document.createElement('div');
        div.className = 'calendar-header';
        div.textContent = d;
        if (d === '日') div.style.color = 'var(--danger-color)';
        if (d === '土') div.style.color = '#007bff';
        grid.appendChild(div);
    });

    // 空白マス
    for (let i = 0; i < firstDay.getDay(); i++) {
        const div = document.createElement('div');
        div.className = 'calendar-day empty';
        grid.appendChild(div);
    }

    // 日付マス
    for (let currentDay = 1; currentDay <= lastDay.getDate(); currentDay++) {
        const dateObj = new Date(year, monthIndex, currentDay);
        const yyyy = dateObj.getFullYear();
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dateObj.getDate()).padStart(2, '0');
        const dateString = `${yyyy}-${mm}-${dd}`;

        const div = document.createElement('div');
        div.className = 'calendar-day';
        div.textContent = currentDay;
        div.id = `cal-${dateString}`;

        if (holidays[dateString]) {
            div.classList.add('holiday');
        }

        div.addEventListener('click', () => toggleHoliday(dateString, div));
        grid.appendChild(div);
    }
}

async function toggleHoliday(dateString, element) {
    const isCurrentlyHoliday = element.classList.contains('holiday');

    try {
        if (isCurrentlyHoliday) {
            await db.collection('holidays').doc(dateString).delete();
            element.classList.remove('holiday');
        } else {
            await db.collection('holidays').doc(dateString).set({
                isHoliday: true,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            element.classList.add('holiday');
        }
    } catch (error) {
        console.error('Update error:', error);
        await showAlert("更新エラー: " + error.message);
    }
}

// 休日自動設定ボタンのイベント
document.getElementById('btn-calendar-auto-set').addEventListener('click', async () => {
    const month = document.getElementById('calendar-month-selector').value;
    if (month) {
        autoSetHolidays(month);
    } else {
        await showAlert('対象月を選択してください。');
    }
});

async function autoSetHolidays(monthStr) {
    if (!(await showConfirm(`${monthStr} の土日と日本の祝日を自動的に休日設定しますか？`))) return;

    const btn = document.getElementById('btn-calendar-auto-set');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "設定中...";

    try {
        // 1. 日本の祝日データを取得
        const response = await fetch('https://holidays-jp.github.io/api/v1/date.json');
        if (!response.ok) throw new Error("祝日データの取得に失敗しました。");
        const holidayData = await response.json();

        // 2. 対象月の日数を算出
        const [year, month] = monthStr.split('-').map(Number);
        const lastDay = new Date(year, month, 0).getDate();

        const batch = db.batch();
        let count = 0;

        for (let d = 1; d <= lastDay; d++) {
            const dateObj = new Date(year, month - 1, d);
            const dateString = formatDate(dateObj);
            const dayOfWeek = dateObj.getDay(); // 0:日, 6:土

            const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
            const isPublicHoliday = !!holidayData[dateString];

            if (isWeekend || isPublicHoliday) {
                const docRef = db.collection('holidays').doc(dateString);
                batch.set(docRef, {
                    isHoliday: true,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    type: isPublicHoliday ? "public_holiday" : "weekend"
                });
                count++;
            }
        }

        if (count > 0) {
            await batch.commit();
            await showAlert(`${count} 日分を休日として設定しました。`);
            renderCalendar(monthStr);
        } else {
            await showAlert('設定対象の日が見つかりませんでした。');
        }

    } catch (error) {
        console.error('Auto set holidays error:', error);
        await showAlert("エラーが発生しました: " + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

// 指定期間の「所定労働日数」を計算
function countWorkDays(startDate, endDate, holidaySet) {
    let count = 0;
    const current = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

    while (current <= end) {
        const dateKey = formatDate(current);
        if (!holidaySet.has(dateKey)) {
            count++;
        }
        current.setDate(current.getDate() + 1);
    }
    return count;
}

// getMonthCycleRange は utils.js に定義済み

// --- 従業員詳細ページ ---

// 現在表示中の従業員ID
let currentDetailEmpId = null;

async function openEmployeeDetail(empId) {
    currentDetailEmpId = empId;

    try {
        const doc = await db.collection('employees').doc(empId).get();
        if (!doc.exists) {
            await showAlert('従業員データが見つかりません。');
            return;
        }
        const emp = doc.data();

        document.getElementById('detail-emp-title').textContent = `${emp.name} (${emp.id})`;
        document.getElementById('detail-emp-id').value = emp.id;
        document.getElementById('detail-emp-name').value = emp.name;
        document.getElementById('detail-emp-password').value = emp.password || '';
        document.getElementById('detail-emp-email').value = emp.email || '';
        document.getElementById('detail-emp-leave').value = emp.paidLeave !== undefined ? emp.paidLeave : 0;
        document.getElementById('detail-emp-hidden').checked = !!emp.isHidden;

        const now = new Date();
        const currentMonthStr = formatDate(now).slice(0, 7);
        document.getElementById('detail-att-month-selector').value = currentMonthStr;
        document.getElementById('detail-app-month-selector').value = currentMonthStr;

        showScreen('admin-employee-detail');

        const switcher = document.getElementById('detail-emp-switcher');
        if (switcher) switcher.value = empId;

        // 非同期読み込み
        calculateMonthlyRates(empId);
        loadEmployeeAttendanceDetail(empId, currentMonthStr);
        loadDetailMissingCheckoutAlert(empId);
        loadEmployeePendingApplications(empId);
        loadEmployeeCompletedApplications(empId, 'month', currentMonthStr);
        updateDetailYearSelector();
        loadEmployeeLeaveManagement(empId);

        switchDetailTab('basic');
    } catch (error) {
        console.error('Error loading employee detail:', error);
        await showAlert('従業員データの読み込みに失敗しました。');
    }
}


// 月別の出勤率を一覧で表示（直近6ヶ月分）
async function calculateMonthlyRates(empId) {
    try {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // 休日データ取得
        const holidaysSnapshot = await db.collection('holidays').get();
        const holidaySet = new Set();
        holidaysSnapshot.forEach(doc => { holidaySet.add(doc.id); });

        // 出勤打刻データ取得
        const attSnapshot = await db.collection('attendance')
            .where('empId', '==', empId)
            .where('type', '==', 'in')
            .get();

        // 承認済みの有給申請データ取得
        const appsSnapshot = await db.collection('applications')
            .where('empId', '==', empId)
            .where('status', '==', 'completed')
            .get();

        const includePaidLeave = document.getElementById('toggle-include-paid-leave').checked;

        // 全打刻日をセットに格納
        const attendedDays = new Set();
        attSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.timestamp) {
                attendedDays.add(formatDate(toDate(data.timestamp)));
            }
        });

        // 承認済み有給日をマップに格納 (日付 -> 日数)
        const paidLeaveDays = new Map();
        appsSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.type === '有給' || (data.type && data.type.startsWith('半休'))) {
                const dayValue = data.type === '有給' ? 1.0 : 0.5;
                // 同日に重複申請がある場合は加算（通常はないはずだが）
                const current = paidLeaveDays.get(data.date) || 0;
                paidLeaveDays.set(data.date, current + dayValue);
            }
        });

        // 表示用コンテナ
        const container = document.getElementById('detail-monthly-rates');
        container.innerHTML = '';

        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.fontSize = '0.9rem';

        // テーブルヘッダー
        table.innerHTML = `
            <thead>
                <tr style="border-bottom: 2px solid #ddd;">
                    <th style="text-align: left; padding: 8px;">月</th>
                    <th style="text-align: center; padding: 8px;">出勤日数</th>
                    <th style="text-align: center; padding: 8px;">所定日数</th>
                    <th style="text-align: center; padding: 8px;">出勤率</th>
                </tr>
            </thead>
        `;

        const tbody = document.createElement('tbody');
        const monthlyRates = []; // 平均計算用

        for (let i = 0; i < 6; i++) {
            // 月次範囲の決定
            const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            if (now.getDate() >= 21) targetDate.setMonth(targetDate.getMonth() + 1);
            targetDate.setMonth(targetDate.getMonth() - i);

            const monthStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
            const range = getMonthCycleRange(monthStr);
            let { start: monthStart, end: monthEnd } = range;
            monthEnd.setDate(monthEnd.getDate() - 1); // 21日未満なので20日まで

            if (monthEnd > today) monthEnd = today;

            const workDays = countWorkDays(monthStart, monthEnd, holidaySet);

            let attended = 0;
            const cursor = new Date(monthStart);
            while (cursor <= monthEnd) {
                const dateKey = formatDate(cursor);
                let dayCount = 0;

                if (attendedDays.has(dateKey)) dayCount = 1.0;
                if (includePaidLeave && paidLeaveDays.has(dateKey)) {
                    dayCount = Math.min(1.0, dayCount + paidLeaveDays.get(dateKey));
                }

                attended += dayCount;
                cursor.setDate(cursor.getDate() + 1);
            }

            const rate = workDays > 0 ? (attended / workDays) * 100 : 0;
            const displayRate = Math.round(rate);
            const rateColor = displayRate >= 80 ? 'var(--success-color)' : (displayRate >= 50 ? 'var(--warning-color)' : 'var(--danger-color)');

            if (i === 0) {
                const monthEl = document.getElementById('detail-rate-month');
                if (monthEl) {
                    monthEl.textContent = `${displayRate}%`;
                    monthEl.style.color = rateColor;
                }
            }

            if (attended === 0) continue;

            monthlyRates.push(displayRate);

            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--border-color)';
            tr.innerHTML = `
                <td style="padding: 12px;">${targetDate.getFullYear()}年${targetDate.getMonth() + 1}月</td>
                <td style="text-align: center; padding: 12px;">${attended}日</td>
                <td style="text-align: center; padding: 12px;">${workDays}日</td>
                <td style="text-align: center; padding: 12px; font-weight: bold; color: ${rateColor};">${displayRate}%</td>
            `;
            tbody.appendChild(tr);
        }

        table.appendChild(tbody);
        container.appendChild(table);

        // 累計出勤率（月別平均・0%除外）を計算
        const totalEl = document.getElementById('detail-rate-total');
        if (totalEl) {
            if (monthlyRates.length > 0) {
                const averageRate = Math.round(monthlyRates.reduce((a, b) => a + b, 0) / monthlyRates.length);
                const averageColor = averageRate >= 80 ? '#28a745' : (averageRate >= 50 ? '#ffc107' : '#dc3545');
                totalEl.textContent = `${averageRate}%`;
                totalEl.style.color = averageColor;
            } else {
                totalEl.textContent = '0%';
                totalEl.style.color = '#dc3545';
            }
        }

    } catch (error) {
        console.error('Monthly rate calculation error:', error);
        const container = document.getElementById('detail-monthly-rates');
        if (container) container.textContent = '月別出勤率の計算に失敗しました。';
    }
}

// 出勤率計算の切り替えイベント
document.getElementById('toggle-include-paid-leave').addEventListener('change', () => {
    if (currentDetailEmpId) {
        calculateMonthlyRates(currentDetailEmpId);
    }
});

// 詳細ページ: 保存ボタン
document.getElementById('btn-detail-save').addEventListener('click', async () => {
    if (!currentDetailEmpId) return;

    const newName = document.getElementById('detail-emp-name').value.trim();
    const newPassword = document.getElementById('detail-emp-password').value.trim();
    const newEmail = document.getElementById('detail-emp-email').value.trim();
    const newLeave = Number(document.getElementById('detail-emp-leave').value);
    const isHidden = document.getElementById('detail-emp-hidden').checked;

    if (!newName) {
        await showAlert('氏名を入力してください。');
        return;
    }

    try {
        await db.collection('employees').doc(currentDetailEmpId).update({
            name: newName,
            paidLeave: newLeave,
            isHidden: isHidden,
            password: newPassword,
            email: newEmail
        });
        await showAlert('従業員情報を更新しました。');
        loadEmployeesForSelection(); // リスト更新
        // タイトルも更新
        document.getElementById('detail-emp-title').textContent = `${newName} (${currentDetailEmpId})`;
    } catch (error) {
        console.error('Update error:', error);
        await showAlert("更新エラー: " + error.message);
    }
});



// 詳細ページ: 削除ボタン
document.getElementById('btn-detail-delete').addEventListener('click', async () => {
    if (!currentDetailEmpId) return;

    const empName = document.getElementById('detail-emp-name').value;
    if (!(await showConfirm(`${empName} さんを削除してもよろしいですか？\n\n（過去の打刻データや申請データは残りますが、この従業員はリストから消えます）`))) {
        return;
    }

    try {
        await db.collection('employees').doc(currentDetailEmpId).delete();
        await showAlert('削除しました。');
        currentDetailEmpId = null;
        showScreen('admin-employees');
    } catch (error) {
        console.error('Delete error:', error);
        await showAlert("削除に失敗しました: " + error.message);
    }
});

// --- 詳細ページ用: 打刻履歴管理 ---

document.getElementById('btn-detail-att-load').addEventListener('click', async () => {
    if (!currentDetailEmpId) return;
    const month = document.getElementById('detail-att-month-selector').value;
    if (month) {
        loadEmployeeAttendanceDetail(currentDetailEmpId, month);
    } else {
        await showAlert('月を選択してください。');
    }
});

// 詳細ページ：打刻履歴の読み込み
async function loadEmployeeAttendanceDetail(empId, monthStr) {
    const list = document.getElementById('detail-attendance-list');
    const countSpan = document.getElementById('detail-att-count');
    const delBtn = document.getElementById('btn-detail-att-delete');

    list.innerHTML = '<p class="loading-text">読み込み中...</p>';
    countSpan.textContent = '';
    delBtn.style.display = 'none';

    const { start, end } = getMonthCycleRange(monthStr);

    try {
        const snapshot = await db.collection('attendance')
            .where('empId', '==', empId)
            .where('timestamp', '>=', start)
            .where('timestamp', '<', end)
            .orderBy('timestamp', 'desc')
            .get();

        list.innerHTML = "";
        if (snapshot.empty) {
            list.innerHTML = "<p>この期間の打刻履歴はありません。</p>";
            return;
        }

        countSpan.textContent = `(${snapshot.size}件)`;
        delBtn.style.display = 'inline-block';

        snapshot.forEach(doc => {
            const data = doc.data();
            const dateObj = toDate(data.timestamp);
            const div = document.createElement('div');
            div.className = 'admin-list-item';
            div.style.padding = '10px 15px';
            div.style.marginBottom = '5px';
            div.style.fontSize = '0.9rem';
            div.style.borderLeft = data.type === 'in' ? '4px solid var(--primary-color)' : '4px solid var(--danger-color)';

            div.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <input type="checkbox" class="detail-att-checkbox" value="${doc.id}">
                        <span>${formatDateTime(dateObj)}</span>
                    </div>
                    <strong>${data.type === 'in' ? '出勤' : '退勤'}</strong>
                </div>
            `;
            list.appendChild(div);
        });
    } catch (error) {
        console.error('Error loading attendance detail:', error);
        list.innerHTML = `<p>エラー: ${error.message}</p>`;
    }
}

// 選択した打刻データを削除 (詳細画面)
document.getElementById('btn-detail-att-delete').addEventListener('click', async () => {
    const checkboxes = document.querySelectorAll('.detail-att-checkbox:checked');
    if (checkboxes.length === 0) {
        await showAlert('削除する打刻データを選択してください。');
        return;
    }

    if (!(await showConfirm(`選択した ${checkboxes.length} 件の打刻データを削除しますか？`))) return;

    try {
        const batch = db.batch();
        checkboxes.forEach(cb => {
            batch.delete(db.collection('attendance').doc(cb.value));
        });
        await batch.commit();

        await showAlert('削除しました。');
        const month = document.getElementById('detail-att-month-selector').value;
        loadEmployeeAttendanceDetail(currentDetailEmpId, month);
        calculateMonthlyRates(currentDetailEmpId);
    } catch (error) {
        await showAlert("削除に失敗しました: " + error.message);
    }
});

// --- 詳細ページ用: 打刻の手動追加 ---

document.getElementById('btn-add-att-manual').addEventListener('click', async () => {
    if (!currentDetailEmpId) return;

    const dateTimeVal = document.getElementById('add-att-datetime').value;
    const type = document.getElementById('add-att-type').value;
    const remark = document.getElementById('add-att-remark').value.trim();

    if (!dateTimeVal) {
        await showAlert('日時を選択してください。');
        return;
    }

    const ts = firebase.firestore.Timestamp.fromDate(new Date(dateTimeVal));

    // 従業員名を取得
    const emp = allEmployeesCache.find(e => e.id === currentDetailEmpId);
    const empName = emp ? emp.name : '';

    try {
        await db.collection('attendance').add({
            empId: currentDetailEmpId,
            empName: empName,
            type: type,
            timestamp: ts,
            remark: remark,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await showAlert('打刻を追加しました。');
        // フォームのリセット
        document.getElementById('add-att-datetime').value = '';
        document.getElementById('add-att-remark').value = '';

        // 表示を更新（追加した打刻が含まれる月を表示）
        const dateObj = new Date(dateTimeVal);
        const monthStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
        document.getElementById('detail-att-month-selector').value = monthStr;
        loadEmployeeAttendanceDetail(currentDetailEmpId, monthStr);

        // 出勤率も再計算
        calculateMonthlyRates(currentDetailEmpId);
    } catch (error) {
        console.error('Manual add error:', error);
        await showAlert("追加に失敗しました: " + error.message);
    }
});

// 従業員詳細画面の切替ドロップダウンを生成/更新
function updateDetailEmployeeSwitcher() {
    const switcher = document.getElementById('detail-emp-switcher');
    if (!switcher) return;

    const currentVal = switcher.value;
    switcher.innerHTML = '';

    allEmployeesCache.forEach(emp => {
        const opt = document.createElement('option');
        opt.value = emp.id;
        opt.textContent = `${emp.id}: ${emp.name}`;
        switcher.appendChild(opt);
    });

    // 既に選択されていた値があれば復元（なければ最初の人が選ばれる）
    if (currentVal) switcher.value = currentVal;
}

// 詳細画面からの従業員直接切替
document.getElementById('detail-emp-switcher').addEventListener('change', (e) => {
    const newEmpId = e.target.value;
    if (newEmpId) {
        openEmployeeDetail(newEmpId);
    }
});

// 個別の未処理申請の読み込み (従業員詳細用)
function loadEmployeePendingApplications(empId) {
    const container = document.getElementById('detail-pending-apps');
    if (!container) return;

    // 通常の申請を監視
    db.collection('applications')
        .where('empId', '==', empId)
        .orderBy('createdAt', 'desc')
        .onSnapshot((snapshot) => {
            // 通常申請のHTML生成
            const pending = snapshot.docs.filter(doc => doc.data().status !== 'completed');
            renderPendingSection(container, empId, pending);
        });

    // 打刻修正申請もリアルタイム監視
    db.collection('stampCorrections')
        .where('empId', '==', empId)
        .where('status', '==', 'pending')
        .orderBy('createdAt', 'desc')
        .onSnapshot((corrSnapshot) => {
            // 既存の打刻修正セクションを削除
            const oldSection = container.querySelector('.stamp-correction-section');
            if (oldSection) oldSection.remove();

            if (corrSnapshot.empty) return;

            // 打刻修正セクションを追加
            const section = document.createElement('div');
            section.className = 'stamp-correction-section';
            section.innerHTML = '<div style="font-weight: 700; font-size: 0.85rem; color: var(--warning-color); margin: 10px 0 6px; padding-top: 8px; border-top: 1px solid var(--border-color);">🔧 打刻修正申請</div>';

            corrSnapshot.forEach(doc => {
                const data = doc.data();
                const timeObj = toDate(data.attendanceTime);
                const timeStr = formatDateTime(timeObj);
                const typeLabel = data.attendanceType === 'in' ? '出勤' : '退勤';
                const typeColor = data.attendanceType === 'in' ? 'var(--success-color)' : 'var(--danger-color)';

                const div = document.createElement('div');
                div.className = 'application-item';
                div.style.marginBottom = '10px';
                div.style.borderLeft = '4px solid var(--warning-color)';
                div.innerHTML = `
                    <div><strong>打刻修正</strong> <span style="color: ${typeColor}; font-weight: bold;">${typeLabel}</span></div>
                    <div style="font-size: 0.85rem; color: #666;">打刻時刻: ${timeStr}</div>
                    ${data.reason ? `<div style="font-size: 0.85rem;">理由: ${data.reason}</div>` : ''}
                    <div style="margin-top: 5px; display: flex; gap: 5px;">
                        <button onclick="approveStampCorrection('${doc.id}', '${data.attendanceDocId}')" class="btn-primary" style="padding: 2px 8px; font-size: 0.75rem;">承認 (打刻削除)</button>
                        <button onclick="rejectStampCorrection('${doc.id}')" class="btn-secondary" style="padding: 2px 8px; font-size: 0.75rem;">却下</button>
                    </div>
                `;
                section.appendChild(div);
            });

            container.appendChild(section);

            // 「未処理の申請はありません」表示を消す
            const emptyMsg = container.querySelector('.loading-text');
            if (emptyMsg && emptyMsg.textContent.includes('未処理の申請はありません')) {
                emptyMsg.remove();
            }
        });
}

// 未処理の通常申請を描画するヘルパー
function renderPendingSection(container, empId, pendingDocs) {
    // 打刻修正セクションを保存
    const corrSection = container.querySelector('.stamp-correction-section');

    container.innerHTML = '';

    if (pendingDocs.length === 0 && !corrSection) {
        container.innerHTML = "<p class='loading-text'>未処理の申請はありません。</p>";
    } else if (pendingDocs.length === 0) {
        // 打刻修正はあるが通常申請は空（何も表示しない）
    } else {
        pendingDocs.forEach(doc => {
            const data = doc.data();
            const div = document.createElement('div');
            div.className = 'application-item';
            div.style.marginBottom = '10px';
            div.style.borderLeft = '4px solid #f0ad4e';
            div.innerHTML = `
                <div><strong>${data.type}</strong></div>
                <div style="font-size: 0.85rem; color: #666;">対象日: ${data.date}</div>
                <div style="font-size: 0.85rem;">理由: ${data.reason || 'なし'}</div>
                <div style="margin-top: 5px;">
                    <button onclick="completeApplication('${doc.id}')" class="btn-primary" style="padding: 2px 8px; font-size: 0.75rem;">完了にする</button>
                </div>
            `;
            container.appendChild(div);
        });
    }

    // 打刻修正セクションを復元
    if (corrSection) container.appendChild(corrSection);
}

// 個別の処理済み申請の読み込み (従業員詳細用)
async function loadEmployeeCompletedApplications(empId, filterType, filterValue) {
    const container = document.getElementById('detail-completed-apps');
    if (!container) return;

    container.innerHTML = '<p class="loading-text">検索中...</p>';

    let start, end;
    if (filterType === 'month') {
        // 月別: 前月21日 〜 当月20日 (文字列比較)
        const [year, mon] = filterValue.split('-').map(Number);
        const prevMonthDate = new Date(year, mon - 2, 21);
        const prevYear = prevMonthDate.getFullYear();
        const prevMon = String(prevMonthDate.getMonth() + 1).padStart(2, '0');

        start = `${prevYear}-${prevMon}-21`;
        end = `${filterValue}-20`;
    } else {
        // 年別: YYYY-01-01 〜 YYYY-12-31
        start = filterValue + "-01-01";
        end = filterValue + "-12-31";
    }

    try {
        const snapshot = await db.collection('applications')
            .where('empId', '==', empId)
            .where('status', '==', 'completed')
            .where('date', '>=', start)
            .where('date', '<=', end)
            .orderBy('date', 'desc')
            .get();

        container.innerHTML = "";
        if (snapshot.empty) {
            container.innerHTML = "<p class='loading-text'>履歴はありません。</p>";
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const div = document.createElement('div');
            div.className = 'application-item';
            div.style.marginBottom = '10px';
            div.style.borderLeft = '4px solid #5cb85c';
            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <div><strong>${data.type}</strong></div>
                        <div style="font-size: 0.85rem; color: #666;">対象日: ${data.date}</div>
                        <div style="font-size: 0.8rem;">理由: ${data.reason || 'なし'}</div>
                    </div>
                    <button onclick="deleteCompletedApplicationForDetail('${doc.id}', '${empId}', '${filterType}', '${filterValue}')" class="btn-danger" style="padding: 2px 6px; font-size: 10px;">削除</button>
                </div>
            `;
            container.appendChild(div);
        });
    } catch (error) {
        console.error('Error loading employee completed applications:', error);
        if (typeof reportError === 'function') reportError(error, 'Error loading employee completed applications:');
        container.innerHTML = "<p class='loading-text'>データの読み込みに失敗しました</p>";
    }
}

// 申請履歴の年度セレクターを生成
function updateDetailYearSelector() {
    const selector = document.getElementById('detail-app-year-selector');
    if (!selector) return;

    const currentYear = new Date().getFullYear();
    selector.innerHTML = '';

    // 2025年から現在+10年までを表示
    for (let y = 2025; y <= currentYear + 10; y++) {
        const opt = document.createElement('option');
        opt.value = y.toString();
        opt.textContent = `${y}年`;
        selector.appendChild(opt);
    }
    selector.value = currentYear.toString();
}

// 詳細画面からの削除後にリストを更新するためのラッパー
async function deleteCompletedApplicationForDetail(docId, empId, filterType, filterValue) {
    if (!(await showConfirm('この申請データを削除しますか？'))) return;
    try {
        await db.collection('applications').doc(docId).delete();
        await loadEmployeeCompletedApplications(empId, filterType, filterValue);
    } catch (error) {
        console.error('Delete application error:', error);
        if (typeof reportError === 'function') reportError(error, 'Delete application error:');
        await showAlert('削除に失敗しました: ' + error.message);
    }
}

// 申請履歴のフィルター種別切替
document.getElementById('detail-app-filter-type').addEventListener('change', (e) => {
    const type = e.target.value;
    if (type === 'month') {
        document.getElementById('detail-app-month-selector').style.display = 'block';
        document.getElementById('detail-app-year-selector').style.display = 'none';
    } else {
        document.getElementById('detail-app-month-selector').style.display = 'none';
        document.getElementById('detail-app-year-selector').style.display = 'block';
    }
});

// 処理済み申請のフィルタボタン
document.getElementById('btn-detail-app-filter').addEventListener('click', async () => {
    if (!currentDetailEmpId) return;

    const filterType = document.getElementById('detail-app-filter-type').value;
    let filterValue;

    if (filterType === 'month') {
        filterValue = document.getElementById('detail-app-month-selector').value;
    } else {
        filterValue = document.getElementById('detail-app-year-selector').value;
    }

    if (filterValue) {
        loadEmployeeCompletedApplications(currentDetailEmpId, filterType, filterValue);
    } else {
        await showAlert(filterType === 'month' ? "月を選択してください。" : "年を入力してください。");
    }
});

// 従業員詳細タブの切り替え
function switchDetailTab(tabName) {
    // ボタンのハイライト切り替え
    const tabs = document.querySelectorAll('.detail-tab-btn');
    tabs.forEach(t => {
        if (t.getAttribute('onclick').includes(`'${tabName}'`)) {
            t.classList.add('active');
        } else {
            t.classList.remove('active');
        }
    });

    // コンテンツの切り替え
    document.querySelectorAll('.tab-content').forEach(c => {
        c.classList.remove('active');
    });
    const target = document.getElementById(`tab-detail-${tabName}`);
    if (target) target.classList.add('active');
}

// --- 有給休暇管理 (履歴ベース) ---

// 有給管理データの読み込み
async function loadEmployeeLeaveManagement(empId) {
    const tableBody = document.getElementById('leave-grant-table-body');
    const summaryDiv = document.getElementById('leave-calc-summary');
    if (!tableBody || !summaryDiv) return;

    tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">読み込み中...</td></tr>';
    summaryDiv.innerHTML = '読み込み中...';

    try {
        // 1. 付与履歴を取得
        const grantsSnapshot = await db.collection('leaveGrants')
            .where('empId', '==', empId)
            .orderBy('grantDate', 'asc')
            .get();

        const grants = [];
        grantsSnapshot.forEach(doc => {
            const data = doc.data();
            data.docId = doc.id;
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

        // 3. 計算実行
        const results = calculateRemainingPaidLeave(grants, totalUsedDays);

        // 4. UI更新
        renderLeaveGrantTable(results.processedGrants, empId);
        renderLeaveCalcSummary(results.summary);

        // 5. 従業員情報の「有給残日数」フォームも同期
        const summaryRemaining = results.summary.remaining;
        document.getElementById('detail-emp-leave').value = summaryRemaining;
        const leaveDisplay = document.getElementById('detail-emp-leave-display');
        if (leaveDisplay) {
            leaveDisplay.textContent = `${summaryRemaining} 日`;
        }

    } catch (error) {
        console.error('Leave management load error:', error);
        tableBody.innerHTML = '<tr><td colspan="5" style="color:red; text-align:center;">読み込み失敗</td></tr>';
    }
}


// 付与履歴テーブルの描画
function renderLeaveGrantTable(processedGrants, empId) {
    const tableBody = document.getElementById('leave-grant-table-body');
    if (processedGrants.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#888; padding:15px;">履歴がありません。</td></tr>';
        return;
    }

    tableBody.innerHTML = processedGrants.map(g => `
        <tr style="${g.isExpired ? 'background:#f9f9f9; color:#999;' : ''}">
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${g.grantDate}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${g.amount}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${g.expireDate}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">
                <span style="font-size:0.75rem; padding:2px 6px; border-radius:4px; ${g.isExpired ? 'background:#ddd;' : 'background:#e1f5fe; color:#01579b;'}">
                    ${g.isExpired ? '失効' : '有効'}
                </span>
            </td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">
                <button onclick="deleteLeaveGrant('${g.docId}', '${empId}')" style="background:none; border:none; color:#dc3545; cursor:pointer; font-size:1.1rem;" title="削除">×</button>
            </td>
        </tr>
    `).join('');
}

// サマリーの描画
function renderLeaveCalcSummary(summary) {
    const div = document.getElementById('leave-calc-summary');
    div.innerHTML = `
        <div style="font-size: 1.1rem; font-weight: bold; color: #007bff; margin-bottom: 10px; border-bottom: 1px solid #bce0ff; padding-bottom: 5px;">
            現在の残日数: ${summary.remaining} 日
        </div>
        <div style="display: flex; justify-content: space-between;">
            <span>有効な付与合計:</span><span>${summary.totalGrantedValid} 日</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
            <span>使用済み合計:</span><span>${summary.totalUsedDays} 日</span>
        </div>
        <div style="display: flex; justify-content: space-between; border-top: 1px solid #d0e8ff; margin-top: 5px; padding-top: 5px; color: #888;">
            <span>(備考) 失効済み合計:</span><span>${summary.totalExpired} 日</span>
        </div>
    `;
}

// 付与の追加
document.getElementById('btn-grant-leave').addEventListener('click', async () => {
    const date = document.getElementById('grant-date').value;
    const amount = parseFloat(document.getElementById('grant-amount').value);
    const note = document.getElementById('grant-note').value;

    if (!currentDetailEmpId) return;
    if (!date || isNaN(amount)) {
        await showAlert('日付と日数を入力してください。');
        return;
    }

    if (!(await showConfirm(`${amount} 日の有給を付与しますか？`))) return;

    try {
        await db.collection('leaveGrants').add({
            empId: currentDetailEmpId,
            grantDate: date,
            amount: amount,
            note: note,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // フォームクリア
        document.getElementById('grant-amount').value = '';
        document.getElementById('grant-note').value = '';

        // 再読み込み
        loadEmployeeLeaveManagement(currentDetailEmpId);

    } catch (error) {
        await showAlert("付与に失敗しました: " + error.message);
    }
});

// 付与履歴の削除
async function deleteLeaveGrant(grantId, empId) {
    if (!(await showConfirm('この付与データを削除しますか？\n(残日数が再計算されます)'))) return;

    try {
        await db.collection('leaveGrants').doc(grantId).delete();
        loadEmployeeLeaveManagement(empId);
    } catch (error) {
        await showAlert("削除に失敗しました: " + error.message);
    }
}

// --- 出勤率一覧 ---

// 画面表示時にデフォルトの期間を設定
function initRateOverviewDefaults() {
    const now = new Date();
    const startInput = document.getElementById('rate-overview-start');
    const endInput = document.getElementById('rate-overview-end');

    if (startInput && !startInput.value) {
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        startInput.value = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, '0')}`;
    }
    if (endInput && !endInput.value) {
        endInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
}

// 全従業員の出勤率を計算・表示
async function calculateAllEmployeeRates() {
    const startMonth = document.getElementById('rate-overview-start').value;
    const endMonth = document.getElementById('rate-overview-end').value;
    const container = document.getElementById('rate-overview-result');
    const includePaidLeave = document.getElementById('rate-overview-include-paid-leave').checked;

    if (!startMonth || !endMonth) {
        container.innerHTML = '<p class="loading-text" style="color: #d9534f;">開始月と終了月を指定してください。</p>';
        return;
    }

    if (startMonth > endMonth) {
        container.innerHTML = '<p class="loading-text" style="color: #d9534f;">開始月は終了月以前に指定してください。</p>';
        return;
    }

    container.innerHTML = '<p class="loading-text">計算中...</p>';

    try {
        // 休日データ取得
        const holidaysSnapshot = await db.collection('holidays').get();
        const holidaySet = new Set();
        holidaysSnapshot.forEach(doc => { holidaySet.add(doc.id); });

        // 月のリストを生成
        const months = [];
        const [startY, startM] = startMonth.split('-').map(Number);
        const [endY, endM] = endMonth.split('-').map(Number);
        let curY = startY, curM = startM;
        while (curY < endY || (curY === endY && curM <= endM)) {
            months.push(`${curY}-${String(curM).padStart(2, '0')}`);
            curM++;
            if (curM > 12) { curM = 1; curY++; }
        }

        // 期間全体の開始日・終了日を計算 (21日締め)
        const firstRange = getMonthCycleRange(months[0]);
        const lastRange = getMonthCycleRange(months[months.length - 1]);
        const periodStart = firstRange.start;
        let periodEnd = new Date(lastRange.end);
        periodEnd.setDate(periodEnd.getDate() - 1);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (periodEnd > today) periodEnd = today;

        // 所定労働日数
        const totalWorkDays = countWorkDays(periodStart, periodEnd, holidaySet);

        // 非表示でない従業員のみ
        const visibleEmployees = allEmployeesCache.filter(emp => !emp.isHidden);

        if (visibleEmployees.length === 0) {
            container.innerHTML = '<p class="loading-text">表示対象の従業員がいません。</p>';
            return;
        }

        // 全従業員のデータを並列取得
        const results = await Promise.all(visibleEmployees.map(async (emp) => {
            const attSnapshot = await db.collection('attendance')
                .where('empId', '==', emp.id)
                .where('type', '==', 'in')
                .get();

            const attendedDays = new Set();
            attSnapshot.forEach(doc => {
                const data = doc.data();
                if (data.timestamp) {
                    attendedDays.add(formatDate(toDate(data.timestamp)));
                }
            });

            const appsSnapshot = await db.collection('applications')
                .where('empId', '==', emp.id)
                .where('status', '==', 'completed')
                .get();

            const paidLeaveDays = new Map();
            appsSnapshot.forEach(doc => {
                const data = doc.data();
                if (data.type === '有給' || (data.type && data.type.startsWith('半休'))) {
                    const dayValue = data.type === '有給' ? 1.0 : 0.5;
                    const current = paidLeaveDays.get(data.date) || 0;
                    paidLeaveDays.set(data.date, current + dayValue);
                }
            });

            let attended = 0;
            const cursor = new Date(periodStart);
            while (cursor <= periodEnd) {
                const dateKey = formatDate(cursor);
                let dayCount = 0;
                if (attendedDays.has(dateKey)) dayCount = 1.0;
                if (includePaidLeave && paidLeaveDays.has(dateKey)) {
                    dayCount = Math.min(1.0, dayCount + paidLeaveDays.get(dateKey));
                }
                attended += dayCount;
                cursor.setDate(cursor.getDate() + 1);
            }

            const rate = totalWorkDays > 0 ? (attended / totalWorkDays) * 100 : 0;
            return { id: emp.id, name: emp.name, attended, workDays: totalWorkDays, rate: Math.round(rate) };
        }));

        // 出勤率で降順ソート
        results.sort((a, b) => b.rate - a.rate);

        // テーブル描画
        const displayStart = startMonth.replace('-', '年') + '月';
        const displayEnd = endMonth.replace('-', '年') + '月';

        let html = `<h3 style="margin-bottom: 10px;">${displayStart} ～ ${displayEnd}（所定: ${totalWorkDays}日）</h3>`;
        html += `<div style="overflow-x: auto;"><table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">`;
        html += `<thead><tr style="border-bottom: 2px solid #ddd;">
            <th style="text-align: left; padding: 10px;">ID</th>
            <th style="text-align: left; padding: 10px;">氏名</th>
            <th style="text-align: center; padding: 10px;">出勤日数</th>
            <th style="text-align: center; padding: 10px;">出勤率</th>
        </tr></thead><tbody>`;

        results.forEach(r => {
            const rateColor = r.rate >= 80 ? 'var(--success-color)' : (r.rate >= 50 ? 'var(--warning-color)' : 'var(--danger-color)');
            html += `<tr style="border-bottom: 1px solid #eee; cursor: pointer;" onclick="openEmployeeDetail('${r.id}')">
                <td style="padding: 10px;">${r.id}</td>
                <td style="padding: 10px;">${r.name}</td>
                <td style="text-align: center; padding: 10px;">${r.attended}日</td>
                <td style="text-align: center; padding: 10px; font-weight: bold; color: ${rateColor};">${r.rate}%</td>
            </tr>`;
        });

        html += `</tbody></table></div>`;
        container.innerHTML = html;

    } catch (error) {
        console.error('Rate overview error:', error);
        container.innerHTML = `<p class="loading-text" style="color: #d9534f;">エラー: ${error.message}</p>`;
    }
}

// イベントリスナー
document.getElementById('btn-calc-rate-overview').addEventListener('click', calculateAllEmployeeRates);

// 画面遷移時にデフォルト値を設定
const rateScreen = document.getElementById('screen-admin-rate-overview');
if (rateScreen) {
    new MutationObserver(() => {
        if (rateScreen.classList.contains('active')) initRateOverviewDefaults();
    }).observe(rateScreen, { attributes: true, attributeFilter: ['class'] });
}

// --- 管理者ロック機能 (月次 / コナミコマンド) ---

const KONAMI_CODE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
const RELOCK_CODE = ['a', 'b', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowDown', 'ArrowUp', 'ArrowUp'];
let konamiIndex = 0;
let relockIndex = 0;
let isAdminUnlocked = false;
let dummyFailCount = 0; // 失敗回数カウント

// 現在の年を取得 (YYYY)
function getCurrentYearStr() {
    return new Date().getFullYear().toString();
}

// ロック状態を即時反映（スタイル適用前でもメッセージは出るように）
function toggleLockOverlay(show) {
    const overlay = document.getElementById('admin-lock-overlay');
    const terminal = document.getElementById('fake-terminal-overlay');
    if (!overlay) return;

    if (show) {
        overlay.classList.remove('hidden');
    } else {
        overlay.classList.add('hidden');
        if (terminal) {
            terminal.classList.add('hidden');
            document.getElementById('fatal-error-msg').classList.add('hidden');
        }
        localStorage.removeItem('admin_scare_active'); // 状態クリア
        dummyFailCount = 0; // 解除されたらカウントリセット
    }
}

// ロック状態をチェック
async function checkAdminLock() {
    const overlay = document.getElementById('admin-lock-overlay');
    const btnDummy = document.getElementById('btn-show-dummy-unlock');
    const terminal = document.getElementById('fake-terminal-overlay');
    const fatal = document.getElementById('fatal-error-msg');

    if (!overlay) return false;

    // もし過去に驚かし演出が発動していたら、即座にFATAL ERRORを表示
    if (localStorage.getItem('admin_scare_active') === 'true') {
        if (terminal && fatal) {
            isAdminUnlocked = false;
            terminal.classList.remove('hidden');
            fatal.classList.remove('hidden');
            initKonamiListener();
            return true; // ロック中
        }
    }

    // URLパラメータを確認
    const params = new URLSearchParams(window.location.search);
    const isAdminMode = params.get('mode') === 'admin';

    // 管理者モードでない場合はおとりボタンを隠す
    if (btnDummy) {
        if (isAdminMode) {
            btnDummy.classList.remove('hidden');
        } else {
            btnDummy.classList.add('hidden');
        }
    }

    try {
        const doc = await db.collection('system').doc('lockStatus').get();
        const currentYear = getCurrentYearStr();

        if (doc.exists && doc.data().lastUnlockedYear === currentYear) {
            // 解除済み
            isAdminUnlocked = true;
            toggleLockOverlay(false);
            return false;
        } else {
            // ロック中
            isAdminUnlocked = false;
            toggleLockOverlay(true);
            return true;
        }
    } catch (error) {
        console.error('Lock check error:', error);
        isAdminUnlocked = false;
        toggleLockOverlay(true);
        return true;
    } finally {
        initKonamiListener();
    }
}

// コナミコマンドの監視
function initKonamiListener() {
    window.removeEventListener('keydown', handleGlobalKey);
    window.addEventListener('keydown', handleGlobalKey);
}

function handleGlobalKey(e) {
    // キー判定 (大文字小文字を許容)
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

    if (!isAdminUnlocked) {
        // ロック中: 解除コマンド (↑↑↓↓←→←→BA) を監視
        if (key === KONAMI_CODE[konamiIndex].toLowerCase() || key === KONAMI_CODE[konamiIndex]) {
            konamiIndex++;
            if (konamiIndex === KONAMI_CODE.length) {
                unlockAdmin();
                konamiIndex = 0;
            }
        } else {
            konamiIndex = 0;
        }
    } else {
        // 解除済み: 再ロックコマンド (AB右左右左下下上上) を監視
        if (key === RELOCK_CODE[relockIndex].toLowerCase() || key === RELOCK_CODE[relockIndex]) {
            relockIndex++;
            if (relockIndex === RELOCK_CODE.length) {
                relockAdmin();
                relockIndex = 0;
            }
        } else {
            relockIndex = 0;
        }
    }
}

// ロック解除処理
async function unlockAdmin() {
    try {
        const currentYear = getCurrentYearStr();
        await db.collection('system').doc('lockStatus').set({
            lastUnlockedYear: currentYear,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        isAdminUnlocked = true;
        toggleLockOverlay(false);
        await showAlert('システムロックを解除しました。');
    } catch (error) {
        await showAlert("解除に失敗しました: " + error.message);
    }
}

// 手動再ロック処理 (テスト用)
async function relockAdmin() {
    try {
        // 解除年月をクリアしてロック状態にする
        await db.collection('system').doc('lockStatus').set({
            lastUnlockedYear: "LOCKED",
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        isAdminUnlocked = false;
        toggleLockOverlay(true);
        await showAlert('システムを再ロックしました。');
    } catch (error) {
        await showAlert("再ロックに失敗しました: " + error.message);
    }
}

// 画面遷移時にロックをチェックするフックを仕込む
const originalShowScreen = window.showScreen;
window.showScreen = async function (screenId) {
    // ロック中なら特定の画面以外への遷移を阻止
    const isLocked = await checkAdminLock();

    // ロック中かつ、どうしても表示したいバックグラウンド処理以外
    // (実際には overlay が全面を覆うので transition 自体は実行して良いが念のため)
    if (typeof originalShowScreen === 'function') {
        originalShowScreen(screenId);
    }

    // ロック状態を再適用 (showScreen 内の表示リセットに対応)
    if (isLocked) {
        toggleLockOverlay(true);
    }
};

// ページ読み込み時の初期チェック
checkAdminLock();

// --- ダミー認証ポップアップ (おとり) ---
const dummyOverlay = document.getElementById('dummy-lock-modal');
const btnShowDummy = document.getElementById('btn-show-dummy-unlock');
const btnDummyCancel = document.getElementById('btn-dummy-cancel');
const btnDummySubmit = document.getElementById('btn-dummy-submit');
const dummyPassInput = document.getElementById('dummy-password-input');
const dummyErrorMsg = document.getElementById('dummy-error-msg');

if (btnShowDummy) {
    btnShowDummy.addEventListener('click', () => {
        dummyPassInput.value = '';
        dummyErrorMsg.classList.add('hidden');
        dummyOverlay.classList.remove('hidden');
        dummyPassInput.focus();
    });
}

if (btnDummyCancel) {
    btnDummyCancel.addEventListener('click', () => {
        dummyOverlay.classList.add('hidden');
    });
}

if (btnDummySubmit) {
    btnDummySubmit.addEventListener('click', () => {
        dummyFailCount++;

        if (dummyFailCount >= 3) {
            triggerFakeScare();
        } else {
            // 通常のエラーメッセージ
            dummyErrorMsg.classList.remove('hidden');
            dummyPassInput.value = '';
            dummyPassInput.focus();
        }
    });
}

// 恐怖演出の実行
async function triggerFakeScare() {
    const terminal = document.getElementById('fake-terminal-overlay');
    const body = document.getElementById('terminal-content');
    const fatal = document.getElementById('fatal-error-msg');
    const dummyModal = document.getElementById('dummy-lock-modal');

    if (!terminal || !body) return;

    // UIを隠してターミナルを表示
    localStorage.setItem('admin_scare_active', 'true'); // 状態を保存
    dummyModal.classList.add('hidden');
    terminal.classList.remove('hidden');
    body.innerHTML = '';

    const messages = [
        "Initializing system override...",
        "Bypassing security protocols... [DONE]",
        "CRITICAL: Unauthorized access detected.",
        "Initiating self-destruct sequence to protect data...",
        "Wiping Firestore collection: employees...",
        "Wiping Firestore collection: attendance...",
        "Purging images/...",
        "Deleting sw.js...",
        "Formatting primary partition...",
        "FATAL: Permission denied in kernel space.",
        "Attempting recursive deletion... [FORCED]",
        "System resources exhausted.",
        "I/O Error: Sector 0x882A corrupted.",
        "Memory leak detected @ 0xFF02A388",
        "ERROR: Root filesystem is read-only.",
        "Remounting / as RW...",
        "Deleting /index.html...",
        "Deleting /js/admin.js...",
        "CRITICAL ERROR: Kernel panic!"
    ];

    // 高速スクロール演出
    for (let i = 0; i < 150; i++) {
        const msg = messages[Math.floor(Math.random() * messages.length)];
        const line = document.createElement('div');
        line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
        body.appendChild(line);

        // オートスクロール
        terminal.scrollTop = terminal.scrollHeight;

        // 速度調整 (徐々に加速)
        await new Promise(r => setTimeout(r, Math.max(10, 50 - i)));
    }

    // 最後に致命的エラー表示
    setTimeout(() => {
        fatal.classList.remove('hidden');
    }, 500);
}

// Enterキーでのダミー認証
if (dummyPassInput) {
    dummyPassInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            btnDummySubmit.click();
        }
    });
}

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

// --- 管理者ダッシュボード アラート＆通知 ---

let alertUnsubscribers = [];

function loadAdminAlerts() {
    // 既存リスナーを解除
    alertUnsubscribers.forEach(unsub => unsub());
    alertUnsubscribers = [];

    loadMissingCheckoutAlert();
    loadPendingAppsAlert();
    loadPendingCorrectionsAlert();
}

// 従業員詳細画面: 打刻漏れアラート表示
async function loadDetailMissingCheckoutAlert(empId) {
    const card = document.getElementById('detail-missing-checkout-alert');
    const list = document.getElementById('detail-missing-checkout-list');
    if (!card || !list) return;

    // 初期状態は非表示
    card.classList.add('hidden');
    list.innerHTML = '';

    try {
        // 該当従業員の全打刻データを取得
        const snapshot = await db.collection('attendance')
            .where('empId', '==', empId)
            .orderBy('timestamp', 'asc')
            .get();

        if (snapshot.empty) return;

        // 日ごとに打刻を整理
        const dayMap = {};
        snapshot.forEach(doc => {
            const data = doc.data();
            if (!data.timestamp) return;
            const dateObj = toDate(data.timestamp);
            const dateKey = formatDate(dateObj);
            if (!dayMap[dateKey]) dayMap[dateKey] = [];
            dayMap[dateKey].push({
                type: data.type,
                time: dateObj
            });
        });

        // 本日の日付キー（本日はまだ退勤していない可能性があるため除外）
        const todayKey = formatDate(new Date());

        // 各日の最終打刻が「出勤」のままの日を抽出
        const missingDays = [];
        for (const [dateKey, records] of Object.entries(dayMap)) {
            if (dateKey === todayKey) continue; // 本日は除外
            // 時系列でソート済み（クエリでasc指定）
            const lastRecord = records[records.length - 1];
            if (lastRecord.type === 'in') {
                missingDays.push({
                    date: dateKey,
                    time: lastRecord.time
                });
            }
        }

        if (missingDays.length === 0) return;

        // 日付の降順でソート（新しい順）
        missingDays.sort((a, b) => b.time - a.time);

        // アラートを表示
        card.classList.remove('hidden');
        missingDays.forEach(day => {
            const item = document.createElement('div');
            item.className = 'alert-item';
            item.innerHTML = `
                <span class="alert-item-name">${day.date}</span>
                <span class="alert-item-detail">出勤: ${formatTime(day.time)} — 退勤未打刻</span>
            `;
            list.appendChild(item);
        });
    } catch (error) {
        console.error('Detail missing checkout alert error:', error);
    }
}

// 打刻漏れ検出（前日に出勤して退勤していない従業員）
function loadMissingCheckoutAlert() {
    const card = document.getElementById('alert-missing-checkout');
    const list = document.getElementById('alert-missing-list');
    const badge = document.getElementById('alert-missing-badge');
    if (!card) return;

    // 前日の範囲を計算
    const today = getStartOfToday();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const unsub = db.collection('attendance')
        .where('timestamp', '>=', yesterday)
        .where('timestamp', '<', today)
        .orderBy('timestamp', 'asc')
        .onSnapshot(snapshot => {
            // 従業員ごとの最終打刻状態を集計
            const lastState = {};
            snapshot.forEach(doc => {
                const data = doc.data();
                lastState[data.empId] = {
                    type: data.type,
                    name: data.empName || data.empId,
                    time: toDate(data.timestamp)
                };
            });

            // 最終打刻が「出勤」のままの従業員を抽出
            const missing = Object.entries(lastState)
                .filter(([, info]) => info.type === 'in')
                .map(([empId, info]) => ({ empId, ...info }));

            if (missing.length > 0) {
                card.classList.remove('hidden');
                badge.textContent = missing.length;
                list.innerHTML = '';
                missing.forEach(emp => {
                    const item = document.createElement('div');
                    item.className = 'alert-item';
                    item.style.cursor = 'pointer';
                    item.innerHTML = `
                        <span class="alert-item-name">${emp.name}</span>
                        <span class="alert-item-detail">出勤: ${formatTime(emp.time)} — 退勤未打刻</span>
                    `;
                    // クリックで該当従業員の詳細画面へ遷移
                    item.addEventListener('click', () => {
                        openEmployeeDetail(emp.empId);
                    });
                    list.appendChild(item);
                });
            } else {
                card.classList.add('hidden');
            }
        }, error => {
            console.error('Missing checkout alert error:', error);
        });

    alertUnsubscribers.push(unsub);
}

// 未処理の勤怠申請通知
function loadPendingAppsAlert() {
    const card = document.getElementById('alert-pending-apps');
    const list = document.getElementById('alert-pending-list');
    const badge = document.getElementById('alert-pending-badge');
    if (!card) return;

    const unsub = db.collection('applications')
        .where('status', '==', 'pending')
        .orderBy('createdAt', 'desc')
        .onSnapshot(snapshot => {
            if (!snapshot.empty) {
                card.classList.remove('hidden');
                badge.textContent = snapshot.size;
                list.innerHTML = '';
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const item = document.createElement('div');
                    item.className = 'alert-item';
                    item.style.cursor = 'pointer';
                    item.innerHTML = `
                        <span class="alert-item-name">${data.empName} — ${data.type}</span>
                        <span class="alert-item-detail">${data.date}</span>
                    `;
                    // クリックで従業員詳細へ遷移
                    item.addEventListener('click', () => openEmployeeDetail(data.empId));
                    list.appendChild(item);
                });
            } else {
                card.classList.add('hidden');
            }
        }, error => {
            console.error('Pending apps alert error:', error);
        });

    alertUnsubscribers.push(unsub);
}

// 未処理の打刻修正申請通知
function loadPendingCorrectionsAlert() {
    const card = document.getElementById('alert-pending-corrections');
    const list = document.getElementById('alert-correction-list');
    const badge = document.getElementById('alert-correction-badge');
    if (!card) return;

    const unsub = db.collection('stampCorrections')
        .where('status', '==', 'pending')
        .orderBy('createdAt', 'desc')
        .onSnapshot(snapshot => {
            if (!snapshot.empty) {
                card.classList.remove('hidden');
                badge.textContent = snapshot.size;
                list.innerHTML = '';
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const typeLabel = data.attendanceType === 'in' ? '出勤' : '退勤';
                    const timeStr = formatDateTime(toDate(data.attendanceTime));
                    const item = document.createElement('div');
                    item.className = 'alert-item';
                    item.style.cursor = 'pointer';
                    item.innerHTML = `
                        <span class="alert-item-name">${data.empName} — ${typeLabel}</span>
                        <span class="alert-item-detail">${timeStr}</span>
                    `;
                    // クリックで打刻データ管理画面の修正申請タブへ遷移
                    item.addEventListener('click', () => {
                        showScreen('admin-attendance');
                        switchAdminAttTab('corrections');
                    });
                    list.appendChild(item);
                });
            } else {
                card.classList.add('hidden');
            }
        }, error => {
            console.error('Pending corrections alert error:', error);
        });

    alertUnsubscribers.push(unsub);
}

// --- エラーログ管理 ---

// 画面表示時に自動読み込み
document.getElementById('btn-load-error-logs').addEventListener('click', () => {
    loadErrorLogs();
});

// 画面遷移時のフック（既存の onScreenChanged と統合）
const _originalOnScreenChanged = typeof onScreenChanged === 'function' ? onScreenChanged : null;

// エラーログ画面表示時に自動読み込み（DOMContentLoaded で設定）
document.addEventListener('DOMContentLoaded', () => {
    // MutationObserverでエラーログ画面の表示を監視
    const errorLogScreen = document.getElementById('screen-admin-error-logs');
    if (errorLogScreen) {
        const observer = new MutationObserver(() => {
            if (errorLogScreen.classList.contains('active')) {
                loadErrorLogs();
            }
        });
        observer.observe(errorLogScreen, { attributes: true, attributeFilter: ['class'] });
    }
});

// エラーログ一覧を読み込む
async function loadErrorLogs() {
    const listEl = document.getElementById('error-log-list');
    const countEl = document.getElementById('error-log-count');
    const filterVal = document.getElementById('error-log-filter').value;

    listEl.innerHTML = '<p class="loading-text">読み込み中...</p>';
    countEl.textContent = '';

    try {
        let query = db.collection('errorLogs').orderBy('timestamp', 'desc').limit(100);

        if (filterVal === 'unresolved') {
            query = query.where('resolved', '==', false);
        } else if (filterVal === 'resolved') {
            query = query.where('resolved', '==', true);
        }

        const snapshot = await query.get();
        listEl.innerHTML = '';

        if (snapshot.empty) {
            listEl.innerHTML = '<p style="color: #888; text-align: center; padding: 20px;">エラーログはありません</p>';
            countEl.textContent = '';
            return;
        }

        countEl.textContent = `${snapshot.size} 件のエラーログ（最大100件）`;

        snapshot.forEach(doc => {
            const data = doc.data();
            const div = document.createElement('div');
            div.className = 'error-log-item';
            div.style.cssText = 'border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; margin-bottom: 10px; background: var(--background-color);';

            if (data.resolved) {
                div.style.opacity = '0.6';
            }

            const timestamp = data.timestamp ? formatDateTime(toDate(data.timestamp)) : '不明';
            const statusBadge = data.resolved
                ? '<span style="background: var(--success-color); color: #fff; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem;">解決済み</span>'
                : '<span style="background: var(--danger-color); color: #fff; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem;">未解決</span>';

            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div style="font-size: 0.8rem; color: #888;">
                        ${timestamp} ${statusBadge}
                    </div>
                    <div style="display: flex; gap: 5px;">
                        ${!data.resolved ? `<button class="btn-primary small" style="padding: 3px 10px; font-size: 0.75rem;" onclick="markErrorResolved('${doc.id}')">解決済み</button>` : ''}
                        <button class="btn-secondary small" style="padding: 3px 8px; font-size: 0.75rem;" onclick="toggleErrorDetail('${doc.id}')">詳細</button>
                    </div>
                </div>
                <div style="font-weight: bold; color: var(--danger-color); margin-bottom: 4px; word-break: break-all;">
                    ${escapeHtml(data.message || '(メッセージなし)')}
                </div>
                <div style="font-size: 0.8rem; color: #888;">
                    ${data.context ? '📍 ' + escapeHtml(data.context) : ''}
                    ${data.screen ? ' | 画面: ' + escapeHtml(data.screen) : ''}
                    ${data.empId ? ' | 従業員: ' + escapeHtml(data.empId) : ''}
                </div>
                <div id="error-detail-${doc.id}" class="hidden" style="margin-top: 10px; padding: 10px; background: #fff; border-radius: 6px; border: 1px solid var(--border-color); font-size: 0.8rem;">
                    <div style="margin-bottom: 8px;">
                        <strong>スタックトレース:</strong>
                        <pre style="white-space: pre-wrap; word-break: break-all; margin: 5px 0; padding: 8px; background: #f1f1f1; border-radius: 4px; max-height: 200px; overflow-y: auto; font-size: 0.75rem;">${escapeHtml(data.stack || '(なし)')}</pre>
                    </div>
                    <div style="margin-bottom: 4px;"><strong>URL:</strong> ${escapeHtml(data.url || '不明')}</div>
                    <div><strong>ブラウザ:</strong> ${escapeHtml(data.userAgent || '不明')}</div>
                </div>
            `;

            listEl.appendChild(div);
        });

    } catch (error) {
        console.error('Error loading error logs:', error);
        listEl.innerHTML = `<p style="color: var(--danger-color);">エラーログの読み込みに失敗しました: ${error.message}</p>`;
    }
}

// HTMLエスケープ
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// エラー詳細の展開/折りたたみ
function toggleErrorDetail(docId) {
    const detail = document.getElementById(`error-detail-${docId}`);
    if (detail) {
        detail.classList.toggle('hidden');
    }
}

// エラーを解決済みにマーク
async function markErrorResolved(docId) {
    try {
        await db.collection('errorLogs').doc(docId).update({
            resolved: true,
            resolvedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        loadErrorLogs(); // リスト再読み込み
    } catch (error) {
        console.error('Mark resolved error:', error);
        await showAlert("更新に失敗しました: " + error.message);
    }
}

// 解決済みエラーを一括削除
document.getElementById('btn-delete-resolved-logs').addEventListener('click', async () => {
    const snapshot = await db.collection('errorLogs')
        .where('resolved', '==', true)
        .get();

    if (snapshot.empty) {
        await showAlert('削除対象の解決済みログはありません。');
        return;
    }

    if (!(await showConfirm(`解決済みの ${snapshot.size} 件のエラーログを完全に削除しますか？\n（この操作は元に戻せません）`))) return;

    try {
        const batch = db.batch();
        snapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        await showAlert(`${snapshot.size} 件を削除しました。`);
        loadErrorLogs();
    } catch (error) {
        console.error('Delete resolved logs error:', error);
        await showAlert("削除に失敗しました: " + error.message);
    }
});
