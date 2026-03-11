import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, updateDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { Employee, COLLECTIONS } from '../../types';
import { useModal } from '../../contexts/ModalContext';
import { hashPassword } from '../../utils';
import { format, subMonths } from 'date-fns';

interface Props {
    employee: Employee;
}

export const TabDetailBasic: React.FC<Props> = ({ employee }) => {
    const [editForm, setEditForm] = useState({
        name: employee.name || '',
        email: employee.email || '',
        newPassword: '', // 新規設定用（平文は読み込まない）
        isHidden: !!employee.isHidden
    });
    const [isSaving, setIsSaving] = useState(false);

    // Stats
    const [monthRate, setMonthRate] = useState<string>('--');
    const [totalRate, setTotalRate] = useState<string>('--');
    const [paidLeaveBalance, setPaidLeaveBalance] = useState<number | string>('--');
    const [includePaidLeave, setIncludePaidLeave] = useState(false);
    const [historyRates, setHistoryRates] = useState<{ month: string, rate: string, rawRate: number }[]>([]);
    const [isLoadingStats, setIsLoadingStats] = useState(false);

    const { showAlert, showConfirm } = useModal();

    useEffect(() => {
        setEditForm({
            name: employee.name || '',
            email: employee.email || '',
            newPassword: '',
            isHidden: !!employee.isHidden
        });

        setPaidLeaveBalance(employee.paidLeave || '--');
    }, [employee]);

    useEffect(() => {
        const fetchStats = async () => {
            if (!employee.id) return;
            setIsLoadingStats(true);
            try {
                const targetMonths: string[] = [];
                const now = new Date();
                for (let i = 5; i >= 0; i--) {
                    targetMonths.push(format(subMonths(now, i), 'yyyy-MM'));
                }

                const cycles = targetMonths.map(mStr => {
                    const [yStr, mNumStr] = mStr.split('-');
                    const y = parseInt(yStr);
                    const mo = parseInt(mNumStr);
                    const start = new Date(y, mo - 2, 21, 0, 0, 0, 0);
                    const end = new Date(y, mo - 1, 21, 0, 0, 0, 0);
                    return { month: mStr, start, end };
                });

                const overallStart = cycles[0].start;
                const overallEnd = cycles[5].end;

                const qHol = query(
                    collection(db, COLLECTIONS.HOLIDAYS),
                    where('date', '>=', format(overallStart, 'yyyy-MM-dd')),
                    where('date', '<', format(overallEnd, 'yyyy-MM-dd'))
                );
                const snapHol = await getDocs(qHol);
                const holidays = snapHol.docs.map(d => d.data().date as string);

                const qAtt = query(
                    collection(db, COLLECTIONS.ATTENDANCE),
                    where('empId', '==', employee.id),
                    where('timestamp', '>=', overallStart),
                    where('timestamp', '<', overallEnd)
                );
                const snapAtt = await getDocs(qAtt);
                const attendances = snapAtt.docs.map(d => d.data());

                let applications: any[] = [];
                if (includePaidLeave) {
                    const qApps = query(
                        collection(db, COLLECTIONS.APPLICATIONS),
                        where('empId', '==', employee.id),
                        where('status', 'in', ['approved', 'completed'])
                    );
                    const snapApps = await getDocs(qApps);
                    applications = snapApps.docs.map(d => d.data());
                }

                let totalDaysPresent = 0;
                let totalWorkingDays = 0;
                const results = cycles.map(cycle => {
                    const totalMs = cycle.end.getTime() - cycle.start.getTime();
                    const totalDaysRaw = Math.round(totalMs / (1000 * 60 * 60 * 24));
                    const holsInCycle = holidays.filter(h => {
                        const hd = new Date(h);
                        return hd >= cycle.start && hd < cycle.end;
                    }).length;
                    const workingDays = totalDaysRaw - holsInCycle;
                    totalWorkingDays += workingDays;

                    const attendedDates = new Set<string>();

                    attendances.forEach(att => {
                        const d = typeof att.timestamp.toDate === 'function' ? att.timestamp.toDate() : new Date(att.timestamp);
                        if (d >= cycle.start && d < cycle.end && att.type === 'in') {
                            attendedDates.add(format(d, 'yyyy-MM-dd'));
                        }
                    });

                    if (includePaidLeave) {
                        applications.forEach(app => {
                            const d = new Date(app.date);
                            if (d >= cycle.start && d < cycle.end) {
                                if (app.type === '有給' || (typeof app.type === 'string' && app.type.startsWith('半休'))) {
                                    attendedDates.add(app.date);
                                }
                            }
                        });
                    }

                    const daysPresent = attendedDates.size;
                    totalDaysPresent += daysPresent;

                    const rawRate = workingDays > 0 ? (daysPresent / workingDays) * 100 : 0;
                    const rate = Math.min(100, Math.max(0, rawRate)).toFixed(1);

                    return { month: cycle.month, rate, rawRate: parseFloat(rate) };
                });

                setHistoryRates(results);
                setMonthRate(results[5].rate + '%');

                const totalRaw = totalWorkingDays > 0 ? (totalDaysPresent / totalWorkingDays) * 100 : 0;
                setTotalRate(Math.min(100, Math.max(0, totalRaw)).toFixed(1) + '%');

            } catch (error) {
                console.error("Stats Error:", error);
                setMonthRate('Error');
                setTotalRate('Error');
            } finally {
                setIsLoadingStats(false);
            }
        };

        fetchStats();
    }, [employee.id, includePaidLeave]);

    const handleSave = async () => {
        if (!editForm.name.trim()) {
            await showAlert('氏名を入力してください。');
            return;
        }

        try {
            setIsSaving(true);
            const updateData: any = {
                name: editForm.name.trim(),
                email: editForm.email.trim(),
                isHidden: editForm.isHidden,
                updatedAt: serverTimestamp()
            };

            // パスワードが入力されている場合のみハッシュ化して更新
            if (editForm.newPassword.trim()) {
                updateData.passwordHash = await hashPassword(editForm.newPassword.trim());
                updateData.password = ''; // 平文パスワードをクリア
            }

            await updateDoc(doc(db, COLLECTIONS.EMPLOYEES, employee.docId || employee.id), updateData);
            setEditForm(prev => ({ ...prev, newPassword: '' }));
            await showAlert('従業員情報を更新しました。');
        } catch (error: any) {
            console.error('Employee update error:', error);
            await showAlert('更新に失敗しました。しばらくしてからお試しください。');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!(await showConfirm(`${employee.name} さんを本当に削除しますか？\n（物理削除されます）`))) return;

        try {
            const { deleteDoc } = await import('firebase/firestore');
            await deleteDoc(doc(db, COLLECTIONS.EMPLOYEES, employee.docId || employee.id));
            await showAlert('削除しました。');
            // employee is deleted, will cause unmount or redirect via parent snapshot
        } catch (error: any) {
            console.error('Employee delete error:', error);
            await showAlert('削除に失敗しました。しばらくしてからお試しください。');
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <span>📊</span> 出勤率サマリー
                </h3>

                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-gray-50 p-4 rounded-2xl text-center">
                        <div className="text-xs text-gray-500 font-bold mb-1">今月</div>
                        <div className="text-2xl font-bold text-gray-800">{monthRate}</div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-2xl text-center">
                        <div className="text-xs text-gray-500 font-bold mb-1">累計平均</div>
                        <div className="text-2xl font-bold text-gray-800">{totalRate}</div>
                    </div>
                </div>

                <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 mb-6 flex items-center gap-3">
                    <input
                        type="checkbox"
                        id="includePaidLeave"
                        checked={includePaidLeave}
                        onChange={(e) => setIncludePaidLeave(e.target.checked)}
                        className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <label htmlFor="includePaidLeave" className="text-sm font-bold text-gray-700 cursor-pointer">
                        有休・半休を出勤日数に含める
                    </label>
                </div>

                <div>
                    <h4 className="text-sm font-bold text-gray-500 mb-3">直近6ヶ月の推移</h4>
                    {isLoadingStats ? (
                        <div className="text-sm text-gray-400 bg-gray-50 p-4 rounded-xl text-center">計算中...</div>
                    ) : (
                        <div className="flex items-end justify-between bg-gray-50 p-4 rounded-xl h-44 gap-2">
                            {historyRates.map(item => (
                                <div key={item.month} className="flex flex-col items-center justify-end flex-1 h-full gap-2">
                                    <div className="text-[10px] font-bold text-gray-400">{item.rate}%</div>
                                    <div className="w-full bg-primary/10 rounded-t-sm relative group overflow-hidden" style={{ height: '70%' }}>
                                        <div
                                            className={`absolute bottom-0 left-0 right-0 rounded-t-sm transition-all duration-1000 ${item.rawRate < 80 ? 'bg-orange-400' : 'bg-primary'}`}
                                            style={{ height: `${item.rawRate}%` }}
                                        />
                                    </div>
                                    <div className="text-[10px] text-gray-500 font-bold">{item.month.split('-')[1]}月</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <span>✏️</span> 従業員設定
                </h3>

                <div className="space-y-4 mb-8">
                    <div>
                        <label className="text-xs font-bold text-gray-500 mb-1 block">従業員ID</label>
                        <input
                            type="text"
                            value={employee.id}
                            readOnly
                            className="w-full p-3 rounded-xl bg-gray-100 border-none text-gray-500 cursor-not-allowed font-mono"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 mb-1 block">氏名</label>
                        <input
                            type="text"
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="w-full p-3 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-primary"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 mb-1 block">メールアドレス (リセット用)</label>
                        <input
                            type="email"
                            value={editForm.email}
                            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                            placeholder="user@example.com"
                            className="w-full p-3 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-primary"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 mb-1 block">パスワードを再設定</label>
                        <input
                            type="password"
                            value={editForm.newPassword}
                            onChange={(e) => setEditForm({ ...editForm, newPassword: e.target.value })}
                            placeholder="変更する場合のみ入力"
                            className="w-full p-3 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-primary"
                        />
                        <p className="text-xs text-gray-400 mt-1">空欄の場合は変更しません</p>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 mb-1 block">有休残日数 (表示のみ)</label>
                        <div className="text-lg font-bold text-gray-800">{paidLeaveBalance} 日</div>
                    </div>
                    <div className="border-t border-gray-100 pt-4 mt-2">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={editForm.isHidden}
                                onChange={(e) => setEditForm({ ...editForm, isHidden: e.target.checked })}
                                className="w-5 h-5 rounded border-gray-300 text-red-500 focus:ring-red-500"
                            />
                            <span className="text-sm font-bold text-red-500">選択画面で非表示にする</span>
                        </label>
                    </div>
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={handleDelete}
                        className="flex-1 bg-red-50 text-red-500 font-bold p-4 rounded-xl hover:bg-red-100 transition-colors"
                    >
                        削除
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex-[2] bg-primary text-white font-bold p-4 rounded-xl shadow-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
                    >
                        {isSaving ? '保存中...' : '設定を保存'}
                    </button>
                </div>
            </div>
        </div>
    );
};
