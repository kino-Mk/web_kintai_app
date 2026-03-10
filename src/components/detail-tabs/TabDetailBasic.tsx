import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Employee, COLLECTIONS } from '../../types';
import { useModal } from '../../contexts/ModalContext';

interface Props {
    employee: Employee;
}

export const TabDetailBasic: React.FC<Props> = ({ employee }) => {
    const [editForm, setEditForm] = useState({
        name: employee.name || '',
        email: employee.email || '',
        password: employee.password || '',
        isHidden: !!employee.isHidden
    });
    const [isSaving, setIsSaving] = useState(false);

    // Stats
    const [monthRate, setMonthRate] = useState<string>('--');
    const [totalRate, setTotalRate] = useState<string>('--');
    const [paidLeaveBalance, setPaidLeaveBalance] = useState<number | string>('--');
    const [includePaidLeave, setIncludePaidLeave] = useState(false);

    const { showAlert, showConfirm } = useModal();

    useEffect(() => {
        setEditForm({
            name: employee.name || '',
            email: employee.email || '',
            password: employee.password || '',
            isHidden: !!employee.isHidden
        });

        // TODO: Load real attendance rates and leave balance
        // This will be implemented along with AdminRateOverview logic
        setMonthRate('実装中');
        setTotalRate('実装中');
        setPaidLeaveBalance(employee.paidLeave || '--');

    }, [employee]);

    const handleSave = async () => {
        if (!editForm.name.trim()) {
            await showAlert('氏名を入力してください。');
            return;
        }

        try {
            setIsSaving(true);
            await updateDoc(doc(db, COLLECTIONS.EMPLOYEES, employee.docId || employee.id), {
                name: editForm.name.trim(),
                email: editForm.email.trim(),
                password: editForm.password.trim(),
                isHidden: editForm.isHidden,
                updatedAt: serverTimestamp()
            });
            await showAlert('従業員情報を更新しました。');
        } catch (error: any) {
            await showAlert(`更新に失敗しました: ${error.message}`);
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
            await showAlert(`削除に失敗しました: ${error.message}`);
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
                    <div className="text-sm text-gray-400 bg-gray-50 p-4 rounded-xl text-center">
                        詳細な推移データは準備中です...
                    </div>
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
                        <label className="text-xs font-bold text-gray-500 mb-1 block">打刻制限用パスワード</label>
                        <input
                            type="password"
                            value={editForm.password}
                            onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                            placeholder="スマホ打刻制限用"
                            className="w-full p-3 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-primary"
                        />
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
