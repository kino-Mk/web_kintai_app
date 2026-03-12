import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS, AttendanceRecord } from '../types';
import { getStartOfToday } from '../utils';

async function fetchAttendanceByEmployee(empId: string, month: Date): Promise<AttendanceRecord[]> {
    const startObj = new Date(month.getFullYear(), month.getMonth(), 1);
    const endObj = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59);

    const q = query(
        collection(db, COLLECTIONS.ATTENDANCE),
        where('empId', '==', empId),
        where('timestamp', '>=', startObj),
        where('timestamp', '<=', endObj),
        orderBy('timestamp', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    } as AttendanceRecord));
}

export function useAttendanceByEmployee(empId: string | undefined, month: Date) {
    return useQuery({
        queryKey: ['attendance', empId, month.getFullYear(), month.getMonth()],
        queryFn: () => fetchAttendanceByEmployee(empId!, month),
        enabled: !!empId,
    });
}

// 本日の全従業員の出退勤状態を取得
export function useTodayAttendanceStates() {
    return useQuery({
        queryKey: ['attendance', 'today-states'],
        queryFn: async () => {
            const today = getStartOfToday();
            const q = query(
                collection(db, COLLECTIONS.ATTENDANCE),
                where('timestamp', '>=', today),
                orderBy('timestamp', 'asc')
            );
            const snapshot = await getDocs(q);
            const states: Record<string, 'in' | 'out'> = {};
            snapshot.forEach(doc => {
                const data = doc.data() as AttendanceRecord;
                states[data.empId] = data.type;
            });
            return states;
        },
        refetchInterval: 1000 * 60, // 1分ごとに最新状態を取得
    });
}

// 指定した日付の全従業員の打刻を取得
export function useAttendanceByDate(dateStr: string) {
    return useQuery({
        queryKey: ['attendance', 'date', dateStr],
        queryFn: async () => {
            const start = new Date(dateStr);
            start.setHours(0, 0, 0, 0);
            const end = new Date(dateStr);
            end.setHours(23, 59, 59, 999);

            const q = query(
                collection(db, COLLECTIONS.ATTENDANCE),
                where('timestamp', '>=', start),
                where('timestamp', '<=', end),
                orderBy('timestamp', 'asc')
            );

            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as AttendanceRecord));
        },
        enabled: !!dateStr,
    });
}
