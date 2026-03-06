import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { COLLECTIONS } from '../types';

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
 * Report error to Firestore
 */
export async function reportError(error: any, context: string) {
    try {
        const errorData = {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : null,
            context,
            timestamp: serverTimestamp(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            consoleLogs: (window as any)._consoleHistory || [],
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
 */
export function calculateRemainingPaidLeave(grants: any[], usedDays: number) {
    const totalGranted = grants.reduce((sum, g) => sum + (g.days || 0), 0);
    const remaining = totalGranted - usedDays;

    return {
        summary: {
            granted: totalGranted,
            used: usedDays,
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
