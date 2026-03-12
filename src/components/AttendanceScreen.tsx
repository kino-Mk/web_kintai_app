import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Employee, COLLECTIONS, AttendanceType } from '../types';
import { toDate, formatTimeStr, getStartOfToday } from '../utils';
import { Clock, Play, Square, MessageSquare, ArrowLeft, LogOut, AlertOctagon } from 'lucide-react';
import { useModal } from '../contexts/ModalContext';
import { useAttendanceByEmployee } from '../hooks/useAttendance';
import { useEmployee } from '../hooks/useEmployees';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from './ui/Button';

interface Props {
    employee?: Employee; // リロード時は undefined になるためオプションにする
    onBack: () => void;
    onComplete?: () => void;
    onGoApplication?: () => void;
}

export const AttendanceScreen: React.FC<Props> = ({ employee: propEmployee, onBack, onComplete, onGoApplication }) => {
    const { empId } = useParams<{ empId: string }>();
    const [now, setNow] = useState(new Date());
    const [remark, setRemark] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { showAlert, showConfirm } = useModal();
    const queryClient = useQueryClient();

    // 従業員情報の取得（プロップがない場合）
    const { data: fetchedEmployee, isLoading: isEmployeeLoading, isError: isEmployeeError } = useEmployee(empId);
    const employee = propEmployee || fetchedEmployee;

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    const monthStart = useMemo(() => new Date(now.getFullYear(), now.getMonth(), 1), [now.getFullYear(), now.getMonth()]);
    const { data: monthRecords = [], isLoading: isRecordsLoading, isError: isRecordsError } = useAttendanceByEmployee(employee?.id, monthStart);
    
    // 今日の記録だけを抽出
    const todayStart = getStartOfToday().getTime();
    const records = monthRecords.filter(r => {
        const d = toDate(r.timestamp);
        return d && d.getTime() >= todayStart;
    });

    // 時計の更新
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const handleStamp = async (type: AttendanceType) => {
        if (!employee) return;
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
                remark,
                timestamp: serverTimestamp(),
                createdAt: serverTimestamp()
            });

            // キャッシュを無効化して再取得をトリガー
            await queryClient.invalidateQueries({ queryKey: ['attendance'] });

            setRemark('');
            await showAlert(`${typeLabel} を打刻しました。`);
            if (onComplete) onComplete();
        } catch (error: any) {
            console.error("Stamp error:", error);
            await showAlert('打刻に失敗しました。しばらくしてからお試しください。');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isEmployeeLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
                <div className="w-12 h-12 border-4 border-gray-100 border-t-primary rounded-full animate-spin"></div>
                <p className="text-gray-400 animate-pulse">従業員情報を読み込み中...</p>
            </div>
        );
    }

    if (isEmployeeError || !employee) {
        return (
            <div className="bg-white p-12 rounded-3xl shadow-sm border border-gray-100 text-center space-y-6">
                <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
                    <AlertOctagon size={40} />
                </div>
                <h2 className="text-2xl font-bold text-gray-800">従業員情報が見つかりません</h2>
                <p className="text-gray-500 max-w-sm mx-auto">URLが正しくないか、従業員データが削除された可能性があります。</p>
                <Button onClick={onBack} variant="outline" className="w-full">
                    ホームへ戻る
                </Button>
            </div>
        );
    }

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
                        <Button
                            onClick={onGoApplication}
                            className="w-full h-14 text-lg"
                        >
                            各種申請メニューへ
                        </Button>
                    </div>
                ) : (
                    <>
                        <div className="flex flex-col md:flex-row gap-4 mb-8">
                            <Button
                                onClick={() => handleStamp('in')}
                                isLoading={isSubmitting}
                                leftIcon={<Play size={24} fill="currentColor" />}
                                className="flex-1 h-16 text-xl"
                            >
                                出勤
                            </Button>
                            <Button
                                onClick={() => handleStamp('out')}
                                isLoading={isSubmitting}
                                variant="outline"
                                leftIcon={<Square size={24} fill="currentColor" />}
                                className="flex-1 h-16 text-xl border-primary text-primary hover:bg-primary/5"
                            >
                                退勤
                            </Button>
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
                {isRecordsLoading ? (
                    <div className="text-center py-8 text-gray-400 flex flex-col items-center gap-2">
                        <div className="w-6 h-6 border-2 border-gray-100 border-t-primary rounded-full animate-spin"></div>
                        <span className="animate-pulse">読み込み中...</span>
                    </div>
                ) : isRecordsError ? (
                    <div className="text-center py-8 text-red-400">履歴の取得に失敗しました。</div>
                ) : records.length === 0 ? (
                    <p className="text-center py-8 text-gray-400">本日の記録はまだありません。</p>
                ) : (
                    <div className="space-y-3">
                        {records.map((rec) => (
                            <div key={rec.id} className="flex items-center justify-between p-4 rounded-xl bg-gray-50">
                                <div className="flex items-center gap-4">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${rec.type === 'in' ? 'bg-success-bg text-success' : 'bg-primary-light text-primary'}`}>
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
