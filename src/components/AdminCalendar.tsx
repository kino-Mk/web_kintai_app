import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { COLLECTIONS } from '../types';
import { formatDateStr } from '../utils';
import { Calendar as CalendarIcon, Plus, Trash2, Info, CalendarDays } from 'lucide-react';
import { useModal } from '../contexts/ModalContext';
import { Button } from './ui/Button';

interface Holiday {
    id?: string;
    date: string;
    name: string;
}

export const AdminCalendar: React.FC = () => {
    const [holidays, setHolidays] = useState<Holiday[]>([]);
    const [newDate, setNewDate] = useState('');
    const [newName, setNewName] = useState('');
    const [autoMonth, setAutoMonth] = useState(formatDateStr(new Date()).substring(0, 7));
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

    const handleAutoSet = async () => {
        if (!autoMonth) return;

        if (!(await showConfirm(`${autoMonth} の土日・祝日を自動登録しますか？`))) return;

        setLoading(true);
        try {
            const [yearStr, monthStr] = autoMonth.split('-');
            const year = parseInt(yearStr, 10);
            const month = parseInt(monthStr, 10);

            // Fetch public holidays API
            const response = await fetch('https://holidays-jp.github.io/api/v1/date.json');
            const jpHolidays = await response.json();

            const existingDates = new Set(holidays.map(h => h.date));
            const daysInMonth = new Date(year, month, 0).getDate();
            const batch = writeBatch(db);
            let addCount = 0;

            for (let d = 1; d <= daysInMonth; d++) {
                const currentDate = new Date(year, month - 1, d);
                const dateStr = formatDateStr(currentDate);

                const dayOfWeek = currentDate.getDay();
                let isHoliday = false;
                let holidayName = '';

                if (dayOfWeek === 0) {
                    isHoliday = true;
                    holidayName = '法定休日(日)';
                } else if (dayOfWeek === 6) {
                    isHoliday = true;
                    holidayName = '所定休日(土)';
                } else if (jpHolidays[dateStr]) {
                    isHoliday = true;
                    holidayName = jpHolidays[dateStr];
                }

                if (isHoliday && !existingDates.has(dateStr)) {
                    const newRef = doc(collection(db, COLLECTIONS.HOLIDAYS));
                    batch.set(newRef, {
                        date: dateStr,
                        name: holidayName,
                        createdAt: serverTimestamp()
                    });
                    addCount++;
                }
            }

            if (addCount > 0) {
                await batch.commit();
                await showAlert(`${addCount} 件の休日を登録しました。`);
            } else {
                await showAlert('登録対象の新しい休日はありませんでした。（すでに登録済み等）');
            }
        } catch (error: any) {
            console.error(error);
            await showAlert(`自動登録に失敗しました: ${error.message}`);
        } finally {
            setLoading(false);
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
                            <Plus size={20} className="text-primary" /> 新規手動登録
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
                            <Button
                                type="submit"
                                className="w-full py-4 rounded-2xl font-bold shadow-lg shadow-primary/20 h-auto"
                                leftIcon={<Plus size={20} />}
                            >
                                登録する
                            </Button>
                        </form>
                    </div>

                    <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100">
                        <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                            <CalendarDays size={20} className="text-primary" /> 土日祝の一括登録
                        </h3>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">対象月</label>
                                <input
                                    type="month"
                                    value={autoMonth}
                                    onChange={(e) => setAutoMonth(e.target.value)}
                                    className="w-full p-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-primary font-bold text-sm"
                                />
                            </div>
                            <Button
                                onClick={handleAutoSet}
                                disabled={loading}
                                isLoading={loading}
                                variant="outline"
                                className="w-full py-4 bg-gray-800 text-white border-none rounded-2xl font-bold shadow-lg hover:bg-black transition-all h-auto"
                            >
                                自動登録を実行
                            </Button>
                            <p className="text-[10px] text-gray-400 mt-2 text-center">
                                日本の祝日APIと連携し、指定月の土日・祝日を一括登録します。（登録済みの日はスキップされます）
                            </p>
                        </div>
                    </div>

                    <div className="bg-primary-light/20 p-6 rounded-[2rem] border border-primary-light/50">
                        <div className="flex gap-3 text-primary">
                            <Info size={20} className="shrink-0" />
                            <div className="text-xs leading-relaxed">
                                ここに登録された日付は、勤怠集計時に「休日」として扱われます。
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
                        <div className="max-h-[700px] overflow-y-auto custom-scrollbar">
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
                                        <tr><td colSpan={3} className="px-8 py-12 text-center text-gray-400 italic">登録された休日はありません。</td></tr>
                                    ) : (
                                        holidays.map((h) => (
                                            <tr key={h.id} className="hover:bg-gray-50/50 transition-colors group">
                                                <td className="px-8 py-4 font-mono font-bold text-gray-600">{h.date}</td>
                                                <td className="px-8 py-4">
                                                    <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold">{h.name}</span>
                                                </td>
                                                <td className="px-8 py-4">
                                                    <div className="flex justify-center">
                                                        <Button
                                                            onClick={() => handleDelete(h)}
                                                            variant="ghost"
                                                            size="sm"
                                                            className="p-2 text-gray-300 hover:text-danger hover:bg-danger-bg rounded-xl transition-all h-10 w-10 p-0"
                                                        >
                                                            <Trash2 size={18} />
                                                        </Button>
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
