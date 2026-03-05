/**
 * 共通利用するユーティリティ関数
 */

/**
 * Dateオブジェクトを YYYY-MM-DD 形式の文字列に変換
 * @param {Date} date 
 * @returns {string}
 */
function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Dateオブジェクトを YYYY/MM/DD HH:mm:ss 形式の文字列に変換
 * @param {Date} date 
 * @returns {string}
 */
function formatDateTime(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${y}/${m}/${d} ${hh}:${mm}:${ss}`;
}

/**
 * Dateオブジェクトを HH:mm 形式の文字列に変換
 * @param {Date} date 
 * @returns {string}
 */
function formatTime(date) {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
}

/**
 * YYYYMMDDHHMM 形式の文字列を生成 (CSVエクスポート用)
 * @param {Date} date 
 * @returns {string}
 */
function formatCsvTime(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${y}${m}${d}${hh}${mm}`;
}

/**
 * 今日の開始時刻 (00:00:00) を取得
 * @returns {Date}
 */
function getStartOfToday() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
}

/**
 * 21日締めサイクルの月次範囲を取得
 * @param {string} monthStr "YYYY-MM"
 * @returns {{start: Date, end: Date}}
 */
function getMonthCycleRange(monthStr) {
    const [year, mon] = monthStr.split('-').map(Number);
    // 開始日: 選択月の前月21日 00:00:00
    const start = new Date(year, mon - 2, 21, 0, 0, 0);
    // 終了日: 選択月の当月21日 00:00:00 (未満)
    const end = new Date(year, mon - 1, 21, 0, 0, 0);
    return { start, end };
}

/**
 * FirestoreのTimestampをDateに安全に変換
 * @param {any} ts 
 * @returns {Date}
 */
function toDate(ts) {
    if (!ts) return new Date();
    if (typeof ts.toDate === 'function') return ts.toDate();
    return new Date(ts);
}

/**
 * 有給残日数の計算ロジック (ウォーターフォール方式)
 * @param {Array} grants 
 * @param {number} totalUsedDays 
 * @returns {object}
 */
function calculateRemainingPaidLeave(grants, totalUsedDays) {
    const now = new Date();
    const todayStr = formatDate(now);

    let totalGrantedValid = 0; // 未失効の付与合計
    let totalExpired = 0;      // 失効した付与合計
    let remainingUsed = totalUsedDays;

    const processedGrants = grants.map(g => {
        const grantDate = g.grantDate;
        // 有効期限: 付与日の2年後の前日 (簡易的に +2年)
        const expDateObj = new Date(grantDate);
        expDateObj.setFullYear(expDateObj.getFullYear() + 2);
        const expireDate = formatDate(expDateObj);

        const isExpired = expireDate <= todayStr;
        const grantAmount = parseFloat(g.amount);

        let usedFromThis = 0;
        let leftInThis = 0;

        if (isExpired) {
            totalExpired += grantAmount;
            usedFromThis = Math.min(grantAmount, remainingUsed);
            remainingUsed -= usedFromThis;
            leftInThis = 0;
        } else {
            totalGrantedValid += grantAmount;
            usedFromThis = Math.min(grantAmount, remainingUsed);
            remainingUsed -= usedFromThis;
            leftInThis = grantAmount - usedFromThis;
        }

        return {
            ...g,
            expireDate,
            isExpired,
            usedFromThis,
            leftInThis
        };
    });

    const currentRemaining = processedGrants.reduce((sum, g) => sum + g.leftInThis, 0);

    return {
        processedGrants,
        summary: {
            totalGrantedValid,
            totalUsedDays,
            totalExpired,
            remaining: currentRemaining
        }
    };
}

// --- カスタムダイアログ（alert / confirm の代替） ---

/**
 * カスタムアラートダイアログを表示（alert の代替）
 * @param {string} message 
 * @returns {Promise<void>}
 */
function showAlert(message) {
    return new Promise(resolve => {
        const overlay = document.getElementById('custom-dialog-overlay');
        const msgEl = document.getElementById('custom-dialog-message');
        const okBtn = document.getElementById('custom-dialog-ok');
        const cancelBtn = document.getElementById('custom-dialog-cancel');

        // メッセージ内の改行を <br> に変換
        msgEl.innerHTML = message.replace(/\n/g, '<br>');

        // 確認ボタンを非表示、OKのみ
        cancelBtn.classList.add('hidden');
        okBtn.textContent = 'OK';

        // クリーンアップ用
        const cleanup = () => {
            overlay.classList.add('hidden');
            okBtn.removeEventListener('click', onOk);
        };

        const onOk = () => { cleanup(); resolve(); };
        okBtn.addEventListener('click', onOk);

        overlay.classList.remove('hidden');
        okBtn.focus();
    });
}

