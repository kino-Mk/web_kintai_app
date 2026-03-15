import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, orderBy, getDocs, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { COLLECTIONS, AttendanceRecord } from '../types';
import { toDate, formatTimeStr, getStartOfToday, sendGasNotification } from '../utils';
import { X, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { useModal } from '../contexts/ModalContext';
import { Button } from './ui/Button';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export const StampCorrectionModal: React.FC<Props> = ({ isOpen, onClose }) => {
    const [loading, setLoading] = useState(false);
    const [stamps, setStamps] = useState<(AttendanceRecord & { selected?: boolean })[]>([]);
    const [reason, setReason] = useState('');
    const { showAlert, showConfirm } = useModal();

    useEffect(() => {
        if (isOpen) {
            loadTodayStamps();
        }
    }, [isOpen]);

    const loadTodayStamps = async () => {
        setLoading(true);
        try {
            const start = getStartOfToday();
            const q = query(
                collection(db, COLLECTIONS.ATTENDANCE),
                where('timestamp', '>=', start),
                orderBy('timestamp', 'asc')
            );
            const snapshot = await getDocs(q);
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                selected: false
            })) as any[];
            setStamps(list);
        } catch (error: any) {
            console.error('Stamp load error:', error);
            showAlert('打刻データの取得に失敗しました。しばらくしてからお試しください。');
        } finally {
            setLoading(false);
        }
    };

    const toggleSelect = (id: string) => {
        setStamps(stamps.map(s => s.id === id ? { ...s, selected: !s.selected } : s));
    };

    const handleSubmit = async () => {
        const selectedStamps = stamps.filter(s => s.selected);
        if (selectedStamps.length === 0) {
            await showAlert('修正したい打刻を選択してください。');
            return;
        }

        if (!reason.trim()) {
            await showAlert('修正の理由を入力してください。');
            return;
        }

        if (!(await showConfirm(`${selectedStamps.length} 件の打刻修正を申請しますか？`))) return;

        setLoading(true);
        try {
            const batch = writeBatch(db);
            selectedStamps.forEach(s => {
                const newRef = doc(collection(db, COLLECTIONS.STAMP_CORRECTIONS));
                batch.set(newRef, {
                    empId: s.empId,
                    empName: s.empName,
                    attendanceDocId: s.id,
                    attendanceType: s.type,
                    attendanceTime: s.timestamp,
                    reason: reason.trim(),
                    status: 'pending',
                    createdAt: serverTimestamp()
                });
            });
            await batch.commit();

            // GAS通知（バックグラウンド）
            sendGasNotification({
                action: 'notifyStampCorrection',
                count: selectedStamps.length,
                reason: reason.trim(),
                details: selectedStamps.map(s => ({
                    empId: s.empId,
                    empName: s.empName,
                    type: s.type,
                    time: formatTimeStr(toDate(s.timestamp))
                }))
            });

            await showAlert('修正申請を送信しました。');
            onClose();
            setReason('');
        } catch (error: any) {
            console.error('Stamp correction error:', error);
            await showAlert('申請に失敗しました。しばらくしてからお試しください。');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                <div className="px-8 py-6 bg-warning-bg flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center text-warning shadow-sm">
                            <AlertTriangle size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">打刻修正申請</h3>
                            <p className="text-xs text-warning-dark font-bold uppercase tracking-wider">Stamp Correction Request</p>
                        </div>
                    </div>
                    <Button
                        onClick={onClose}
                        variant="ghost"
                        className="w-10 h-10 p-0 rounded-xl transition-colors text-gray-400"
                    >
                        <X size={24} />
                    </Button>
                </div>

                <div className="p-8 space-y-6 overflow-y-auto max-h-[60vh] custom-scrollbar">
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                            <Clock size={14} /> 本日の打刻を選択してください
                        </label>
                        <div className="space-y-2">
                            {loading ? (
                                <div className="p-12 text-center animate-pulse text-gray-400">読み込み中...</div>
                            ) : stamps.length === 0 ? (
                                <div className="p-8 text-center text-gray-400 bg-gray-50 rounded-2xl border border-dashed">
                                    本日の打刻データがありません。
                                </div>
                            ) : (
                                stamps.map((s) => (
                                    <div
                                        key={s.id}
                                        onClick={() => toggleSelect(s.id!)}
                                        className={`flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${s.selected
                                                ? 'border-primary bg-primary-light/30 shadow-sm'
                                                : 'border-gray-100 bg-gray-50/50 hover:bg-gray-50'
                                            }`}
                                    >
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${s.selected ? 'bg-primary border-primary' : 'border-gray-300 bg-white'
                                            }`}>
                                            {s.selected && <CheckCircle2 size={12} className="text-white" />}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between">
                                                <span className="font-bold text-gray-700">{s.empName}</span>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.type === 'in' ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger'
                                                    }`}>
                                                    {s.type === 'in' ? '出勤' : '退勤'}
                                                </span>
                                            </div>
                                            <div className="text-xs text-gray-400 font-mono mt-1">
                                                {formatTimeStr(toDate(s.timestamp))}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                            修正の理由
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="例: 退勤時の打刻を忘れました。 / 二重に打刻してしまいました。"
                            className="w-full p-4 rounded-3xl bg-gray-50 border-none focus:ring-2 focus:ring-primary min-h-[100px] text-sm"
                        />
                    </div>
                </div>

                <div className="p-8 bg-gray-50/50 flex gap-4 border-t border-gray-100">
                    <Button
                        onClick={onClose}
                        variant="ghost"
                        className="flex-1 py-4 px-6 rounded-2xl font-bold text-gray-400 h-auto"
                    >
                        キャンセル
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={loading || stamps.length === 0}
                        isLoading={loading}
                        className="flex-[2] py-4 px-6 rounded-2xl font-bold bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all h-auto"
                    >
                        修正申請を送信
                    </Button>
                </div>
            </div>
        </div>
    );
};
