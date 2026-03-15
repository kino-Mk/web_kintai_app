import React, { useState, useMemo } from 'react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { Employee, COLLECTIONS } from '../types';
import { Search, Edit2, EyeOff, User, UserPlus, CheckSquare, Square as SquareIcon, Eye } from 'lucide-react';
import { useModal } from '../contexts/ModalContext';
import { AdminEmployeeDetail } from './AdminEmployeeDetail';
import { useEmployees } from '../hooks/useEmployees';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { TableVirtuoso } from 'react-virtuoso';

export const AdminEmployeeList = () => {
    const { data: employees = [], isLoading } = useEmployees(true);
    const queryClient = useQueryClient();
    
    const [filter, setFilter] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [newEmpName, setNewEmpName] = useState('');
    const [newEmpId, setNewEmpId] = useState('');
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { showAlert, showConfirm } = useModal();

    // 一括操作用の状態
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
            await updateDoc(doc(db, COLLECTIONS.EMPLOYEES, emp.id), {
                isHidden: !emp.isHidden,
                updatedAt: serverTimestamp()
            });
            await queryClient.invalidateQueries({ queryKey: ['employees'] });
        } catch (error: any) {
            await showAlert(`更新に失敗しました: ${error.message}`);
        }
    };

    // 一括非表示・表示
    const handleBulkToggle = async (hidden: boolean) => {
        if (selectedIds.size === 0) return;
        const action = hidden ? '非表示' : '表示';
        if (!(await showConfirm(`選択された ${selectedIds.size} 名を一括で${action}にしますか？`))) return;

        try {
            setIsSubmitting(true);
            const batch = writeBatch(db);
            selectedIds.forEach(id => {
                const empRef = doc(db, COLLECTIONS.EMPLOYEES, id);
                batch.update(empRef, { isHidden: hidden, updatedAt: serverTimestamp() });
            });
            await batch.commit();
            await queryClient.invalidateQueries({ queryKey: ['employees'] });
            setSelectedIds(new Set());
            await showAlert('更新が完了しました。');
        } catch (error: any) {
            await showAlert(`一括更新に失敗しました: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditClick = (emp: Employee) => {
        setSelectedEmployeeId(emp.id);
    };

    const filteredEmployees = useMemo(() => {
        return employees.filter(emp =>
            emp.name.includes(filter) || emp.id.includes(filter)
        );
    }, [employees, filter]);

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredEmployees.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredEmployees.map(e => e.id)));
        }
    };

    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

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
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">従業員管理</h2>
                    <p className="text-gray-500 dark:text-gray-400">従業員の登録、編集、表示設定を行います。</p>
                </div>
                <div className="flex gap-2">
                    {selectedIds.size > 0 && (
                        <div className="flex gap-2 animate-in fade-in slide-in-from-right-4">
                            <Button onClick={() => handleBulkToggle(false)} variant="outline" className="h-12 dark:border-slate-700">一括表示</Button>
                            <Button onClick={() => handleBulkToggle(true)} variant="outline" className="h-12 text-danger border-danger/30 hover:bg-danger/5">一括非表示</Button>
                        </div>
                    )}
                    <Button
                        onClick={() => setIsAdding(!isAdding)}
                        leftIcon={<UserPlus size={20} />}
                        className="px-6 py-3 rounded-2xl h-12"
                    >
                        新規登録
                    </Button>
                </div>
            </div>

            {isAdding && (
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-primary-light dark:border-primary/30 animate-in fade-in slide-in-from-top-4 duration-300">
                    <form onSubmit={handleAddEmployee} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Input
                            type="text"
                            placeholder="従業員ID (例: 1001)"
                            value={newEmpId}
                            onChange={(e) => setNewEmpId(e.target.value)}
                            className="bg-gray-50 dark:bg-slate-900 border-none"
                        />
                        <Input
                            type="text"
                            placeholder="名前 (例: 山田 太郎)"
                            value={newEmpName}
                            onChange={(e) => setNewEmpName(e.target.value)}
                            className="bg-gray-50 dark:bg-slate-900 border-none"
                        />
                        <Button type="submit" isLoading={isSubmitting} className="h-[52px] rounded-xl">
                            登録実行
                        </Button>
                    </form>
                </div>
            )}

            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden flex flex-col h-[600px]">
                <div className="p-4 border-b border-gray-50 dark:border-slate-700 flex items-center gap-3 bg-gray-50/50 dark:bg-slate-900/50">
                    <Search size={18} className="text-gray-400" />
                    <input
                        type="text"
                        placeholder="名前やIDで検索..."
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="bg-transparent border-none focus:ring-0 text-sm w-full dark:text-gray-100"
                    />
                </div>

                <div className="flex-1 overflow-auto">
                    <TableVirtuoso
                        {...({
                            data: filteredEmployees,
                            totalCount: filteredEmployees.length,
                            fixedHeaderContent: () => (
                                <tr className="bg-gray-50/80 dark:bg-slate-900/80 backdrop-blur-sm text-gray-400 text-xs font-bold uppercase tracking-wider">
                                    <th className="px-6 py-4 w-12">
                                        <button onClick={toggleSelectAll} className="text-gray-400 hover:text-primary transition-colors">
                                            {selectedIds.size === filteredEmployees.length && filteredEmployees.length > 0 ? <CheckSquare size={20} className="text-primary" /> : <SquareIcon size={20} />}
                                        </button>
                                    </th>
                                    <th className="px-6 py-4">ID</th>
                                    <th className="px-6 py-4">名前</th>
                                    <th className="px-6 py-4">ステータス</th>
                                    <th className="px-6 py-4 text-center">操作</th>
                                </tr>
                            ),
                            // @ts-ignore
                            itemContent: (index: any, emp: any) => (
                                <>
                                    <td className="px-6 py-4">
                                        <button onClick={() => toggleSelect(emp.id)} className="text-gray-300 hover:text-primary transition-colors">
                                            {selectedIds.has(emp.id) ? <CheckSquare size={20} className="text-primary" /> : <SquareIcon size={20} />}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 font-mono text-sm dark:text-gray-300">{emp.id}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-gray-400">
                                                <User size={16} />
                                            </div>
                                            <span className="font-bold text-gray-700 dark:text-gray-200">{emp.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${emp.isHidden ? 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400' : 'bg-success-bg dark:bg-success/10 text-success'}`}>
                                            {emp.isHidden ? '非表示' : '在職'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-1">
                                            <Button
                                                onClick={() => handleEditClick(emp)}
                                                variant="ghost"
                                                size="sm"
                                                className="text-gray-400 hover:text-primary transition-colors h-9 w-9 p-0 rounded-lg"
                                                title="編集・詳細"
                                            >
                                                <Edit2 size={18} />
                                            </Button>
                                            <Button
                                                onClick={() => handleToggleHidden(emp)}
                                                variant="ghost"
                                                size="sm"
                                                className={`transition-colors h-9 w-9 p-0 rounded-lg ${emp.isHidden ? 'text-primary hover:text-primary-dark' : 'text-gray-400 hover:text-danger'}`}
                                                title={emp.isHidden ? '表示にする' : '非表示にする'}
                                            >
                                                {emp.isHidden ? <Eye size={18} /> : <EyeOff size={18} />}
                                            </Button>
                                        </div>
                                    </td>
                                </>
                            ),
                            components: {
                                Table: (props: any) => <table {...props} className="w-full text-left border-collapse" />,
                                TableRow: (props: any) => {
                                    const index = props['data-index'];
                                    const emp = (filteredEmployees as any)[index];
                                    return <tr {...props} className={`hover:bg-gray-50/50 dark:hover:bg-slate-700/50 transition-colors ${emp?.isHidden ? 'opacity-50' : ''}`} />;
                                }
                            }
                        } as any)}
                    />
                    {isLoading && filteredEmployees.length === 0 && (
                        <div className="text-center p-8 text-gray-400 animate-pulse">読み込み中...</div>
                    )}
                    {!isLoading && filteredEmployees.length === 0 && (
                        <div className="text-center p-8 text-gray-400">該当する従業員がいません。</div>
                    )}
                </div>
            </div>
        </div>
    );
};
