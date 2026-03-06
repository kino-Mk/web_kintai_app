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


