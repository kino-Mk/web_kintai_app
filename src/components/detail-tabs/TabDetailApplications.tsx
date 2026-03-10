import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, where, orderBy, getDocs, doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { Employee, COLLECTIONS, Application, ApplicationStatus, StampCorrection } from '../../types';
import { formatDateStr, toDate } from '../../utils';
import { useModal } from '../../contexts/ModalContext';
import { Mail, MessageSquare, Clock } from 'lucide-react';

interface Props {
    employee: Employee;
}

export const TabDetailApplications: React.FC<Props> = ({ employee }) => {
    const [pendingApps, setPendingApps] = useState<Application[]>([]);
    const [historyApps, setHistoryApps] = useState<Application[]>([]);
    const [pendingCorrections, setPendingCorrections] = useState<StampCorrection[]>([]);
    const [historyCorrections, setHistoryCorrections] = useState<StampCorrection[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const { showAlert, showConfirm } = useModal();

    const fetchApplications = async () => {
        if (!employee.id) return;
        setIsLoading(true);
        try {
            // General Applications
            const qApps = query(
                collection(db, COLLECTIONS.APPLICATIONS),
                where('empId', '==', employee.id),
                orderBy('createdAt', 'desc')
            );
            const snapApps = await getDocs(qApps);
            const allApps = snapApps.docs.map(d => ({ id: d.id, ...d.data() })) as Application[];

            setPendingApps(allApps.filter(a => a.status === 'pending' || a.status === 'approved'));
            setHistoryApps(allApps.filter(a => a.status === 'completed' || a.status === 'rejected'));

            // Stamp Corrections
            const qCorrections = query(
                collection(db, COLLECTIONS.STAMP_CORRECTIONS),
                where('empId', '==', employee.id),
                orderBy('createdAt', 'desc')
            );
            const snapCorrections = await getDocs(qCorrections);
            const allCorrections = snapCorrections.docs.map(d => ({ id: d.id, ...d.data() })) as StampCorrection[];

            setPendingCorrections(allCorrections.filter(c => c.status === 'pending'));
            setHistoryCorrections(allCorrections.filter(c => c.status === 'completed' || c.status === 'rejected'));
        } catch (error: any) {
            console.error(error);
            await showAlert('申請データの取得に失敗しました。');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchApplications();
    }, [employee.id]);

    const handleApproveApp = async (appId: string, currentStatus: string) => {
        const nextStatus = currentStatus === 'pending' ? 'approved' : 'completed';
        const actionName = nextStatus === 'approved' ? '一次承認' : '最終承認（完了）';

        if (!(await showConfirm(`この申請を「${actionName}」にしますか？`))) return;

        try {
            await updateDoc(doc(db, COLLECTIONS.APPLICATIONS, appId), {
                status: nextStatus,
                updatedAt: serverTimestamp()
            });
            await showAlert(`${actionName}しました。`);
            fetchApplications();
        } catch (error: any) {
            await showAlert(`エラー: ${error.message}`);
        }
    };

    const handleRejectApp = async (appId: string) => {
        if (!(await showConfirm('この申請を【却下】しますか？'))) return;

        try {
            await updateDoc(doc(db, COLLECTIONS.APPLICATIONS, appId), {
                status: 'rejected',
                updatedAt: serverTimestamp()
            });
            await showAlert('却下しました。');
            fetchApplications();
        } catch (error: any) {
            await showAlert(`エラー: ${error.message}`);
        }
    };

    const handleApproveCorrection = async (correction: StampCorrection) => {
        if (!(await showConfirm('この打刻修正申請を【承認・反映】しますか？\n（元の打刻データが上書きされます）'))) return;

        try {
            // Apply correction to attendance record
            const attRef = doc(db, COLLECTIONS.ATTENDANCE, correction.attendanceDocId);
            const attDoc = await getDoc(attRef);

            if (attDoc.exists()) {
                await updateDoc(attRef, {
                    timestamp: toDate(correction.attendanceTime),
                    isCorrected: true,
                    remark: correction.reason
                });
            }

            // Update correction status
            await updateDoc(doc(db, COLLECTIONS.STAMP_CORRECTIONS, correction.id!), {
                status: 'completed',
                updatedAt: serverTimestamp()
            });

            await showAlert('修正を反映し、申請を完了にしました。');
            fetchApplications();
        } catch (error: any) {
            await showAlert(`エラー: ${error.message}`);
        }
    };

    const handleRejectCorrection = async (correctionId: string) => {
        if (!(await showConfirm('この打刻修正を【却下】しますか？'))) return;

        try {
            await updateDoc(doc(db, COLLECTIONS.STAMP_CORRECTIONS, correctionId), {
                status: 'rejected',
                updatedAt: serverTimestamp()
            });
            await showAlert('却下しました。');
            fetchApplications();
        } catch (error: any) {
            await showAlert(`エラー: ${error.message}`);
        }
    };

    const statusBadge = (status: ApplicationStatus) => {
        switch (status) {
            case 'pending': return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold">未処理</span>;
            case 'approved': return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">一次承認済</span>;
            case 'completed': return <span className="px-2 py-1 bg-success-bg text-success rounded-full text-xs font-bold">処理完了</span>;
            case 'rejected': return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">却下</span>;
            default: return null;
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <Mail className="text-primary" size={20} />
                    未処理の申請
                </h3>

                {isLoading ? (
                    <div className="py-8 text-center text-gray-400">読み込み中...</div>
                ) : (pendingApps.length === 0 && pendingCorrections.length === 0) ? (
                    <div className="py-8 text-center text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                        未処理の申請はありません。
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* 勤怠申請 */}
                        {pendingApps.map(app => (
                            <div key={app.id} className="p-4 rounded-xl bg-gray-50 border left-4 border-l-4 border-l-primary shadow-sm flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                                <div className="space-y-1 w-full md:w-auto">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="font-bold text-primary">{app.type}</span>
                                        {statusBadge(app.status)}
                                    </div>
                                    <div className="text-sm">
                                        <span className="font-bold text-gray-700 mr-2">対象日:</span>
                                        {app.date}
                                        {app.startTime && app.endTime && ` (${app.startTime}〜${app.endTime})`}
                                    </div>
                                    <div className="text-sm flex items-start gap-1">
                                        <MessageSquare size={14} className="text-gray-400 mt-1" />
                                        <span className="text-gray-600">{app.reason}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2 w-full md:w-auto">
                                    <button
                                        onClick={() => handleRejectApp(app.id!)}
                                        className="flex-1 md:flex-none px-4 py-2 text-sm font-bold text-red-500 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                                    >
                                        却下
                                    </button>
                                    <button
                                        onClick={() => handleApproveApp(app.id!, app.status)}
                                        className="flex-1 md:flex-none px-4 py-2 text-sm font-bold text-white bg-primary hover:bg-primary-dark rounded-lg shadow-md transition-colors"
                                    >
                                        {app.status === 'pending' ? '一次承認' : '最終承認(完了)'}
                                    </button>
                                </div>
                            </div>
                        ))}

                        {/* 打刻修正申請 */}
                        {pendingCorrections.map(corr => (
                            <div key={corr.id} className="p-4 rounded-xl bg-orange-50 border left-4 border-l-4 border-l-orange-400 shadow-sm flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                                <div className="space-y-1 w-full md:w-auto">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="font-bold text-orange-600 flex items-center gap-1"><Clock size={16} /> 打刻修正</span>
                                        {statusBadge(corr.status)}
                                    </div>
                                    <div className="text-sm">
                                        <span className="font-bold text-gray-700 mr-2">修正後時間:</span>
                                        {formatDateStr(toDate(corr.attendanceTime))} {corr.attendanceType === 'in' ? '出勤' : '退勤'}
                                    </div>
                                    <div className="text-sm flex items-start gap-1">
                                        <MessageSquare size={14} className="text-gray-400 mt-1" />
                                        <span className="text-gray-600">{corr.reason}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2 w-full md:w-auto">
                                    <button
                                        onClick={() => handleRejectCorrection(corr.id!)}
                                        className="flex-1 md:flex-none px-4 py-2 text-sm font-bold text-red-500 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                                    >
                                        却下
                                    </button>
                                    <button
                                        onClick={() => handleApproveCorrection(corr)}
                                        className="flex-1 md:flex-none px-4 py-2 text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-lg shadow-md transition-colors"
                                    >
                                        承認して反映
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <span>🗄️</span> 過去の申請履歴
                </h3>

                {isLoading ? (
                    <div className="py-8 text-center text-gray-400">読み込み中...</div>
                ) : (historyApps.length === 0 && historyCorrections.length === 0) ? (
                    <div className="py-8 text-center text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                        処理済みの履歴はありません。
                    </div>
                ) : (
                    <div className="space-y-3">
                        {/* 履歴のリスト（簡易表示） */}
                        {[...historyApps, ...historyCorrections]
                            .sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis())
                            .map((item: any) => {
                                const isCorrection = 'attendanceTime' in item;
                                const dateStr = formatDateStr(toDate(item.createdAt));

                                return (
                                    <div key={item.id} className="flex flex-col md:flex-row justify-between items-start md:items-center p-3 rounded-xl bg-gray-50 border border-gray-100 gap-3">
                                        <div className="flex items-center gap-3">
                                            {statusBadge(item.status)}
                                            <span className="text-xs text-gray-400 font-mono">{dateStr}</span>
                                        </div>
                                        <div className="flex-1">
                                            <span className={`font-bold text-sm mr-2 ${isCorrection ? 'text-orange-600' : 'text-primary'}`}>
                                                {isCorrection ? '打刻修正' : item.type}
                                            </span>
                                            <span className="text-sm text-gray-600">
                                                {isCorrection ? formatDateStr(toDate(item.attendanceTime)) : item.date}
                                            </span>
                                        </div>
                                        <div className="text-xs text-gray-500 truncate max-w-[200px]">
                                            {item.reason}
                                        </div>
                                    </div>
                                );
                            })
                        }
                    </div>
                )}
            </div>
        </div>
    );
};
