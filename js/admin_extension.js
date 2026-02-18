
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
