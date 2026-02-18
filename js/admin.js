// js/admin.js

// --- 従業員管理 ---

// 管理者リストと選択画面の両方に従業員を読み込む
function loadEmployeesForSelection() {
    const listSelection = document.getElementById('employee-list');
    const listAdmin = document.getElementById('admin-employee-list-view');

    db.collection("employees").orderBy("id").onSnapshot((snapshot) => {
        listSelection.innerHTML = "";
        listAdmin.innerHTML = "";

        if (snapshot.empty) {
            listSelection.innerHTML = "<p>従業員が登録されていません。</p>";
            return;
        }

        snapshot.forEach((doc) => {
            const emp = doc.data();
            emp.docId = doc.id; // 必要に応じてFirestoreドキュメントIDを保存（現状はemp.idをキーとして使用）

            // 1. 選択画面用
            const btn = document.createElement('div');
            btn.className = 'employee-item';
            btn.innerHTML = `<strong>${emp.id}</strong>: ${emp.name}`;
            btn.onclick = () => selectEmployee(emp); // app.jsで定義
            listSelection.appendChild(btn);

            // 2. 管理者画面用
            const li = document.createElement('li');
            li.className = 'admin-list-item'; // CSSでスタイリングするためにクラス追加
            li.style.display = 'flex';
            li.style.flexDirection = 'column'; // モバイル対応のため縦並び基本、PCで横並び
            li.style.padding = '10px';
            li.style.borderBottom = '1px solid #eee';
            li.style.gap = '10px';

            // 情報表示エリア
            const infoDiv = document.createElement('div');
            infoDiv.textContent = `${emp.id}: ${emp.name}`;
            infoDiv.style.fontWeight = 'bold';

            // 有給管理エリア
            const controlDiv = document.createElement('div');
            controlDiv.style.display = 'flex';
            controlDiv.style.alignItems = 'center';
            controlDiv.style.gap = '10px';

            const leaveLabel = document.createElement('span');
            leaveLabel.textContent = '有給残:';
            leaveLabel.style.fontSize = '0.9rem';

            const leaveInput = document.createElement('input');
            leaveInput.type = 'number';
            leaveInput.value = emp.paidLeave !== undefined ? emp.paidLeave : 0; // デフォルト0
            leaveInput.style.width = '60px';
            leaveInput.style.padding = '5px';

            const updateBtn = document.createElement('button');
            updateBtn.textContent = '更新';
            updateBtn.className = 'btn-secondary'; // 既存クラス流用
            updateBtn.style.padding = '5px 10px';
            updateBtn.style.fontSize = '0.8rem';
            updateBtn.onclick = () => updatePaidLeave(doc.id, leaveInput.value);

            const delBtn = document.createElement('button');
            delBtn.textContent = '削除';
            delBtn.className = 'delete-btn'; // 既存クラス流用 (赤色)
            delBtn.onclick = () => deleteEmployee(doc.id, emp.name);

            controlDiv.appendChild(leaveLabel);
            controlDiv.appendChild(leaveInput);
            controlDiv.appendChild(updateBtn);
            controlDiv.appendChild(delBtn);

            li.appendChild(infoDiv);
            li.appendChild(controlDiv);
            listAdmin.appendChild(li);
        });

        // 3. フィルタ用プルダウンの更新 (処理済み申請用)
        const filterSelect = document.getElementById('filter-employee');
        if (filterSelect) {
            // 現在の選択値を保持
            const currentVal = filterSelect.value;
            filterSelect.innerHTML = '<option value="">全ての従業員</option>';
            snapshot.forEach((doc) => {
                const emp = doc.data();
                const option = document.createElement('option');
                option.value = emp.id;
                option.textContent = emp.name;
                filterSelect.appendChild(option);
            });
            filterSelect.value = currentVal;
        }
    }, (error) => {
        console.error("Error loading employees:", error);
    });
}

// 従業員追加
document.getElementById('btn-add-employee').addEventListener('click', () => {
    const idInput = document.getElementById('admin-emp-id');
    const nameInput = document.getElementById('admin-emp-name');
    const id = idInput.value.trim();
    const name = nameInput.value.trim();

    if (!id || !name) {
        alert("IDと氏名を入力してください");
        return;
    }

    // 重複を防ぐためIDをドキュメントIDとして使用
    db.collection("employees").doc(id).set({
        id: id,
        name: name,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    })
        .then(() => {
            alert("従業員を登録しました");
            idInput.value = "";
            nameInput.value = "";
        })
        .catch((error) => {
            console.error("Error adding employee: ", error);
            // エラーの詳細を表示
            alert("エラーが発生しました: " + error.message + "\nCode: " + error.code);
        });
});