/**
 * カスタム確認ダイアログを表示（confirm の代替）
 * @param {string} message 
 * @returns {Promise<boolean>}
 */
function showConfirm(message) {
    return new Promise(resolve => {
        const overlay = document.getElementById('custom-dialog-overlay');
        const msgEl = document.getElementById('custom-dialog-message');
        const okBtn = document.getElementById('custom-dialog-ok');
        const cancelBtn = document.getElementById('custom-dialog-cancel');

        msgEl.innerHTML = message.replace(/\n/g, '<br>');

        cancelBtn.classList.remove('hidden');
        okBtn.textContent = 'はい';

        const cleanup = () => {
            overlay.classList.add('hidden');
            okBtn.removeEventListener('click', onOk);
            cancelBtn.removeEventListener('click', onCancel);
        };

        const onOk = () => { cleanup(); resolve(true); };
        const onCancel = () => { cleanup(); resolve(false); };

        okBtn.addEventListener('click', onOk);
        cancelBtn.addEventListener('click', onCancel);

        overlay.classList.remove('hidden');
        okBtn.focus();
    });
}

// --- エラーレポート機能 ---

/**
 * 同一エラーの重複送信防止用キャッシュ
 * キー: エラーメッセージのハッシュ, 値: 最終送信時刻
 */
const _errorReportCache = {};
const ERROR_REPORT_INTERVAL_MS = 5 * 60 * 1000; // 同一エラーは5分間に1回のみ

/**
 * エラーをFirestoreに記録する
 * @param {Error|string} error エラーオブジェクトまたはメッセージ
 * @param {string} context エラー発生箇所の説明（例: "従業員一覧読み込み"）
 */
function reportError(error, context = '') {
    try {
        // db が未初期化の場合は何もしない
        if (typeof db === 'undefined' || !db) return;

        const message = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? (error.stack || '') : '';

        // 重複チェック（同一メッセージを5分以内に再送しない）
        const cacheKey = message + context;
        const now = Date.now();
        if (_errorReportCache[cacheKey] && (now - _errorReportCache[cacheKey]) < ERROR_REPORT_INTERVAL_MS) {
            return; // 重複送信を防止
        }
        _errorReportCache[cacheKey] = now;

        // 現在の画面を取得
        let currentScreen = '';
        try {
            const activeEl = document.querySelector('.screen.active');
            if (activeEl) currentScreen = activeEl.id || '';
        } catch (_) { /* 無視 */ }

        // 操作中の従業員ID
        let empId = '';
        try {
            if (typeof currentEmployee !== 'undefined' && currentEmployee) {
                empId = currentEmployee.id || '';
            } else if (typeof currentDetailEmpId !== 'undefined' && currentDetailEmpId) {
                empId = currentDetailEmpId;
            }
        } catch (_) { /* 無視 */ }

        // Firestoreに保存（バックグラウンド、失敗しても影響なし）
        db.collection('errorLogs').add({
            message: message,
            stack: stack.substring(0, 2000), // スタックトレースは2000文字まで
            context: context,
            screen: currentScreen,
            empId: empId,
            userAgent: navigator.userAgent,
            url: window.location.href,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            resolved: false
        }).catch(() => { /* Firestore書き込み失敗は無視 */ });

    } catch (_) {
        // エラーレポート自体のエラーは無視（無限ループ防止）
    }
}

/**
 * グローバルエラーハンドラー（キャッチされなかったエラーを捕捉）
 */
window.onerror = function (message, source, lineno, colno, error) {
    reportError(
        error || message,
        `未キャッチエラー (${source || '不明'}:${lineno || 0}:${colno || 0})`
    );
};

/**
 * 未処理の Promise rejection を捕捉
 */
window.addEventListener('unhandledrejection', function (event) {
    const error = event.reason;
    reportError(
        error instanceof Error ? error : String(error),
        '未処理のPromise rejection'
    );
});
