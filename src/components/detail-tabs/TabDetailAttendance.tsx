import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, where, orderBy, getDocs, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { Employee, COLLECTIONS, AttendanceRecord, AttendanceType } from '../../types';
import { toDate, formatTimeStr, formatDateStr, getMonthCycleRange } from '../../utils';
import { useModal } from '../../contexts/ModalContext';
import { Clock, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '../ui/Button';

interface Props {
    employee: Employee;
}

export const TabDetailAttendance: React.FC<Props> = ({ employee }) => {
    const [monthStr, setMonthStr] = useState(format(new Date(), 'yyyy-MM'));
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Hand add form
    const [addDate, setAddDate] = useState(formatDateStr(new Date()));
    const [addTime, setAddTime] = useState('09:00');
    const [addType, setAddType] = useState<AttendanceType>('in');
    const [addRemark, setAddRemark] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    const { showAlert, showConfirm } = useModal();

    const fetchRecords = async () => {
        if (!employee.id) return;
        setIsLoading(true);
        try {
            const { start, end } = getMonthCycleRange(monthStr);
            const q = query(
                collection(db, COLLECTIONS.ATTENDANCE),
                where('empId', '==', employee.id),
                where('timestamp', '>=', start),
                where('timestamp', '<', end),
                orderBy('timestamp', 'asc')
            );

            const snapshot = await getDocs(q);
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as AttendanceRecord[];

            setRecords(list);
        } catch (error: any) {
            console.error('Fetch error:', error);
            await showAlert(`打刻データの取得に失敗しました: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchRecords();
    }, [employee.id, monthStr]);

    const handleAddRecord = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!addDate || !addTime) {
            await showAlert('日付と時間を指定してください。');
            return;
        }

        try {
            setIsAdding(true);
            const dateObj = new Date(`${addDate}T${addTime}`);

            await addDoc(collection(db, COLLECTIONS.ATTENDANCE), {
                empId: employee.id,
                empName: employee.name,
                type: addType,
                remark: addRemark.trim() || '（管理者による手動追加）',
                timestamp: dateObj,
                createdAt: serverTimestamp()
            });

            await showAlert('打刻データを追加しました。');
            setAddRemark('');
            fetchRecords();
        } catch (error: any) {
            await showAlert(`追加に失敗しました: ${error.message}`);
        } finally {
            setIsAdding(false);
        }
    };

    const handleDeleteRecord = async (recId: string, timestamp: any, type: string) => {
        const typeStr = type === 'in' ? '出勤' : '退勤';
        const dateStr = format(toDate(timestamp), 'yyyy-MM-dd HH:mm');

        if (!(await showConfirm(`以下の打刻データを削除してもよろしいですか？\n\n打刻: ${typeStr}\n日時: ${dateStr}`))) {
            return;
        }

        try {
            await deleteDoc(doc(db, COLLECTIONS.ATTENDANCE, recId));
            await showAlert('削除しました。');
            setRecords(records.filter(r => r.id !== recId));
        } catch (error: any) {
            await showAlert(`削除に失敗しました: ${error.message}`);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <Clock className="text-primary" size={20} />
                    手動打刻の追加
                </h3>

                <form onSubmit={handleAddRecord} className="flex flex-wrap gap-4 items-end bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500">日付</label>
                        <input
                            type="date"
                            value={addDate}
                            onChange={(e) => setAddDate(e.target.value)}
                            className="w-full p-2.5 rounded-xl bg-white border border-gray-200 focus:ring-2 focus:ring-primary text-sm"
                            required
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500">時間</label>
                        <input
                            type="time"
                            value={addTime}
                            onChange={(e) => setAddTime(e.target.value)}
                            className="w-full p-2.5 rounded-xl bg-white border border-gray-200 focus:ring-2 focus:ring-primary text-sm"
                            required
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500">種別</label>
                        <select
                            value={addType}
                            onChange={(e) => setAddType(e.target.value as AttendanceType)}
                            className="w-full p-2.5 rounded-xl bg-white border border-gray-200 focus:ring-2 focus:ring-primary text-sm font-bold"
                        >
                            <option value="in">出勤</option>
                            <option value="out">退勤</option>
                        </select>
                    </div>
                    <div className="space-y-1 flex-1 min-w-[200px]">
                        <label className="text-xs font-bold text-gray-500">備考 (任意)</label>
                        <input
                            type="text"
                            value={addRemark}
                            onChange={(e) => setAddRemark(e.target.value)}
                            placeholder="手動での修正、入力忘れなど"
                            className="w-full p-2.5 rounded-xl bg-white border border-gray-200 focus:ring-2 focus:ring-primary text-sm"
                        />
                    </div>
                    <Button
                        type="submit"
                        disabled={isAdding}
                        isLoading={isAdding}
                        leftIcon={<Plus size={18} />}
                        className="p-2.5 px-6 rounded-xl font-bold shadow-lg shadow-primary/30 h-[42px]"
                    >
                        追加
                    </Button>
                </form>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <span>📋</span> 打刻履歴
                    </h3>
                    <div className="flex items-center gap-3">
                        <label className="text-sm font-bold text-gray-500">表示月 (21日〜20日):</label>
                        <input
                            type="month"
                            value={monthStr}
                            onChange={(e) => setMonthStr(e.target.value)}
                            className="p-2 rounded-lg bg-gray-50 border-none focus:ring-2 focus:ring-primary font-mono text-sm"
                        />
                    </div>
                </div>

                {isLoading ? (
                    <div className="py-12 text-center text-gray-400">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                        読み込み中...
                    </div>
                ) : records.length === 0 ? (
                    <div className="py-12 text-center text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                        該当期間の打刻データはありません。
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 text-gray-400 text-xs font-bold uppercase tracking-wider">
                                    <th className="px-4 py-3">日付</th>
                                    <th className="px-4 py-3">時刻</th>
                                    <th className="px-4 py-3">種別</th>
                                    <th className="px-4 py-3">備考</th>
                                    <th className="px-4 py-3 text-right">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {records.map(rec => {
                                    const tDate = toDate(rec.timestamp);
                                    return (
                                        <tr key={rec.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-4 py-3 text-sm font-mono text-gray-600">
                                                {formatDateStr(tDate)}
                                            </td>
                                            <td className="px-4 py-3 font-mono font-bold text-gray-800">
                                                {formatTimeStr(tDate)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${rec.type === 'in' ? 'bg-success-bg text-success' : 'bg-primary-light text-primary'
                                                    }`}>
                                                    {rec.type === 'in' ? '出勤' : '退勤'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-gray-500 truncate max-w-[200px]">
                                                {rec.remark || '-'}
                                                {rec.isCorrected && <span className="ml-2 text-primary">(申請による修正)</span>}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <Button
                                                    onClick={() => handleDeleteRecord(rec.id!, rec.timestamp, rec.type)}
                                                    variant="ghost"
                                                    size="sm"
                                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors h-8 w-8 p-0"
                                                    title="削除"
                                                >
                                                    <Trash2 size={16} />
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};