// 従業員削除
function deleteEmployee(docId, name) {
    if (confirm(`${name} さんを削除してもよろしいですか？`)) {
        db.collection("employees").doc(docId).delete()
            .then(() => {
                alert("削除しました");
            })
            .catch((error) => {
                alert("削除に失敗しました: " + error.message);
            });
    }
}

// --- CSV エクスポート機能 ---

// 1. 生データエクスポート: "従業員ID, 氏名, YYYYMMDDHHMM"
document.getElementById('btn-export-csv').addEventListener('click', async () => {
    try {
        const snapshot = await db.collection("attendance").orderBy("timestamp", "desc").get();

        let csvContent = "従業員ID, 従業員氏名, 打刻日時\n";

        snapshot.forEach(doc => {
            const data = doc.data();
            // タイムスタンプを YYYYMMDDHHMM 形式に変換
            const date = data.timestamp.toDate();
            const yyyy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const dd = String(date.getDate()).padStart(2, '0');
            const hh = String(date.getHours()).padStart(2, '0');
            const min = String(date.getMinutes()).padStart(2, '0');

            const formattedTime = `${yyyy}${mm}${dd}${hh}${min}`;

            csvContent += `${data.empId}, ${data.empName}, ${formattedTime}\n`;
        });

        downloadCSV(csvContent, "attendance_raw.csv");
    } catch (error) {
        console.error("Export error:", error);
        alert("エクスポートに失敗しました: " + error.message);
    }
});

// 2. 月次集計エクスポート
document.getElementById('btn-export-monthly-csv').addEventListener('click', async () => {
    try {
        // 全打刻データを取得 (最適化: 日付範囲フィルタがあればより良い)
        const snapshot = await db.collection("attendance").orderBy("timestamp", "asc").get();

        // 構造: Map<EmpID, Map<DateString, {in: Time, out: Time}>>
        const records = {};

        snapshot.forEach(doc => {
            const data = doc.data();
            const dateObj = data.timestamp.toDate();
            const dateKey = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD

            if (!records[data.empId]) records[data.empId] = { name: data.empName, days: {} };
            if (!records[data.empId].days[dateKey]) records[data.empId].days[dateKey] = {};

            const timeStr = dateObj.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

            if (data.type === 'in') {
                if (!records[data.empId].days[dateKey].in) records[data.empId].days[dateKey].in = timeStr;
            } else if (data.type === 'out') {
                records[data.empId].days[dateKey].out = timeStr; // 最新の退勤で上書き
            }
        });

        let csvContent = "従業員ID, 氏名, 日付, 出勤, 退勤\n";

        for (const empId in records) {
            const emp = records[empId];
            for (const dateKey in emp.days) {
                const day = emp.days[dateKey];
                csvContent += `${empId}, ${emp.name}, ${dateKey}, ${day.in || ''}, ${day.out || ''}\n`;
            }
        }

        downloadCSV(csvContent, "attendance_monthly.csv");
    } catch (error) {
        console.error("Export error:", error);
        alert("エクスポートに失敗しました: " + error.message);
    }
});

function downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
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

// --- 申請表示 ---
// --- 申請表示 (ワークフロー) ---

function loadAdminData() {
    loadPendingApplications();
    // 処理済みはデフォルトでは検索しないか、あるいは今月のデータを出すなど
    // ここでは初期表示として「条件指定なし」または「今月」を表示してもよい
    // 今回はユーザーが検索ボタンを押すまで空、または初期値で検索
    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7); // YYYY-MM
    document.getElementById('filter-month').value = currentMonth;
    loadCompletedApplications(currentMonth, "");
}

