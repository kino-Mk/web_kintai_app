import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { Employee, COLLECTIONS, AttendanceRecord, AttendanceType } from '../types';
import { toDate, formatTimeStr, getStartOfToday } from '../utils';
import { Clock, Play, Square, MessageSquare, ArrowLeft, LogOut } from 'lucide-react';
import { useModal } from '../contexts/ModalContext';

interface Props {
    employee: Employee;
    onBack: () => void;
    onComplete?: () => void;
    onGoApplication?: () => void;
}

export const AttendanceScreen: React.FC<Props> = ({ employee, onBack, onComplete, onGoApplication }) => {
    const [now, setNow] = useState(new Date());
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [remark, setRemark] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { showAlert, showConfirm } = useModal();

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

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
        if (isMobile) {
            await showAlert('スマートフォンからの打刻は許可されていません。（申請のみ可能）');
            return;
        }

        const hasIn = records.some(r => r.type === 'in');
        const hasOut = records.some(r => r.type === 'out');

        if (type === 'in') {
            if (hasIn) {
                await showAlert('既に出勤打刻済みです。');
                return;
            }
            if (hasOut) {
                await showAlert('本日は既に退勤済みです。');
                return;
            }
        } else if (type === 'out') {
            if (hasOut) {
                await showAlert('既に退勤打刻済みです。');
                return;
            }
            if (!hasIn) {
                await showAlert('出勤打刻がされていません。');
                return;
            }
        }

        const typeLabel = type === 'in' ? '出勤' : '退勤';
        const confirmMsg = type === 'in' ? '出勤しますか？' : '退勤しますか？';
        if (!(await showConfirm(confirmMsg))) return;

        try {
            setIsSubmitting(true);
            await addDoc(collection(db, COLLECTIONS.ATTENDANCE), {
                empId: employee.id,
                empName: employee.name,
                type,
                timestamp: serverTimestamp(),
                createdAt: serverTimestamp()
            });

            setRemark('');
            await showAlert(`${typeLabel} を打刻しました。`); // Updated alert message
            if (onComplete) onComplete();
        } catch (error: any) {
            console.error("Stamp error:", error);
            await showAlert('打刻に失敗しました。しばらくしてからお試しください。');
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
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-800">{employee.name} さん</h2>
                    <button
                        onClick={onBack}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                        title="ログアウト"
                    >
                        <LogOut size={20} />
                    </button>
                </div>

                <div className="mb-8">
                    <div className="text-5xl font-mono font-bold text-primary mb-2 flex items-center justify-center gap-4">
                        <Clock size={40} className="text-primary-light" />
                        {formatTimeStr(now)}
                    </div>
                    <p className="text-gray-400">{now.toLocaleDateString('ja-JP', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>

                {isMobile ? (
                    <div className="mb-8 bg-orange-50 p-6 rounded-2xl border border-orange-100 text-left">
                        <p className="text-orange-600 font-bold mb-4 flex items-start gap-3">
                            <span className="text-xl">📱</span>
                            <span>
                                スマートフォンからは打刻できません。<br />
                                勤怠や休暇の登録は申請メニューから行ってください。
                            </span>
                        </p>
                        <button
                            onClick={onGoApplication}
                            className="w-full bg-primary text-white p-4 rounded-xl font-bold shadow-lg shadow-primary/30 active:scale-95 transition-all text-center block"
                        >
                            各種申請メニューへ
                        </button>
                    </div>
                ) : (
                    <>
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
                    </>
                )}
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
                                    <span className={`px - 3 py - 1 rounded - full text - xs font - bold ${rec.type === 'in' ? 'bg-success-bg text-success' : 'bg-primary-light text-primary'} `}>
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
