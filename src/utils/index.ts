import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { COLLECTIONS } from '../types';

/**
 * パスワードを SHA-256 でハッシュ化する
 * Web Crypto API を使用し、16進文字列で返す
 */
export async function hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Console interception for error reporting
 */
export function initConsoleIntercept() {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    const originalInfo = console.info;

    (window as any)._consoleHistory = [];

    const intercept = (method: string, original: Function) => {
        return (...args: any[]) => {
            const entry = `[${new Date().toISOString()}] [${method}] ${args.map(a =>
                typeof a === 'object' ? JSON.stringify(a) : String(a)
            ).join(' ')}`;
            (window as any)._consoleHistory.push(entry);
            if ((window as any)._consoleHistory.length > 100) {
                (window as any)._consoleHistory.shift();
            }
            original.apply(console, args);
        };
    };

    console.log = intercept('LOG', originalLog);
    console.error = intercept('ERROR', originalError);
    console.warn = intercept('WARN', originalWarn);
    console.info = intercept('INFO', originalInfo);
}

/**
 * Report error to Firestore（最小限の情報のみ保存）
 */
export async function reportError(error: any, context: string) {
    try {
        const errorData = {
            message: error instanceof Error ? error.message : String(error),
            context,
            timestamp: serverTimestamp(),
            url: window.location.pathname,
            resolved: false
        };

        await addDoc(collection(db, COLLECTIONS.ERROR_LOGS), errorData);
    } catch (e) {
        console.error('Failed to report error:', e);
    }
}

/**
 * Firestore Timestamp to Date
 */
export function toDate(timestamp: any): Date {
    if (!timestamp) return new Date();
    if (timestamp instanceof Date) return timestamp;
    if (typeof timestamp.toDate === 'function') return timestamp.toDate();
    return new Date(timestamp);
}

/**
 * Format date string (YYYY-MM-DD)
 */
export function formatDateStr(date: Date): string {
    return format(date, 'yyyy-MM-dd');
}

/**
 * Format time string (HH:mm)
 */
export function formatTimeStr(date: Date): string {
    return format(date, 'HH:mm');
}

/**
 * Format full datetime (YYYY-MM-DD HH:mm:ss)
 */
export function formatFullDateTime(date: Date): string {
    return format(date, 'yyyy-MM-dd HH:mm:ss');
}

/**
 * Get start of a day
 */
export function getStartOfToday(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

/**
 * Get billing cycle range (21st to 20th)
 */
export function getMonthCycleRange(monthStr: string) {
    // monthStr: YYYY-MM
    const parts = monthStr.split('-');
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1; // 0-indexed

    // Start: prev month 21st
    const start = new Date(year, month - 1, 21, 0, 0, 0, 0);
    // End: current month 21st 0:0:0 (not inclusive, so through 20th 23:59:59)
    const end = new Date(year, month, 21, 0, 0, 0, 0);

    return { start, end };
}

/**
 * Calculate remaining paid leave
 * 有給休暇の失効ロジック: 付与日 (grantDate) から2年経過で失効とする
 */
export function calculateRemainingPaidLeave(grants: any[], usedDays: number, baseDays: number = 0) {
    const now = new Date();
    let totalGranted = 0;
    let totalExpired = 0;

    // 付与履歴ごとに2年失効しているか判定
    grants.forEach(g => {
        const grantDays = g.days || 0;
        totalGranted += grantDays;

        if (g.grantDate) {
            const grantDate = toDate(g.grantDate);
            // 付与日から2年後の日付
            const expireDate = new Date(grantDate.getFullYear() + 2, grantDate.getMonth(), grantDate.getDate());
            if (now >= expireDate) {
                totalExpired += grantDays;
            }
        }
    });

    // 失効分が使用済み分を上回る場合は使用済み分から相殺されるわけではなく、
    // 残日数は「本来の総付与(基本＋付与) - 消化済み - 失効」ベースで計算
    // ※厳密には有効期限が切れる前に消化したかなどを管理すべきだが、レガシー相当の簡易計算とする
    const totalEntitlement = baseDays + totalGranted;
    let remaining = totalEntitlement - usedDays - totalExpired;

    return {
        summary: {
            base: baseDays,
            granted: totalGranted,
            total: totalEntitlement,
            used: usedDays,
            expired: totalExpired,
            remaining: Math.max(0, remaining)
        }
    };
}

/**
 * GAS通知を送信する
 */
export async function sendGasNotification(payload: any) {
    try {
        const docRef = doc(db, COLLECTIONS.SETTINGS, 'system');
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return;

        const settings = docSnap.data();
        if (!settings.gasWebAppUrl) return;

        await fetch(settings.gasWebAppUrl, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify(payload)
        });
    } catch (error) {
        console.error('GAS Notification Error:', error);
    }
}

/**
 * Format date for CSV (YYYYMMDDHHMM)
 */
export function formatCsvTime(date: Date): string {
    return format(date, 'yyyyMMddHHmm');
}

/**
 * Trigger CSV download handling BOM
 */
export function downloadCSV(content: string, filename: string) {
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, content], { type: 'text/csv;charset=utf-8;' });
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
