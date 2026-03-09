import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { Employee, COLLECTIONS, AttendanceRecord, AttendanceType } from '../types';
import { toDate, formatTimeStr, getStartOfToday } from '../utils';
import { Clock, Play, Square, MessageSquare, ArrowLeft } from 'lucide-react';
import { useModal } from '../contexts/ModalContext';

interface Props {
    employee: Employee;
    onBack: () => void;
    onComplete?: () => void;
}

export const AttendanceScreen: React.FC<Props> = ({ employee, onBack, onComplete }) => {
    const [now, setNow] = useState(new Date());
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [remark, setRemark] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { showAlert, showConfirm } = useModal();

    // 時計の更新
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // 当日の記録を取得
    useEffect(() => {
        const today = getStartOfToday();
        const q = query(
            collection(db, COLLECTIONS.ATTENDANCE),
            where('empId', '==', employee.id),
            where('timestamp', '>=', today),
            orderBy('timestamp', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as AttendanceRecord[];
            setRecords(list);
        });

        return () => unsubscribe();
    }, [employee.id]);

    const handleStamp = async (type: AttendanceType) => {
        const typeLabel = type === 'in' ? '出勤' : '退勤';

        // 二重打刻チェック（簡易）
        if (records.length > 0 && records[0].type === type) {
            if (!(await showConfirm(`既に${typeLabel}打刻がありますが、上書き（追加）しますか？`))) {
                return;
            }
        }

        try {
            setIsSubmitting(true);
            await addDoc(collection(db, COLLECTIONS.ATTENDANCE), {
                empId: employee.id,
                empName: employee.name,
                type,
                remark: remark.trim(),
                timestamp: serverTimestamp(),
                createdAt: serverTimestamp()
            });

            setRemark('');
            await showAlert(`${typeLabel}を記録しました。お疲れ様です！`);
            if (onComplete) onComplete();
        } catch (error: any) {
            console.error("Stamp error:", error);
            await showAlert(`エラーが発生しました: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-gray-600 transition-colors">
                <ArrowLeft size={20} />
                戻る
            </button>

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 text-center">
                <h2 className="text-xl font-bold text-gray-800 mb-6">{employee.name} さん</h2>

                <div className="mb-8">
                    <div className="text-5xl font-mono font-bold text-primary mb-2 flex items-center justify-center gap-4">
                        <Clock size={40} className="text-primary-light" />
                        {formatTimeStr(now)}
                    </div>
                    <p className="text-gray-400">{now.toLocaleDateString('ja-JP', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>

                <div className="flex flex-col md:flex-row gap-4 mb-8">
                    <button
                        onClick={() => handleStamp('in')}
                        disabled={isSubmitting}
                        className="flex-1 bg-primary text-white p-6 rounded-2xl shadow-lg hover:shadow-xl hover:bg-primary-dark transition-all disabled:opacity-50 flex items-center justify-center gap-3 text-xl font-bold active:scale-95"
                    >
                        <Play size={24} fill="currentColor" />
                        出勤
                    </button>
                    <button
                        onClick={() => handleStamp('out')}
                        disabled={isSubmitting}
                        className="flex-1 bg-white border-2 border-primary text-primary p-6 rounded-2xl hover:bg-primary-light transition-all disabled:opacity-50 flex items-center justify-center gap-3 text-xl font-bold active:scale-95"
                    >
                        <Square size={24} fill="currentColor" />
                        退勤
                    </button>
                </div>

                <div className="relative">
                    <textarea
                        value={remark}
                        onChange={(e) => setRemark(e.target.value)}
                        placeholder="備考欄（任意：外出、遅刻理由など）"
                        className="w-full p-4 pl-12 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-primary h-24 resize-none transition-all"
                    />
                    <MessageSquare className="absolute left-4 top-4 text-gray-300" size={20} />
                </div>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-700 mb-4 pb-2 border-b border-gray-50">本日の記録</h3>
                {records.length === 0 ? (
                    <p className="text-center py-8 text-gray-400">本日の記録はまだありません。</p>
                ) : (
                    <div className="space-y-3">
                        {records.map((rec) => (
                            <div key={rec.id} className="flex items-center justify-between p-4 rounded-xl bg-gray-50">
                                <div className="flex items-center gap-4">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${rec.type === 'in' ? 'bg-success-bg text-success' : 'bg-primary-light text-primary'
                                        }`}>
                                        {rec.type === 'in' ? '出勤' : '退勤'}
                                    </span>
                                    <span className="font-mono font-bold text-gray-700">{formatTimeStr(toDate(rec.timestamp))}</span>
                                </div>
                                {rec.remark && (
                                    <span className="text-sm text-gray-500 italic max-w-[200px] truncate">{rec.remark}</span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
