import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, where, orderBy, getDocs, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Employee, COLLECTIONS } from '../../types';
import { toDate, formatDateStr, calculateRemainingPaidLeave } from '../../utils';
import { useModal } from '../../contexts/ModalContext';
import { Plus, Trash2, Calendar, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';

interface Props {
    employee: Employee;
}

export const TabDetailLeave: React.FC<Props> = ({ employee }) => {
    const [grants, setGrants] = useState<any[]>([]);
    const [usedApps, setUsedApps] = useState<any[]>([]); // 追加: 消費履歴表示用
    const [usedDays, setUsedDays] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    // Add Grant Form
    const [grantDate, setGrantDate] = useState(formatDateStr(new Date()));
    const [grantDays, setGrantDays] = useState('10');
    const [grantNote, setGrantNote] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    const { showAlert, showConfirm } = useModal();

    const fetchLeaveData = async () => {
        if (!employee.id) return;
        setIsLoading(true);
        try {
            // Fetch grants
            const qGrants = query(
                collection(db, 'leaveGrants'),
                where('empId', '==', employee.id),
                orderBy('grantDate', 'asc')
            );
            const grantsSnap = await getDocs(qGrants);
            const grantsList = grantsSnap.docs.map(d => ({ docId: d.id, ...d.data() }));

            // Fetch used applications (Approved or Completed)
            const qApps = query(
                collection(db, COLLECTIONS.APPLICATIONS),
                where('empId', '==', employee.id),
                where('status', 'in', ['approved', 'completed'])
            );
            const appsSnap = await getDocs(qApps);
            let totalUsed = 0;
            const appsArr: any[] = []; // 追加
            appsSnap.forEach(d => {
                const data = d.data();
                if (data.type === '有給') {
                    totalUsed += 1.0;
                    appsArr.push({ id: d.id, ...data, usedDays: 1.0 });
                } else if (typeof data.type === 'string' && data.type.startsWith('半休')) {
                    totalUsed += 0.5;
                    appsArr.push({ id: d.id, ...data, usedDays: 0.5 });
                }
            });

            // 日付の降順でソート
            appsArr.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            setGrants(grantsList);
            setUsedApps(appsArr);
            setUsedDays(totalUsed);

            // Sync with `employee.paidLeave` just in case (optional, depending on how UI needs it)
            const results = calculateRemainingPaidLeave(grantsList, totalUsed, 0);
            if (employee.paidLeave !== results.summary.remaining) {
                // Update employee doc so that other screens (like Basic info) see the correct balance
                await updateDoc(doc(db, COLLECTIONS.EMPLOYEES, employee.docId || employee.id), {
                    paidLeave: results.summary.remaining
                });
            }

        } catch (error: any) {
            console.error('Fetch error:', error);
            await showAlert(`有休データの取得に失敗しました: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchLeaveData();
    }, [employee.id]);

    const handleAddGrant = async (e: React.FormEvent) => {
        e.preventDefault();

        const daysNum = parseFloat(grantDays);
        if (!grantDate || isNaN(daysNum) || daysNum <= 0) {
            await showAlert('正しい付与日と日数を入力してください。');
            return;
        }

        try {
            setIsAdding(true);
            const dateObj = new Date(grantDate);

            await addDoc(collection(db, 'leaveGrants'), {
                empId: employee.id,
                empName: employee.name,
                days: daysNum,
                note: grantNote.trim(),
                grantDate: dateObj,
                createdAt: serverTimestamp()
            });

            await showAlert('有給休暇を付与しました。');
            setGrantNote('');
            setGrantDays('10');
            fetchLeaveData(); // refresh
        } catch (error: any) {
            await showAlert(`付与に失敗しました: ${error.message}`);
        } finally {
            setIsAdding(false);
        }
    };

    const handleDeleteGrant = async (docId: string, days: number, dateStr: string) => {
        if (!(await showConfirm(`以下の付与履歴を削除してもよろしいですか？\n付与日: ${dateStr}\n日数: ${days}日`))) {
            return;
        }

        try {
            await deleteDoc(doc(db, 'leaveGrants', docId));
            await showAlert('削除しました。');
            fetchLeaveData();
        } catch (error: any) {
            await showAlert(`削除に失敗しました: ${error.message}`);
        }
    };

    const handleUndoApproveLeaveStr = async (appId: string, dateStr: string) => {
        if (!(await showConfirm(`対象日: ${dateStr}\nこの有休申請の「承認（完了）」を【取消】にしますか？\n（消費日数が差し戻され、残日数が増えます）`))) {
            return;
        }

        try {
            await updateDoc(doc(db, COLLECTIONS.APPLICATIONS, appId), {
                status: 'canceled', // キャンセル扱いとして差し戻す
                updatedAt: serverTimestamp()
            });
            await showAlert('承認を取り消しました。');
            fetchLeaveData(); // refresh
        } catch (error: any) {
            await showAlert(`取消に失敗しました: ${error.message}`);
        }
    };

    // Calculation
    const calcResult = calculateRemainingPaidLeave(grants, usedDays, 0);
    const summary = calcResult.summary;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between">
                    <div className="text-sm font-bold text-gray-500 mb-2">総付与日数</div>
                    <div className="text-3xl font-bold text-primary">{summary.total} <span className="text-sm font-bold text-gray-400">日</span></div>
                </div>
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between">
                    <div className="text-sm font-bold text-gray-500 mb-2">消化済み日数</div>
                    <div className="text-3xl font-bold text-gray-700">{summary.used} <span className="text-sm font-bold text-gray-400">日</span></div>
                </div>
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between">
                    <div className="text-sm font-bold text-red-400 flex items-center gap-1 mb-2">
                        <AlertCircle size={14} /> 期限切れ (2年失効)
                    </div>
                    <div className="text-3xl font-bold text-red-500">{summary.expired} <span className="text-sm font-bold text-red-300">日</span></div>
                </div>
                <div className="bg-primary-light p-5 rounded-3xl shadow-sm border border-primary-light flex flex-col justify-between">
                    <div className="text-sm font-bold text-primary-dark mb-2">現在の有給残日数</div>
                    <div className="text-4xl font-black text-primary-dark">{summary.remaining} <span className="text-lg font-bold text-primary/70">日</span></div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <Calendar className="text-primary" size={20} />
                    有給休暇の新規付与
                </h3>

                <form onSubmit={handleAddGrant} className="flex flex-wrap gap-4 items-end bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500">付与日</label>
                        <input
                            type="date"
                            value={grantDate}
                            onChange={(e) => setGrantDate(e.target.value)}
                            className="w-full p-2.5 rounded-xl bg-white border border-gray-200 focus:ring-2 focus:ring-primary text-sm"
                            required
                        />
                    </div>
                    <div className="space-y-1 w-24">
                        <label className="text-xs font-bold text-gray-500">付与日数</label>
                        <input
                            type="number"
                            step="0.5"
                            value={grantDays}
                            onChange={(e) => setGrantDays(e.target.value)}
                            className="w-full p-2.5 rounded-xl bg-white border border-gray-200 focus:ring-2 focus:ring-primary text-sm font-bold"
                            required
                        />
                    </div>
                    <div className="space-y-1 flex-1 min-w-[200px]">
                        <label className="text-xs font-bold text-gray-500">メモ (任意)</label>
                        <input
                            type="text"
                            value={grantNote}
                            onChange={(e) => setGrantNote(e.target.value)}
                            placeholder="法定付与、特別休暇、など"
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
                        付与する
                    </Button>
                </form>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <span>📚</span> 付与履歴
                </h3>

                {isLoading ? (
                    <div className="py-8 text-center text-gray-400">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                        読み込み中...
                    </div>
                ) : grants.length === 0 ? (
                    <div className="py-8 text-center text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                        付与履歴はありません。
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 text-gray-400 text-xs font-bold uppercase tracking-wider">
                                    <th className="px-4 py-3">付与日</th>
                                    <th className="px-4 py-3">付与日数</th>
                                    <th className="px-4 py-3">メモ</th>
                                    <th className="px-4 py-3">有効期限 / 状態</th>
                                    <th className="px-4 py-3 text-right">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {grants.map(grant => {
                                    const grantDateStr = formatDateStr(toDate(grant.grantDate));
                                    const d = toDate(grant.grantDate);
                                    const expireDate = new Date(d.getFullYear() + 2, d.getMonth(), d.getDate());
                                    const isExpired = new Date() >= expireDate;

                                    return (
                                        <tr key={grant.docId} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-4 py-4 text-sm font-bold text-gray-800">
                                                {grantDateStr}
                                            </td>
                                            <td className="px-4 py-4 font-bold text-primary">
                                                +{grant.days} 日
                                            </td>
                                            <td className="px-4 py-4 text-xs text-gray-500">
                                                {grant.note || '-'}
                                            </td>
                                            <td className="px-4 py-4">
                                                {isExpired ? (
                                                    <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-red-50 text-red-500">
                                                        失効済み
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-gray-600">
                                                        ～ {formatDateStr(expireDate)}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                <Button
                                                    onClick={() => handleDeleteGrant(grant.docId, grant.days, grantDateStr)}
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

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mt-6">
                <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <span>🗓️</span> 有給消化履歴
                </h3>

                {isLoading ? (
                    <div className="py-8 text-center text-gray-400">読み込み中...</div>
                ) : usedApps.length === 0 ? (
                    <div className="py-8 text-center text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                        有給の利用履歴はありません。
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 text-gray-400 text-xs font-bold uppercase tracking-wider">
                                    <th className="px-4 py-3">取得日</th>
                                    <th className="px-4 py-3">種類</th>
                                    <th className="px-4 py-3">消化日数</th>
                                    <th className="px-4 py-3">申請理由</th>
                                    <th className="px-4 py-3 text-right">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {usedApps.map(app => (
                                    <tr key={app.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-4 py-4 text-sm font-bold text-gray-800">
                                            {app.date}
                                        </td>
                                        <td className="px-4 py-4 text-sm text-gray-600">
                                            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-lg font-bold text-xs">{app.type}</span>
                                        </td>
                                        <td className="px-4 py-4 font-bold text-gray-500">
                                            -{app.usedDays} 日
                                        </td>
                                        <td className="px-4 py-4 text-xs text-gray-500 max-w-[200px] truncate">
                                            {app.reason}
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <Button
                                                onClick={() => handleUndoApproveLeaveStr(app.id, app.date)}
                                                variant="outline"
                                                size="sm"
                                                className="px-3 py-1.5 text-xs font-bold text-gray-500 bg-gray-100 hover:bg-red-50 hover:text-red-500 border border-gray-200 rounded-lg transition-colors h-auto shadow-none"
                                                title="承認を取り消し、有給日数を戻す"
                                            >
                                                承認取消
                                            </Button>
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
