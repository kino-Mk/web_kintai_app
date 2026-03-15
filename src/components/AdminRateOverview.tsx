import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, getDocs, where } from 'firebase/firestore';
import { Employee, COLLECTIONS } from '../types';
import { Download, Users } from 'lucide-react';
import { format } from 'date-fns';
import { useModal } from '../contexts/ModalContext';
import { Button } from './ui/Button';

export const AdminRateOverview: React.FC = () => {
    // defaults
    const [startMonth, setStartMonth] = useState(format(new Date(), 'yyyy-MM'));
    const [endMonth, setEndMonth] = useState(format(new Date(), 'yyyy-MM'));
    const [includePaidLeave, setIncludePaidLeave] = useState(true);
    const [rates, setRates] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const { showAlert } = useModal();

    const fetchRates = async () => {
        setIsLoading(true);
        try {
            // Get employees
            const qEmp = query(collection(db, COLLECTIONS.EMPLOYEES), orderBy('id', 'asc'));
            const snapEmp = await getDocs(qEmp);
            const employees = snapEmp.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Employee[];
            const validEmployees = employees.filter(e => !e.isHidden);

            // To support multi-month, let's recalculate the exact start/end dates
            const startParts = startMonth.split('-');
            const endParts = endMonth.split('-');
            const actualStart = new Date(parseInt(startParts[0]), parseInt(startParts[1]) - 2, 21, 0, 0, 0, 0); // start of startMonth cycle
            const actualEnd = new Date(parseInt(endParts[0]), parseInt(endParts[1]) - 1, 21, 0, 0, 0, 0);       // end of endMonth cycle

            // Calculate total days
            const totalMs = actualEnd.getTime() - actualStart.getTime();
            const totalDaysRaw = Math.round(totalMs / (1000 * 60 * 60 * 24));

            // Fetch Holidays in range
            const qHol = query(
                collection(db, COLLECTIONS.HOLIDAYS),
                where('date', '>=', format(actualStart, 'yyyy-MM-dd')),
                where('date', '<', format(actualEnd, 'yyyy-MM-dd'))
            );
            const snapHol = await getDocs(qHol);
            const numHolidays = snapHol.docs.length;

            const workingDays = totalDaysRaw - numHolidays;

            if (workingDays <= 0) {
                await showAlert('対象期間の営業日ゼロ（または不正な期間）です。');
                setIsLoading(false);
                return;
            }

            // Fetch all attendances in range
            const qAtt = query(
                collection(db, COLLECTIONS.ATTENDANCE),
                where('timestamp', '>=', actualStart),
                where('timestamp', '<', actualEnd)
            );
            const snapAtt = await getDocs(qAtt);

            // Map empId -> Set of distinct attendance dates
            const attMap: Record<string, Set<string>> = {};
            snapAtt.forEach(doc => {
                const data = doc.data();
                if (data.type === 'in') { // Count 'in' records as 1 day
                    const d = typeof data.timestamp.toDate === 'function' ? data.timestamp.toDate() : new Date(data.timestamp);
                    const dStr = format(d, 'yyyy-MM-dd');
                    if (!attMap[data.empId]) attMap[data.empId] = new Set();
                    attMap[data.empId].add(dStr);
                }
            });

            // Fetch all approved/completed applications in range (if includePaidLeave is true)
            if (includePaidLeave) {
                const qApps = query(
                    collection(db, COLLECTIONS.APPLICATIONS),
                    where('status', 'in', ['approved', 'completed'])
                );
                const snapApps = await getDocs(qApps);
                snapApps.forEach(doc => {
                    const data = doc.data();
                    const appDate = new Date(data.date);
                    // check if appDate is within range
                    if (appDate >= actualStart && appDate < actualEnd) {
                        if (data.type === '有給' || (typeof data.type === 'string' && data.type.startsWith('半休'))) {
                            if (!attMap[data.empId]) attMap[data.empId] = new Set();
                            attMap[data.empId].add(data.date);
                        }
                    }
                });
            }

            // Calculate rates
            const newRates = validEmployees.map(emp => {
                const attendedDates = attMap[emp.id] || new Set();
                const daysPresent = attendedDates.size;
                const rawRate = (daysPresent / workingDays) * 100;
                const rate = Math.min(100, Math.max(0, rawRate)).toFixed(1); // cap 100, floor 0

                return {
                    empId: emp.id,
                    name: emp.name,
                    daysPresent,
                    rate
                };
            });

            setRates(newRates);

        } catch (error: any) {
            console.error(error);
            await showAlert('集計中にエラーが発生しました。');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownloadCSV = () => {
        if (rates.length === 0) return;

        const headers = ['従業員ID', '氏名', '出勤日数', '出勤率(%)'];
        const rows = rates.map(r => [r.empId, r.name, r.daysPresent, r.rate]);

        const csvContent = [
            headers.join(','),
            ...rows.map(e => e.join(','))
        ].join('\n');

        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `出勤率_${startMonth}_to_${endMonth}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">出勤率一覧</h2>
                    <p className="text-gray-500">指定期間の従業員別の出勤率を集計します。（カレンダーの休日を反映）</p>
                </div>
                <Button
                    onClick={handleDownloadCSV}
                    disabled={rates.length === 0}
                    variant="outline"
                    leftIcon={<Download size={20} />}
                    className="bg-white border border-gray-200 text-gray-700 px-6 py-3 rounded-2xl shadow-sm font-bold h-auto"
                >
                    CSVダウンロード
                </Button>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <div className="flex flex-wrap gap-6 items-end">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-600">開始月</label>
                        <input
                            type="month"
                            value={startMonth}
                            onChange={(e) => setStartMonth(e.target.value)}
                            className="p-3 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-primary font-mono text-sm block"
                        />
                    </div>
                    <div className="text-gray-400 font-bold mb-3">〜</div>
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-600">終了月</label>
                        <input
                            type="month"
                            value={endMonth}
                            onChange={(e) => setEndMonth(e.target.value)}
                            className="p-3 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-primary font-mono text-sm block"
                        />
                    </div>

                    <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-xl ml-auto">
                        <input
                            type="checkbox"
                            id="includePaidLeaves"
                            checked={includePaidLeave}
                            onChange={(e) => setIncludePaidLeave(e.target.checked)}
                            className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <label htmlFor="includePaidLeaves" className="text-sm font-bold text-gray-700 cursor-pointer">
                            有給・半休を出勤に含める
                        </label>
                    </div>

                    <Button
                        onClick={fetchRates}
                        isLoading={isLoading}
                        className="bg-primary text-white p-3 px-8 rounded-xl font-bold shadow-lg hover:bg-primary-dark transition-all h-auto"
                    >
                        集計する
                    </Button>
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-50 bg-gray-50/50 flex items-center gap-2">
                    <Users size={18} className="text-gray-400" />
                    <span className="font-bold text-gray-600 text-sm">集計結果</span>
                </div>

                {rates.length === 0 ? (
                    <div className="py-12 text-center text-gray-400">
                        「集計する」ボタンを押すと結果が表示されます。
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 text-gray-400 text-xs font-bold uppercase tracking-wider">
                                    <th className="px-6 py-4">ID</th>
                                    <th className="px-6 py-4">氏名</th>
                                    <th className="px-6 py-4 text-right">出勤日数</th>
                                    <th className="px-6 py-4 text-right">出勤率</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {rates.map((rec) => (
                                    <tr key={rec.empId} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4 font-mono text-sm">{rec.empId}</td>
                                        <td className="px-6 py-4 font-bold text-gray-700">{rec.name}</td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="font-bold text-gray-800">{rec.daysPresent}</span> <span className="text-xs text-gray-400">日</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-sm">
                                                <span className={`font-black text-xl mr-1 ${parseFloat(rec.rate) < 80 ? 'text-orange-500' : 'text-primary'}`}>
                                                    {rec.rate}
                                                </span>
                                                <span className="text-gray-400 font-bold">%</span>
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};
