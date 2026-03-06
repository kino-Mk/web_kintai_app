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


// --- 管理者ダッシュボード アラート＆通知 ---

let alertUnsubscribers = [];
let adminAlertsLoaded = false;

function loadAdminAlerts() {
    // 既にリスナーが登録済みの場合は再登録しない（画面遷移ごとの再読み込み負荷を軽減）
    if (adminAlertsLoaded) return;

    // 既存リスナーがあれば念のため解除
    alertUnsubscribers.forEach(unsub => unsub());
    alertUnsubscribers = [];

    loadMissingCheckoutAlert();
    loadPendingAppsAlert();
    loadPendingCorrectionsAlert();

    adminAlertsLoaded = true;
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

// 打刻漏れ検出（過去7日間で出勤して退勤していない従業員）
function loadMissingCheckoutAlert() {
    const card = document.getElementById('alert-missing-checkout');
    const list = document.getElementById('alert-missing-list');
    const badge = document.getElementById('alert-missing-badge');
    if (!card) return;

    // 過去7日間の範囲を計算
    const today = getStartOfToday();
    const past = new Date(today);
    past.setDate(past.getDate() - 7);

    const unsub = db.collection('attendance')
        .where('timestamp', '>=', past)
        .where('timestamp', '<', today)
        .orderBy('timestamp', 'asc')
        .onSnapshot(snapshot => {
            // 日次・従業員ごとの最終打刻状態を集計
            const dailyStates = {};
            snapshot.forEach(doc => {
                const data = doc.data();
                const time = toDate(data.timestamp);
                const dateStr = time.getFullYear() + '-' + String(time.getMonth() + 1).padStart(2, '0') + '-' + String(time.getDate()).padStart(2, '0');

                if (!dailyStates[data.empId]) dailyStates[data.empId] = {};
                dailyStates[data.empId][dateStr] = {
                    type: data.type,
                    name: data.empName || data.empId,
                    time: time
                };
            });

            // 同日内で最終打刻が「出勤」のままのものを抽出
            const missing = [];
            for (const empId in dailyStates) {
                for (const dateStr in dailyStates[empId]) {
                    const info = dailyStates[empId][dateStr];
                    if (info.type === 'in') {
                        missing.push({
                            empId: empId,
                            name: info.name,
                            dateStr: dateStr,
                            time: info.time
                        });
                    }
                }
            }

            // 日時が新しい順にソート
            missing.sort((a, b) => b.time - a.time);

            if (missing.length > 0) {
                card.classList.remove('hidden');
                badge.textContent = missing.length;
                list.innerHTML = '';
                missing.forEach(emp => {
                    const item = document.createElement('div');
                    item.className = 'alert-item';
                    item.style.cursor = 'pointer';
                    // MM/DD 形式で日付を表示
                    const displayDate = emp.dateStr.slice(5).replace('-', '/');
                    item.innerHTML = `
                        <span class="alert-item-name">${emp.name} (${displayDate})</span>
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
                    ${data.consoleLogs && data.consoleLogs.length > 0 ? `
                    <div style="margin-bottom: 8px;">
                        <strong>直近のコンソールログ:</strong>
                        <pre style="white-space: pre-wrap; word-break: break-all; margin: 5px 0; padding: 8px; background: #222; color: #0f0; border-radius: 4px; max-height: 200px; overflow-y: auto; font-size: 0.75rem;">${escapeHtml(data.consoleLogs.join('\\n'))}</pre>
                    </div>` : ''}
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


