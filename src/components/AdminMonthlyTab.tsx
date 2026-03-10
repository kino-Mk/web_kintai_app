import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { AttendanceRecord, Employee, COLLECTIONS } from '../types';
import { toDate, getMonthCycleRange, calculateRemainingPaidLeave, formatDateStr, formatCsvTime, downloadCSV } from '../utils';
import { User, Download, ChevronRight } from 'lucide-react';
import { useModal } from '../contexts/ModalContext';

export const AdminMonthlyTab: React.FC = () => {
    const [selectedMonth, setSelectedMonth] = useState(formatDateStr(new Date()).substring(0, 7)); // YYYY-MM
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [leaveGrants, setLeaveGrants] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { showAlert } = useModal();

    useEffect(() => {
        // 従業員と有給付与情報を取得
        const fetchData = async () => {
            const qEmp = query(collection(db, COLLECTIONS.EMPLOYEES), orderBy('name', 'asc'));
            const snapEmp = await getDocs(qEmp);
            setEmployees(snapEmp.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Employee[]);

            const qGrants = query(collection(db, COLLECTIONS.LEAVE_GRANTS));
            const snapGrants = await getDocs(qGrants);
            setLeaveGrants(snapGrants.docs.map(doc => doc.data()));
        };
        fetchData();
    }, []);

    useEffect(() => {
        const { start, end } = getMonthCycleRange(selectedMonth);
        const qAtt = query(
            collection(db, COLLECTIONS.ATTENDANCE),
            where('timestamp', '>=', start),
            where('timestamp', '<', end),
            orderBy('timestamp', 'asc')
        );

        const unsubscribe = onSnapshot(qAtt, (snapshot) => {
            setRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AttendanceRecord[]);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [selectedMonth]);

    const getStats = (empId: string) => {
        const empRecs = records.filter(r => r.empId === empId);
        const workDays = new Set(empRecs.map(r => formatDateStr(toDate(r.timestamp)))).size;

        // 有給計算 (簡易版)
        const empGrants = leaveGrants.filter(g => g.empId === empId);
        const paidLeaveApps = records.filter(r => r.empId === empId && r.remark?.includes('有給')); // 実際は判定が必要
        const paidLeaveCount = paidLeaveApps.length; // 仮

        const leaveInfo = calculateRemainingPaidLeave(empGrants, paidLeaveCount);

        return {
            workDays,
            remainingLeave: leaveInfo.summary.remaining
        };
    };

    const handleExportCSV = async () => {
        if (!selectedMonth) {
            await showAlert('対象月を選択してください。');
            return;
        }

        try {
            if (records.length === 0) {
                await showAlert(`${selectedMonth}月次の打刻データはありません。`);
                return;
            }

            // records is already filtered by the selected month cycle
            // 構造: Map<EmpID, Map<DateString, {in: String, out: String}>>
            const exportData: Record<string, { name: string, days: Record<string, { in?: string, out?: string }> }> = {};

            records.forEach(data => {
                const dateObj = toDate(data.timestamp);
                const dateKey = formatDateStr(dateObj);
                const formattedTime = formatCsvTime(dateObj);

                if (!exportData[data.empId]) {
                    exportData[data.empId] = { name: data.empName, days: {} };
                }
                if (!exportData[data.empId].days[dateKey]) {
                    exportData[data.empId].days[dateKey] = {};
                }

                if (data.type === 'in') {
                    if (!exportData[data.empId].days[dateKey].in) {
                        exportData[data.empId].days[dateKey].in = formattedTime;
                    }
                } else if (data.type === 'out') {
                    exportData[data.empId].days[dateKey].out = formattedTime;
                }
            });

            let csvContent = "従業員ID,従業員名,打刻種別,打刻日時\n";

            for (const empId in exportData) {
                const emp = exportData[empId];
                const sortedDates = Object.keys(emp.days).sort();
                for (const dateKey of sortedDates) {
                    const day = emp.days[dateKey];
                    if (day.in) {
                        csvContent += `${empId},${emp.name},1,${day.in}\n`;
                    }
                    if (day.out) {
                        csvContent += `${empId},${emp.name},2,${day.out}\n`;
                    }
                }
            }

            downloadCSV(csvContent, `attendance_monthly_${selectedMonth}.csv`);
        } catch (error: any) {
            console.error('Export error:', error);
            await showAlert("エクスポートに失敗しました: " + error.message);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row justify-between gap-4 bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                <div className="flex items-center gap-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">対象月 (21日締め):</label>
                    <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="px-4 py-2 rounded-xl border-none bg-white shadow-sm focus:ring-2 focus:ring-primary text-sm font-bold"
                    />
                </div>
                <button
                    onClick={handleExportCSV}
                    className="flex items-center gap-2 bg-white border border-gray-200 text-gray-600 px-6 py-2 rounded-xl text-sm font-bold hover:bg-gray-50 transition-all shadow-sm active:scale-95"
                >
                    <Download size={18} />
                    CSVエクスポート
                </button>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 text-gray-400 text-xs font-bold uppercase tracking-wider">
                                <th className="px-6 py-4">従業員</th>
                                <th className="px-6 py-4">稼働日数</th>
                                <th className="px-6 py-4">有給残日数</th>
                                <th className="px-6 py-4 text-center">詳細</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-400 animate-pulse">読み込み中...</td></tr>
                            ) : employees.filter(e => !e.isHidden).map((emp) => {
                                const stats = getStats(emp.id);
                                return (
                                    <tr key={emp.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                                                    <User size={16} />
                                                </div>
                                                <span className="font-bold text-gray-700">{emp.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="font-mono font-bold text-primary">{stats.workDays}</span> <span className="text-xs text-gray-400">日</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="font-mono font-bold text-success">{stats.remainingLeave}</span> <span className="text-xs text-gray-400">日</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button className="p-2 text-gray-400 hover:text-primary transition-colors">
                                                <ChevronRight size={20} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
