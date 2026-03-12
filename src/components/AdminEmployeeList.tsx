import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Employee, COLLECTIONS } from '../types';
import { Search, Edit2, EyeOff, User, UserPlus } from 'lucide-react';
import { useModal } from '../contexts/ModalContext';
import { AdminEmployeeDetail } from './AdminEmployeeDetail';
import { useEmployees } from '../hooks/useEmployees';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

export const AdminEmployeeList: React.FC = () => {
    const { data: employees = [], isLoading } = useEmployees(true);
    const queryClient = useQueryClient();
    
    const [filter, setFilter] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [newEmpName, setNewEmpName] = useState('');
    const [newEmpId, setNewEmpId] = useState('');
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { showAlert, showConfirm } = useModal();

    const handleAddEmployee = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEmpName.trim() || !newEmpId.trim()) {
            await showAlert('名前とIDを入力してください。');
            return;
        }

        if (employees.some(emp => emp.id === newEmpId)) {
            await showAlert('この従業員IDは既に使用されています。');
            return;
        }

        try {
            setIsSubmitting(true);
            await addDoc(collection(db, COLLECTIONS.EMPLOYEES), {
                id: newEmpId.trim(),
                name: newEmpName.trim(),
                isHidden: false,
                createdAt: serverTimestamp()
            });
            await queryClient.invalidateQueries({ queryKey: ['employees'] });
            setNewEmpName('');
            setNewEmpId('');
            setIsAdding(false);
            await showAlert('従業員を登録しました。');
        } catch (error: any) {
            await showAlert(`エラーが発生しました: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleToggleHidden = async (emp: Employee) => {
        const action = emp.isHidden ? '表示' : '非表示 (削除扱い)';
        if (!(await showConfirm(`${emp.name} さんを${action} にしますか？`))) return;

        try {
            // 注意: Firestore上では doc.id が必要です。hooksでは返す際に id にセットしていますが、ここでは検索用に使うか、元のdoc.idが必要です。
            // useEmployees内で 'doc.id' を 'id' というプロパティに入れているため、doc() には emp.id を渡します。
            await updateDoc(doc(db, COLLECTIONS.EMPLOYEES, emp.id), {
                isHidden: !emp.isHidden,
                updatedAt: serverTimestamp()
            });
            await queryClient.invalidateQueries({ queryKey: ['employees'] });
        } catch (error: any) {
            await showAlert(`更新に失敗しました: ${error.message}`);
        }
    };

    const handleEditClick = (emp: Employee) => {
        setSelectedEmployeeId(emp.id);
    };

    const filteredEmployees = employees.filter(emp =>
        emp.name.includes(filter) || emp.id.includes(filter)
    );

    if (selectedEmployeeId) {
        return (
            <AdminEmployeeDetail
                employeeId={selectedEmployeeId}
                onBack={() => setSelectedEmployeeId(null)}
            />
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">従業員管理</h2>
                    <p className="text-gray-500">従業員の登録、編集、表示設定を行います。</p>
                </div>
                <Button
                    onClick={() => setIsAdding(!isAdding)}
                    leftIcon={<UserPlus size={20} />}
                    className="px-6 py-3 rounded-2xl h-12"
                >
                    新規登録
                </Button>
            </div>

            {isAdding && (
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-primary-light animate-in fade-in slide-in-from-top-4 duration-300">
                    <form onSubmit={handleAddEmployee} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Input
                            type="text"
                            placeholder="従業員ID (例: 1001)"
                            value={newEmpId}
                            onChange={(e) => setNewEmpId(e.target.value)}
                            className="bg-gray-50 border-none"
                        />
                        <Input
                            type="text"
                            placeholder="名前 (例: 山田 太郎)"
                            value={newEmpName}
                            onChange={(e) => setNewEmpName(e.target.value)}
                            className="bg-gray-50 border-none"
                        />
                        <Button type="submit" isLoading={isSubmitting} className="h-[52px] rounded-xl">
                            登録実行
                        </Button>
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
                            {isLoading ? (
                                <tr>
                                    <td colSpan={4} className="text-center p-8 text-gray-400 animate-pulse">読み込み中...</td>
                                </tr>
                            ) : filteredEmployees.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="text-center p-8 text-gray-400">該当する従業員がいません。</td>
                                </tr>
                            ) : (
                                filteredEmployees.map((emp) => (
                                    <tr key={emp.id} className={`hover:bg-gray-50/50 transition-colors ${emp.isHidden ? 'opacity-50' : ''}`}>
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
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${emp.isHidden ? 'bg-gray-100 text-gray-500' : 'bg-success-bg text-success'}`}>
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
                                                    className={`p-2 transition-colors ${emp.isHidden ? 'text-primary hover:text-primary-dark' : 'text-gray-400 hover:text-danger'}`}
                                                    title={emp.isHidden ? '表示にする' : '非表示にする'}
                                                >
                                                    <EyeOff size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
