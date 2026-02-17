// js/attendance.js

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
