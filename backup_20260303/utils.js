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
