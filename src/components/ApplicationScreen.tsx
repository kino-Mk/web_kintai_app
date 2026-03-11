import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { Employee, COLLECTIONS } from '../types';
import { calculateRemainingPaidLeave, sendGasNotification } from '../utils';
import { Calendar, Clock, MessageSquare, ChevronLeft, Send, History } from 'lucide-react';
import { useModal } from '../contexts/ModalContext';

interface Props {
    employee: Employee;
    onBack: () => void;
    onComplete?: () => void;
}

export const ApplicationScreen: React.FC<Props> = ({ employee, onBack, onComplete }) => {
    const [type, setType] = useState('有給');
    const [date, setDate] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [reason, setReason] = useState('');
    const [remainingLeave, setRemainingLeave] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const { showAlert, showConfirm } = useModal();

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    useEffect(() => {
        fetchPaidLeave(employee.id);
    }, [employee.id]);

    if (!isMobile) {
        return (
            <div className="bg-white p-12 rounded-3xl shadow-sm border border-gray-100 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="text-3xl">💻</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4">PCからの申請はできません</h2>
                <p className="text-gray-500 mb-8 leading-relaxed">
                    勤怠申請や休暇の登録は、スマートフォンからアクセスした時のみ利用可能な機能です。<br />
                    お手数ですが、スマートフォンから再度アクセスしてください。
                </p>
                <button
                    onClick={onBack}
                    className="bg-primary text-white px-8 py-3 rounded-xl font-bold shadow-md hover:bg-primary-dark transition-colors inline-flex items-center gap-2"
                >
                    <ChevronLeft size={20} />
                    戻る
                </button>
            </div>
        );
    }

    const fetchPaidLeave = async (empId: string) => {
        try {
            const q = query(collection(db, COLLECTIONS.LEAVE_GRANTS), where('empId', '==', empId));
            const grantSnap = await getDocs(q);
            const grants = grantSnap.docs.map(doc => doc.data());

            const qApp = query(
                collection(db, COLLECTIONS.APPLICATIONS),
                where('empId', '==', empId),
                where('status', 'in', ['approved', 'completed'])
            );
            const appSnap = await getDocs(qApp);

            let usedDays = 0;
            appSnap.docs.forEach(doc => {
                const data = doc.data();
                if (data.type === '有給') usedDays += 1;
                else if (data.type?.startsWith('半休')) usedDays += 0.5;
            });

            const result = calculateRemainingPaidLeave(grants, usedDays, 0);
            setRemainingLeave(result.summary.remaining);
        } catch (error) {
            console.error('Fetch leave error:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!date) {
            await showAlert('日付を選択してください。');
            return;
        }

        if (['遅刻', '早退', '残業'].includes(type)) {
            if (type === '遅刻' && !startTime) {
                await showAlert('出勤時刻を入力してください。');
                return;
            }
            if ((type === '早退' || type === '残業') && !endTime) {
                await showAlert('退勤時刻を入力してください。');
                return;
            }
        }

        if (!(await showConfirm(`${type}の申請を送信しますか？`))) return;

        setLoading(true);
        try {
            const applicationData: any = {
                empId: employee.id,
                empName: employee.name,
                type,
                date,
                reason,
                status: 'pending',
                createdAt: serverTimestamp(),
            };

            if (['遅刻', '早退', '残業'].includes(type)) {
                applicationData.startTime = startTime;
                applicationData.endTime = endTime;
            }

            await addDoc(collection(db, COLLECTIONS.APPLICATIONS), applicationData);

            // GAS通知（バックグラウンド）
            sendGasNotification({
                action: 'notifyApplication',
                empId: employee.id,
                empName: employee.name,
                type: type,
                date: date,
                reason: reason
            });

            await showAlert('申請しました。');
            if (onComplete) onComplete();
            else onBack();
        } catch (error: any) {
            console.error('Application submit error:', error);
            await showAlert('申請に失敗しました。しばらくしてからお試しください。');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-8">
                <button onClick={onBack} className="p-2 hover:bg-gray-50 rounded-full transition-colors">
                    <ChevronLeft size={24} className="text-gray-400" />
                </button>
                <div className="text-right">
                    <h2 className="text-2xl font-bold text-gray-800">各種申請</h2>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Application Form</p>
                </div>
            </div>

            <div className="mb-8 p-6 bg-primary-light/30 rounded-3xl flex items-center justify-between border border-primary-light">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-primary shadow-sm">
                        <History size={24} />
                    </div>
                    <div>
                        <span className="text-xs text-primary font-bold block uppercase tracking-wider">Current Balance</span>
                        <span className="text-xl font-bold text-gray-800">有給残日数</span>
                    </div>
                </div>
                <div className="text-4xl font-bold text-primary">
                    {remainingLeave !== null ? `${remainingLeave}日` : '--'}
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 px-1">
                            <Calendar size={14} className="text-primary" /> 申請種別
                        </label>
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value)}
                            className="w-full p-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-primary font-bold text-gray-700"
                        >
                            <option>有給</option>
                            <option>半休(午前)</option>
                            <option>半休(午後)</option>
                            <option>欠勤</option>
                            <option>遅刻</option>
                            <option>早退</option>
                            <option>残業</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 px-1">
                            <Calendar size={14} className="text-primary" /> 対象日
                        </label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full p-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-primary font-bold text-gray-700"
                        />
                    </div>
                </div>

                {['遅刻', '早退', '残業'].includes(type) && (
                    <div className="grid grid-cols-2 gap-6 animate-in slide-in-from-top-2 duration-300">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 px-1">
                                <Clock size={14} className="text-primary" /> 開始時刻
                            </label>
                            <input
                                type="time"
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                                className="w-full p-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-primary font-bold text-gray-700"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 px-1">
                                <Clock size={14} className="text-primary" /> 終了時刻
                            </label>
                            <input
                                type="time"
                                value={endTime}
                                onChange={(e) => setEndTime(e.target.value)}
                                className="w-full p-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-primary font-bold text-gray-700"
                            />
                        </div>
                    </div>
                )}

                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 px-1">
                        <MessageSquare size={14} className="text-primary" /> 理由・詳細
                    </label>
                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="理由を入力してください（任意）"
                        className="w-full p-4 rounded-3xl bg-gray-50 border-none focus:ring-2 focus:ring-primary min-h-[120px] text-gray-700"
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-5 rounded-3xl bg-primary text-white font-bold text-lg shadow-xl shadow-primary/20 hover:bg-primary-dark transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
                >
                    <Send size={20} />
                    {loading ? '送信中...' : '申請を送信する'}
                </button>
            </form>
        </div>
    );
};
