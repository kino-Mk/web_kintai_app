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

            // 2. 管理者画面用 (編集機能付き)
            const li = document.createElement('li');
            li.className = 'admin-list-item';
            li.id = `emp-row-${emp.id}`;
            li.style.display = 'flex';
            li.style.flexDirection = 'column';
            li.style.padding = '10px';
            li.style.borderBottom = '1px solid #eee';
            li.style.gap = '10px';

            // 表示モードのHTML
            const viewModeHtml = `
                <div class="view-mode" style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
                    <div style="font-weight: bold;">
                        <span id="disp-id-${emp.id}">${emp.id}</span>: <span id="disp-name-${emp.id}">${emp.name}</span>
                    </div>
                    <div>
                        <button class="btn-secondary" onclick="toggleEditMode('${emp.id}')" style="padding: 5px 10px; font-size: 0.8rem;">編集</button>
                    </div>
                </div>
                <div class="view-mode-controls" style="display: flex; gap: 10px; align-items: center; margin-top: 5px;">
                    <span style="font-size: 0.9rem;">有給残: ${emp.paidLeave !== undefined ? emp.paidLeave : 0}</span>
                </div>
            `;

            // 編集モードのHTML (初期は非表示)
            const editModeHtml = `
                <div class="edit-mode" style="display: none; width: 100%; flex-direction: column; gap: 5px;">
                    <div style="display: flex; gap: 5px; align-items: center;">
                        <label>ID:</label>
                        <input type="text" id="edit-id-${emp.id}" value="${emp.id}" style="width: 80px; padding: 5px;">
                        <span style="font-size: 0.8rem; color: red;">※変更時、履歴は引き継がれません</span>
                    </div>
                    <div style="display: flex; gap: 5px; align-items: center;">
                        <label>名:</label>
                        <input type="text" id="edit-name-${emp.id}" value="${emp.name}" style="flex: 1; padding: 5px;">
                    </div>
                    <div style="display: flex; gap: 5px; align-items: center;">
                        <label>有給:</label>
                        <input type="number" id="edit-leave-${emp.id}" value="${emp.paidLeave !== undefined ? emp.paidLeave : 0}" style="width: 60px; padding: 5px;">
                    </div>
                    <div style="display: flex; gap: 10px; margin-top: 5px;">
                        <button class="btn-primary" onclick="saveEmployeeByType('${emp.id}')" style="padding: 5px 15px;">保存</button>
                        <button class="btn-secondary" onclick="cancelEditMode('${emp.id}')" style="padding: 5px 15px;">キャンセル</button>
                        <button class="delete-btn" onclick="deleteEmployee('${emp.id}', '${emp.name}')" style="margin-left: auto;">削除</button>
                    </div>
                </div>
            `;

            li.innerHTML = viewModeHtml + editModeHtml;
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


// 編集モード切り替え
function toggleEditMode(empId) {
    const row = document.getElementById(`emp-row-${empId}`);
    if (row) {
        row.querySelector('.view-mode').style.display = 'none';
        row.querySelector('.view-mode-controls').style.display = 'none';
        row.querySelector('.edit-mode').style.display = 'flex';
    }
}

function cancelEditMode(empId) {
    const row = document.getElementById(`emp-row-${empId}`);
    if (row) {
        row.querySelector('.view-mode').style.display = 'flex';
        row.querySelector('.view-mode-controls').style.display = 'flex';
        row.querySelector('.edit-mode').style.display = 'none';

        // 値をリセット（必要なら）
        // document.getElementById(`edit-id-${empId}`).value = empId;
    }
}

// 従業員情報の保存 (ID変更対応)
function saveEmployeeByType(originalId) {
    const newId = document.getElementById(`edit-id-${originalId}`).value.trim();
    const newName = document.getElementById(`edit-name-${originalId}`).value.trim();
    const newLeave = parseFloat(document.getElementById(`edit-leave-${originalId}`).value);

    if (!newId || !newName) {
        alert("IDと氏名は必須です");
        return;
    }

    if (newId === originalId) {
        // ID変更なし -> Update
        db.collection("employees").doc(originalId).update({
            name: newName,
            paidLeave: newLeave
        }).then(() => {
            alert("更新しました");
            cancelEditMode(originalId);
        }).catch(err => alert("更新失敗: " + err.message));
    } else {
        // ID変更あり -> Create New & Delete Old
        if (!confirm(`IDを ${originalId} から ${newId} に変更します。\n\n【重要】\n過去の打刻データや申請データとの紐付けは失われます。\n（データ自体は残りますが、この従業員の履歴として表示されなくなります）\n\nよろしいですか？`)) {
            return;
        }

        const newDocRef = db.collection("employees").doc(newId);

        // 重複チェック
        newDocRef.get().then(doc => {
            if (doc.exists) {
                alert("指定された新しいIDは既に使用されています。");
                return;
            }

            // データコピー
            db.collection("employees").doc(originalId).get().then(oldDoc => {
                const data = oldDoc.data();
                data.id = newId;
                data.name = newName;
                data.paidLeave = newLeave;
                // createdAtは維持するか、新しくするか。維持推奨

                newDocRef.set(data).then(() => {
                    // 古いデータを削除
                    db.collection("employees").doc(originalId).delete().then(() => {
                        alert("IDを変更して更新しました");
                        // 自動的にリストが再描画される
                    });
                });
            });
        }).catch(err => alert("エラー: " + err.message));
    }
}
