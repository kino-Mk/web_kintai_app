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
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.padding = '5px';
            li.style.borderBottom = '1px solid #eee';

            const span = document.createElement('span');
            span.textContent = `${emp.id}: ${emp.name}`;

            const delBtn = document.createElement('button');
            delBtn.textContent = '削除';
            delBtn.className = 'delete-btn';
            delBtn.onclick = () => deleteEmployee(doc.id, emp.name);

            li.appendChild(span);
            li.appendChild(delBtn);
            listAdmin.appendChild(li);
        });
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
function loadAdminData() {
    // 管理者用の従業員リストは共有関数ですでに読み込まれているが、
    // ここでは申請を読み込む。
    const listApp = document.getElementById('admin-applications-list');

    // 最近の申請をリッスン
    db.collection("applications").orderBy("createdAt", "desc").limit(50).onSnapshot((snapshot) => {
        listApp.innerHTML = "";
        if (snapshot.empty) {
            listApp.innerHTML = "<p>申請はありません。</p>";
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const div = document.createElement('div');
            div.className = 'application-item';
            div.style.marginBottom = '10px';
            div.innerHTML = `
                <div><strong>${data.type}</strong>: ${data.empName} (${data.empId})</div>
                <div style="font-size: 0.9rem; color: #666;">対象日: ${data.date}</div>
                <div style="font-size: 0.9rem;">理由: ${data.reason || 'なし'}</div>
            `;
            listApp.appendChild(div);
        });
    });
}
