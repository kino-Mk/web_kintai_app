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


