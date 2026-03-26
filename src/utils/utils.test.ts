import { describe, it, expect } from 'vitest';
import { toDate, formatDateStr, formatTimeStr, getCurrentCycleMonthStr, getMonthCycleRange } from './index';

describe('Utility Functions', () => {
    describe('toDate', () => {
        it('should convert Firestore timestamp to Date', () => {
            const ts = { seconds: 1711353600, nanoseconds: 0 }; // 2024-03-25
            const result = toDate(ts);
            expect(result.getFullYear()).toBe(2024);
            expect(result.getMonth()).toBe(2); // 0-indexed March is 2
            expect(result.getDate()).toBe(25);
        });

        it('should return the same Date if input is Date', () => {
            const d = new Date(2024, 0, 1);
            expect(toDate(d).getTime()).toBe(d.getTime());
        });
    });

    describe('Date Formatting', () => {
        const d = new Date(2024, 2, 25, 15, 30); // 2024-03-25 15:30

        it('formatDateStr should return YYYY-MM-DD', () => {
            expect(formatDateStr(d)).toBe('2024-03-25');
        });

        it('formatTimeStr should return HH:mm', () => {
            expect(formatTimeStr(d)).toBe('15:30');
        });
    });

    describe('Attendance Cycle Logic', () => {
        it('getMonthCycleRange should return correct start and end dates', () => {
            // Cycle for 2024-04 should be 2024-03-21 to 2024-04-21
            const { start, end } = getMonthCycleRange('2024-04');
            expect(formatDateStr(start)).toBe('2024-03-21');
            expect(formatDateStr(end)).toBe('2024-04-21');
        });
    });
});
