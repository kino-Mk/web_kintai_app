import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, deleteDoc, getDocs } from 'firebase/firestore';
import { AttendanceRecord, Employee, COLLECTIONS } from '../types';
import { toDate, formatTimeStr, formatDateStr, formatCsvTime, downloadCSV } from '../utils';
import { Calendar as CalendarIcon, User, Search, Trash2, Download } from 'lucide-react';
import { useModal } from '../contexts/ModalContext';

export const AdminDailyTab: React.FC = () => {
    const [selectedDate, setSelectedDate] = useState(formatDateStr(new Date()));
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const { showAlert, showConfirm } = useModal();

    useEffect(() => {
        // 従業員一覧を取得
        const qEmp = query(collection(db, COLLECTIONS.EMPLOYEES), orderBy('name', 'asc'));
        const unsubEmp = onSnapshot(qEmp, (snapshot) => {
            setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Employee[]);
        });

        return () => unsubEmp();
    }, []);

    useEffect(() => {
        setLoading(true);
        const start = new Date(selectedDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(selectedDate);
        end.setHours(23, 59, 59, 999);

        const qAtt = query(
            collection(db, COLLECTIONS.ATTENDANCE),
            where('timestamp', '>=', start),
            where('timestamp', '<=', end),
            orderBy('timestamp', 'asc')
        );

        const unsubAtt = onSnapshot(qAtt, (snapshot) => {
            setRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AttendanceRecord[]);
            setLoading(false);
        });

        return () => unsubAtt();
    }, [selectedDate]);

    const filteredEmployees = employees.filter(emp =>
        !emp.isHidden && (emp.name.includes(filter) || emp.id.includes(filter))
    );

    const getEmployeeRecords = (empId: string) => {
        return records.filter(r => r.empId === empId);
    };

    const handleDeleteRecord = async (recordId: string, empName: string, type: 'in' | 'out') => {
        const typeStr = type === 'in' ? '出勤' : '退勤';
        if (!(await showConfirm(`${empName} さんの ${typeStr} 打刻データを削除しますか？\n（この操作は元に戻せません）`))) return;
        try {
            await deleteDoc(doc(db, COLLECTIONS.ATTENDANCE, recordId));
            await showAlert('打刻データを削除しました。');
        } catch (error: any) {
            await showAlert(`削除に失敗しました: ${error.message}`);
        }
    };

    const handleExportRawCSV = async () => {
        try {
            const snapshot = await getDocs(query(collection(db, COLLECTIONS.ATTENDANCE), orderBy('timestamp', 'desc')));
            let csvContent = "従業員ID, 従業員氏名, 打刻日時\n";

            snapshot.forEach(doc => {
                const data = doc.data() as AttendanceRecord;
                const date = toDate(data.timestamp);
                const formattedTime = formatCsvTime(date);
                csvContent += `${data.empId}, ${data.empName}, ${formattedTime}\n`;
            });

            downloadCSV(csvContent, 'attendance_raw.csv');
        } catch (error: any) {
            console.error('Export error:', error);
            await showAlert("エクスポートに失敗しました: " + error.message);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row justify-between gap-4 bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="pl-10 pr-4 py-2 rounded-xl border-none bg-white shadow-sm focus:ring-2 focus:ring-primary text-sm font-bold"
                        />
                        <CalendarIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
                    </div>
                    <div className="relative hidden md:block">
                        <input
                            type="text"
                            placeholder="従業員検索..."
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="pl-10 pr-4 py-2 rounded-xl border-none bg-white shadow-sm focus:ring-2 focus:ring-primary text-sm"
                        />
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                    </div>
                </div>
                <div className="text-right flex flex-col md:flex-row items-end md:items-center gap-4">
                    <button
                        onClick={handleExportRawCSV}
                        className="flex items-center gap-2 bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-50 transition-all shadow-sm active:scale-95"
                    >
                        <Download size={16} />
                        全データCSV
                    </button>
                    <span className="text-xs text-gray-400 font-bold">打刻件数: {records.length} 件</span>
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 text-gray-400 text-xs font-bold uppercase tracking-wider">
                                <th className="px-6 py-4 w-48">従業員</th>
                                <th className="px-6 py-4">出勤 / 退勤</th>
                                <th className="px-6 py-4">備考</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr><td colSpan={3} className="px-6 py-12 text-center text-gray-400 animate-pulse">読み込み中...</td></tr>
                            ) : filteredEmployees.length === 0 ? (
                                <tr><td colSpan={3} className="px-6 py-12 text-center text-gray-400">対象者がいません。</td></tr>
                            ) : (
                                filteredEmployees.map((emp) => {
                                    const empRecs = getEmployeeRecords(emp.id);
                                    const inStamp = empRecs.find(r => r.type === 'in');
                                    const outStamp = empRecs.find(r => r.type === 'out');

                                    return (
                                        <tr key={emp.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                                                        <User size={16} />
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-gray-700 block text-sm leading-tight">{emp.name}</span>
                                                        <span className="text-[10px] text-gray-400 font-mono italic">ID: {emp.id}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex gap-4">
                                                    <div className="space-y-1">
                                                        <span className="text-[10px] font-bold text-gray-400 block uppercase">IN</span>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`font-mono font-bold text-sm ${inStamp ? 'text-gray-700' : 'text-gray-200'}`}>
                                                                {inStamp ? formatTimeStr(toDate(inStamp.timestamp)) : '--:--'}
                                                            </span>
                                                            {inStamp && (
                                                                <button
                                                                    onClick={() => handleDeleteRecord(inStamp.id!, emp.name, 'in')}
                                                                    className="text-gray-300 hover:text-danger hover:bg-danger-bg p-1 rounded transition-colors"
                                                                    title="この打刻を削除"
                                                                >
                                                                    <Trash2 size={12} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="w-px h-8 bg-gray-100"></div>
                                                    <div className="space-y-1">
                                                        <span className="text-[10px] font-bold text-gray-400 block uppercase">OUT</span>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`font-mono font-bold text-sm ${outStamp ? 'text-gray-700' : 'text-gray-200'}`}>
                                                                {outStamp ? formatTimeStr(toDate(outStamp.timestamp)) : '--:--'}
                                                            </span>
                                                            {outStamp && (
                                                                <button
                                                                    onClick={() => handleDeleteRecord(outStamp.id!, emp.name, 'out')}
                                                                    className="text-gray-300 hover:text-danger hover:bg-danger-bg p-1 rounded transition-colors"
                                                                    title="この打刻を削除"
                                                                >
                                                                    <Trash2 size={12} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                    {empRecs.filter(r => r.remark).map(r => (
                                                        <div key={r.id} className="text-xs text-gray-500 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                                            <span className="font-bold text-primary mr-2">[{r.type === 'in' ? '出' : '退'}]</span>
                                                            {r.remark}
                                                        </div>
                                                    ))}
                                                    {empRecs.every(r => !r.remark) && <span className="text-gray-200 text-xs">-</span>}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
