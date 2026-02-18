
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
