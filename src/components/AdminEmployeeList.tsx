import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Employee, COLLECTIONS } from '../types';
import { Search, Edit2, EyeOff, User, Info, UserPlus } from 'lucide-react';
import { useModal } from '../contexts/ModalContext';

export const AdminEmployeeList: React.FC = () => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [filter, setFilter] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [newEmpName, setNewEmpName] = useState('');
    const [newEmpId, setNewEmpId] = useState('');
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [editForm, setEditForm] = useState({
        name: '',
        password: '',
        email: '',
        paidLeave: 0,
        isHidden: false
    });
    const { showAlert, showConfirm } = useModal();

    useEffect(() => {
        const q = query(collection(db, COLLECTIONS.EMPLOYEES), orderBy('name', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                docId: doc.id,
                ...doc.data()
            })) as Employee[];
            setEmployees(list);
        });
        return () => unsubscribe();
    }, []);

    const handleAddEmployee = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEmpName.trim() || !newEmpId.trim()) {
            await showAlert('名前とIDを入力してください。');
            return;
        }

        if (employees.some(e => e.id === newEmpId)) {
            await showAlert('この従業員IDは既に使用されています。');
            return;
        }

        try {
            await addDoc(collection(db, COLLECTIONS.EMPLOYEES), {
                id: newEmpId.trim(),
                name: newEmpName.trim(),
                isHidden: false,
                createdAt: serverTimestamp()
            });
            setNewEmpName('');
            setNewEmpId('');
            setIsAdding(false);
            await showAlert('従業員を登録しました。');
        } catch (error: any) {
            await showAlert(`エラーが発生しました: ${error.message} `);
        }
    };

    const handleToggleHidden = async (emp: Employee) => {
        const action = emp.isHidden ? '表示' : '非表示 (削除扱い)';
        if (!(await showConfirm(`${emp.name} さんを${action} にしますか？`))) return;

        try {
            await updateDoc(doc(db, COLLECTIONS.EMPLOYEES, emp.docId || emp.id), {
                isHidden: !emp.isHidden,
                updatedAt: serverTimestamp()
            });
        } catch (error: any) {
            await showAlert(`更新に失敗しました: ${error.message} `);
        }
    };

    const handleEditClick = (emp: Employee) => {
        setSelectedEmployee(emp);
        setEditForm({
            name: emp.name,
            password: emp.password || '',
            email: emp.email || '',
            paidLeave: emp.paidLeave || 0,
            isHidden: !!emp.isHidden
        });
    };

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEmployee) return;

        if (!editForm.name.trim()) {
            await showAlert('名前を入力してください。');
            return;
        }

        try {
            await updateDoc(doc(db, COLLECTIONS.EMPLOYEES, selectedEmployee.docId || selectedEmployee.id), {
                name: editForm.name.trim(),
                password: editForm.password.trim(),
                email: editForm.email.trim(),
                paidLeave: Number(editForm.paidLeave),
                isHidden: editForm.isHidden,
                updatedAt: serverTimestamp()
            });
            await showAlert('従業員情報を更新しました。');
            setSelectedEmployee(null);
        } catch (error: any) {
            await showAlert(`更新に失敗しました: ${error.message} `);
        }
    };

    const handleDeleteEmployee = async () => {
        if (!selectedEmployee) return;
        if (!(await showConfirm(`${selectedEmployee.name} さんを本当に削除しますか？\n（過去の打刻データは残りますが、一覧からは完全に消去されます）`))) return;

        try {
            // In a real app we'd delete the doc, but for now we might just hide or actually delete.
            // The legacy app did an actual delete.
            const { deleteDoc } = await import('firebase/firestore');
            await deleteDoc(doc(db, COLLECTIONS.EMPLOYEES, selectedEmployee.docId || selectedEmployee.id));
            await showAlert('削除しました。');
            setSelectedEmployee(null);
        } catch (error: any) {
            await showAlert(`削除に失敗しました: ${error.message} `);
        }
    };

    const filteredEmployees = employees.filter(emp =>
        emp.name.includes(filter) || emp.id.includes(filter)
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">従業員管理</h2>
                    <p className="text-gray-500">従業員の登録、編集、表示設定を行います。</p>
                </div>
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-2xl shadow-lg hover:bg-primary-dark transition-all font-bold active:scale-95"
                >
                    <UserPlus size={20} />
                    新規登録
                </button>
            </div>

            {isAdding && (
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-primary-light animate-in fade-in slide-in-from-top-4 duration-300">
                    <form onSubmit={handleAddEmployee} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <input
                            type="text"
                            placeholder="従業員ID (例: 1001)"
                            value={newEmpId}
                            onChange={(e) => setNewEmpId(e.target.value)}
                            className="p-3 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-primary"
                        />
                        <input
                            type="text"
                            placeholder="名前 (例: 山田 太郎)"
                            value={newEmpName}
                            onChange={(e) => setNewEmpName(e.target.value)}
                            className="p-3 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-primary"
                        />
                        <button type="submit" className="bg-primary text-white rounded-xl font-bold hover:bg-primary-dark transition-colors">
                            登録実行
                        </button>
                    </form>
                </div>
            )}

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-50 flex items-center gap-3 bg-gray-50/50">
                    <Search size={18} className="text-gray-400" />
                    <input
                        type="text"
                        placeholder="名前やIDで検索..."
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="bg-transparent border-none focus:ring-0 text-sm w-full"
                    />
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 text-gray-400 text-xs font-bold uppercase tracking-wider">
                                <th className="px-6 py-4">ID</th>
                                <th className="px-6 py-4">名前</th>
                                <th className="px-6 py-4">ステータス</th>
                                <th className="px-6 py-4 text-center">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredEmployees.map((emp) => (
                                <tr key={emp.id} className={`hover: bg - gray - 50 / 50 transition - colors ${emp.isHidden ? 'opacity-50' : ''} `}>
                                    <td className="px-6 py-4 font-mono text-sm">{emp.id}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                                                <User size={16} />
                                            </div>
                                            <span className="font-bold text-gray-700">{emp.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px - 2 py - 1 rounded - full text - [10px] font - bold ${emp.isHidden ? 'bg-gray-100 text-gray-500' : 'bg-success-bg text-success'
                                            } `}>
                                            {emp.isHidden ? '非表示' : '在職'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex justify-center gap-2">
                                            <button
                                                onClick={() => handleEditClick(emp)}
                                                className="p-2 text-gray-400 hover:text-primary transition-colors"
                                                title="編集・詳細">
                                                <Edit2 size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleToggleHidden(emp)}
                                                className={`p - 2 transition - colors ${emp.isHidden ? 'text-primary hover:text-primary-dark' : 'text-gray-400 hover:text-danger'} `}
                                                title={emp.isHidden ? '表示にする' : '非表示にする'}
                                            >
                                                <EyeOff size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 従業員詳細・編集モーダル (インライン表示) */}
            {selectedEmployee && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white/90 backdrop-blur-sm z-10">
                            <h3 className="text-xl font-bold text-gray-800">
                                {selectedEmployee.name} ({selectedEmployee.id})
                            </h3>
                            <button onClick={() => setSelectedEmployee(null)} className="text-gray-400 hover:text-gray-600 font-bold p-2 bg-gray-50 rounded-full">
                                ✕
                            </button>
                        </div>

                        <div className="p-6">
                            <form onSubmit={handleSaveEdit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-600">氏名</label>
                                        <input
                                            type="text"
                                            value={editForm.name}
                                            onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                            className="w-full p-3 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-primary"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-600">パスワード (モバイル認証用)</label>
                                        <input
                                            type="text"
                                            value={editForm.password}
                                            onChange={e => setEditForm({ ...editForm, password: e.target.value })}
                                            className="w-full p-3 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-primary"
                                            placeholder="未設定"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-600">メールアドレス</label>
                                        <input
                                            type="email"
                                            value={editForm.email}
                                            onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                                            className="w-full p-3 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-primary"
                                            placeholder="未設定"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-1">
                                            <label className="text-sm font-bold text-gray-600">基本有給日数（初期値/調整用）</label>
                                            <div className="group relative">
                                                <Info size={14} className="text-gray-300" />
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-800 text-white text-[10px] rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                                                    初期付与日数や、過去の繰り越し分を手動調整する場合に入力します。
                                                </div>
                                            </div>
                                        </div>
                                        <input
                                            type="number"
                                            step="0.5"
                                            value={editForm.paidLeave}
                                            onChange={e => setEditForm({ ...editForm, paidLeave: parseFloat(e.target.value) || 0 })}
                                            className="w-full p-3 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-primary"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 p-4 bg-gray-50 rounded-xl">
                                    <input
                                        type="checkbox"
                                        id="edit-hidden"
                                        checked={editForm.isHidden}
                                        onChange={e => setEditForm({ ...editForm, isHidden: e.target.checked })}
                                        className="w-5 h-5 text-primary rounded border-gray-300 focus:ring-primary"
                                    />
                                    <label htmlFor="edit-hidden" className="font-bold text-gray-700 cursor-pointer">
                                        一覧から非表示にする（退職者など）
                                    </label>
                                </div>

                                <div className="flex justify-between items-center pt-6 border-t border-gray-100">
                                    <button
                                        type="button"
                                        onClick={handleDeleteEmployee}
                                        className="text-danger hover:bg-red-50 px-4 py-2 rounded-xl font-bold transition-colors"
                                    >
                                        この従業員を削除
                                    </button>
                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedEmployee(null)}
                                            className="px-6 py-3 rounded-xl font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                                        >
                                            キャンセル
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-8 py-3 rounded-xl font-bold bg-primary text-white hover:bg-primary-dark shadow-lg shadow-primary/30 transition-all active:scale-95"
                                        >
                                            保存する
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
