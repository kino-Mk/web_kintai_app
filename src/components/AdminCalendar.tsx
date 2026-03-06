import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { COLLECTIONS } from '../types';
import { Calendar as CalendarIcon, Plus, Trash2, Info } from 'lucide-react';
import { useModal } from '../contexts/ModalContext';

interface Holiday {
    id?: string;
    date: string;
    name: string;
}

export const AdminCalendar: React.FC = () => {
    const [holidays, setHolidays] = useState<Holiday[]>([]);
    const [newDate, setNewDate] = useState('');
    const [newName, setNewName] = useState('');
    const [loading, setLoading] = useState(true);
    const { showAlert, showConfirm } = useModal();

    useEffect(() => {
        const q = query(collection(db, COLLECTIONS.HOLIDAYS), orderBy('date', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setHolidays(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Holiday[]);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newDate || !newName.trim()) {
            await showAlert('日付と祝日名を入力してください。');
            return;
        }

        try {
            await addDoc(collection(db, COLLECTIONS.HOLIDAYS), {
                date: newDate,
                name: newName.trim(),
                createdAt: serverTimestamp()
            });
            setNewDate('');
            setNewName('');
            await showAlert('祝日を登録しました。');
        } catch (error: any) {
            await showAlert(`登録失敗: ${error.message}`);
        }
    };

    const handleDelete = async (holiday: Holiday) => {
        if (!(await showConfirm(`${holiday.date} (${holiday.name}) を削除しますか？`))) return;

        try {
            await deleteDoc(doc(db, COLLECTIONS.HOLIDAYS, holiday.id!));
        } catch (error: any) {
            await showAlert(`削除失敗: ${error.message}`);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">祝日・休日設定</h2>
                    <p className="text-gray-500">法定祝日や会社独自の休日を登録します。</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-4">
                    <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100">
                        <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                            <Plus size={20} className="text-primary" /> 新規登録
                        </h3>
                        <form onSubmit={handleAdd} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">日付</label>
                                <input
                                    type="date"
                                    value={newDate}
                                    onChange={(e) => setNewDate(e.target.value)}
                                    className="w-full p-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-primary font-bold text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">祝日・休日名</label>
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    placeholder="例: 夏季休暇"
                                    className="w-full p-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-primary font-bold text-sm"
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full py-4 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                登録する
                            </button>
                        </form>
                    </div>

                    <div className="bg-primary-light/20 p-6 rounded-[2rem] border border-primary-light/50">
                        <div className="flex gap-3 text-primary">
                            <Info size={20} className="shrink-0" />
                            <div className="text-xs leading-relaxed">
                                ここに登録された日付は、勤怠集計時に「休日」として扱われます。土日以外の休日を設定してください。
                            </div>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-2">
                    <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-6 border-b border-gray-50 bg-gray-50/30 flex items-center justify-between">
                            <h3 className="font-bold text-gray-700 flex items-center gap-2">
                                <CalendarIcon size={20} className="text-gray-400" /> 登録済み一覧
                            </h3>
                            <span className="text-[10px] font-bold text-gray-400 uppercase">{holidays.length} 設定済み</span>
                        </div>
                        <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                            <table className="w-full text-left">
                                <thead className="sticky top-0 bg-white shadow-sm z-10">
                                    <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                        <th className="px-8 py-4">日付</th>
                                        <th className="px-8 py-4">祝日名</th>
                                        <th className="px-8 py-4 text-center">操作</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {loading ? (
                                        <tr><td colSpan={3} className="px-8 py-12 text-center text-gray-300 animate-pulse">読み込み中...</td></tr>
                                    ) : holidays.length === 0 ? (
                                        <tr><td colSpan={3} className="px-8 py-12 text-center text-gray-400 italic">登録された祝日はありません。</td></tr>
                                    ) : (
                                        holidays.map((h) => (
                                            <tr key={h.id} className="hover:bg-gray-50/50 transition-colors group">
                                                <td className="px-8 py-4 font-mono font-bold text-gray-600">{h.date}</td>
                                                <td className="px-8 py-4">
                                                    <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold">{h.name}</span>
                                                </td>
                                                <td className="px-8 py-4">
                                                    <div className="flex justify-center">
                                                        <button
                                                            onClick={() => handleDelete(h)}
                                                            className="p-2 text-gray-300 hover:text-danger hover:bg-danger-bg rounded-xl transition-all active:scale-95"
                                                        >
                                                            <Trash2 size={18} />
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
            </div>
        </div>
    );
};