// 未処理申請の読み込み
function loadPendingApplications() {
    const listPending = document.getElementById('admin-pending-list');

    // status がない (過去データ互換) または 'pending' のもの
    // Firestore ORクエリは制限があるため、ここでは 'pending' を明示的に扱うか、
    // 配列検索 ('in') を使う。既存データにstatusがない場合を考慮し、
    // まずは単純に orderBy だけしてクライアントサイドでフィルタするか、
    // データ移行が必要。
    // 簡易対応: 全件取得して status !== 'completed' を表示 (件数が少なければこれでOK)

    db.collection("applications")
        .orderBy("createdAt", "desc") // 新しい順
        .limit(50)
        .onSnapshot((snapshot) => {
            listPending.innerHTML = "";
            if (snapshot.empty) {
                listPending.innerHTML = "<p>未処理の申請はありません。</p>";
                return;
            }

            let count = 0;
            snapshot.forEach(doc => {
                const data = doc.data();
                // ステータス判定: 'completed' 以外を表示 (undefined, null, 'pending')
                if (data.status === 'completed') return;

                count++;
                const div = document.createElement('div');
                div.className = 'application-item';
                div.style.marginBottom = '10px';
                div.style.borderLeft = '4px solid #f0ad4e'; // Pending color
                div.innerHTML = `
                <div><strong>${data.type}</strong>: ${data.empName} (${data.empId})</div>
                <div style="font-size: 0.9rem; color: #666;">対象日: ${data.date}</div>
                <div style="font-size: 0.9rem;">理由: ${data.reason || 'なし'}</div>
                <div style="margin-top: 5px;">
                    <button onclick="completeApplication('${doc.id}')" class="btn-primary" style="padding: 2px 8px; font-size: 0.8rem;">完了にする</button>
                </div>
            `;
                listPending.appendChild(div);
            });

            if (count === 0) {
                listPending.innerHTML = "<p>未処理の申請はありません。</p>";
            }
        });
}

// 処理済み申請の読み込み (フィルタ付き)
function loadCompletedApplications(month, empId) {
    const listCompleted = document.getElementById('admin-completed-list');
    listCompleted.innerHTML = '<p class="loading-text">検索中...</p>';

    let query = db.collection("applications")
        .where("status", "==", "completed");

    // 日付フィルタ (文字列比較 YYYY-MM)
    if (month) {
        // "2023-10" -> "2023-10-01" 〜 "2023-10-31"
        // dateフィールドは文字列 "YYYY-MM-DD"
        query = query.where("date", ">=", month + "-01")
            .where("date", "<=", month + "-31");
    }

    // 従業員フィルタ
    if (empId) {
        query = query.where("empId", "==", empId);
    }

    query.orderBy("date", "desc") // 日付順
        .limit(50)
        .get() // 過去ログはリアルタイムでなくてよい (get)
        .then((snapshot) => {
            listCompleted.innerHTML = "";
            if (snapshot.empty) {
                listCompleted.innerHTML = "<p>該当する履歴はありません。</p>";
                return;
            }

            snapshot.forEach(doc => {
                const data = doc.data();
                const div = document.createElement('div');
                div.className = 'application-item';
                div.style.marginBottom = '10px';
                div.style.borderLeft = '4px solid #5cb85c'; // Completed color
                div.innerHTML = `
                    <div><strong>${data.type}</strong>: ${data.empName} (${data.empId})</div>
                    <div style="font-size: 0.9rem; color: #666;">対象日: ${data.date}</div>
                    <div style="font-size: 0.9rem;">理由: ${data.reason || 'なし'}</div>
                    <div style="font-size: 0.8rem; color: #aaa;">完了済み</div>
                `;
                listCompleted.appendChild(div);
            });
        })
        .catch(error => {
            console.error("Error loading completed apps:", error);
            listCompleted.innerHTML = `<p>エラー: ${error.message}</p>`;
            // インデックスが必要な場合のヒント
            if (error.code === 'failed-precondition') {
                console.warn("Index needed for this query.");
            }
        });
}

// 申請を完了ステータスにする
function completeApplication(docId) {
    if (!confirm("この申請を「処理済み」にしますか？")) return;

    db.collection("applications").doc(docId).update({
        status: 'completed',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    })
        .then(() => {
            // alert("処理済みにしました"); 
            // onSnapshotにより自動でリストから消えるのでアラート不要またはToast
        })
        .catch(err => {
            alert("更新失敗: " + err.message);
        });
}

// 検索ボタンイベント
document.getElementById('btn-filter-apply').addEventListener('click', () => {
    const month = document.getElementById('filter-month').value;
    const empId = document.getElementById('filter-employee').value;
    loadCompletedApplications(month, empId);
});

// 有給残日数の更新
function updatePaidLeave(docId, days) {
    const numDays = parseFloat(days);
    if (isNaN(numDays)) {
        alert("有効な数値を入力してください");
        return;
    }

    db.collection("employees").doc(docId).update({
        paidLeave: numDays
    })
        .then(() => {
            alert("有給残日数を更新しました");
        })
        .catch((error) => {
            console.error("Error updating paid leave:", error);
            alert("更新に失敗しました: " + error.message);
        });
}
