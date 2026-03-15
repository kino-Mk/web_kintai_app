import React from 'react';
import { Employee, ApplicationStatus, Application, StampCorrection } from '../../types';
import { toDate, formatFullDateTime } from '../../utils';
import { useModal } from '../../contexts/ModalContext';
import { Mail, MessageSquare, Clock, X, Check, RotateCcw } from 'lucide-react';
import { useApplicationsByEmployee, useUpdateApplicationStatus } from '../../hooks/useApplications';
import { useCorrectionsByEmployee, useUpdateCorrectionStatus } from '../../hooks/useCorrections';
import { Button } from '../ui/Button';

interface Props {
    employee: Employee;
}

export const TabDetailApplications: React.FC<Props> = ({ employee }) => {
    const { showAlert, showConfirm } = useModal();

    const { data: allApps = [], isLoading: loadingApps } = useApplicationsByEmployee(employee.id);
    const { data: allCorrections = [], isLoading: loadingCorrections } = useCorrectionsByEmployee(employee.id);

    const updateAppMutation = useUpdateApplicationStatus();
    const updateCorrMutation = useUpdateCorrectionStatus();

    const isLoading = loadingApps || loadingCorrections;

    // pending or approved (one-step approved but not completed/canceled)
    const pendingApps = allApps.filter(a => a.status === 'pending' || a.status === 'approved');
    const historyApps = allApps.filter(a => a.status === 'completed' || a.status === 'rejected' || a.status === 'canceled');

    const pendingCorrections = allCorrections.filter(c => c.status === 'pending');
    const historyCorrections = allCorrections.filter(c => c.status === 'completed' || c.status === 'rejected' || c.status === 'canceled');

    const handleUpdateAppStatus = async (app: Application, nextStatus: ApplicationStatus, label: string) => {
        if (!(await showConfirm(`${app.type}申請を「${label}」にしますか？`))) return;

        updateAppMutation.mutate({ application: app, newStatus: nextStatus }, {
            onSuccess: () => showAlert(`${label}しました。`),
            onError: (err: any) => showAlert(`エラー: ${err.message}`)
        });
    };

    const handleUpdateCorrStatus = async (corr: StampCorrection, nextStatus: ApplicationStatus, label: string) => {
        let confirmMsg = `打刻修正申請を「${label}」にしますか？`;
        if (nextStatus === 'approved') {
            confirmMsg += '\n（承認すると元の打刻データが上書きされます）';
        }

        if (!(await showConfirm(confirmMsg))) return;

        updateCorrMutation.mutate({ correction: corr, newStatus: nextStatus }, {
            onSuccess: () => showAlert(`${label}しました。`),
            onError: (err: any) => showAlert(`エラー: ${err.message}`)
        });
    };

    const statusBadge = (status: ApplicationStatus) => {
        switch (status) {
            case 'pending': return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold">未処理</span>;
            case 'approved': return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">一次承認済</span>;
            case 'completed': return <span className="px-2 py-1 bg-success-bg text-success rounded-full text-xs font-bold">処理完了</span>;
            case 'rejected': return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">却下</span>;
            case 'canceled': return <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-bold">取消</span>;
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
                    <div className="py-8 text-center text-gray-400 animate-pulse">読み込み中...</div>
                ) : (pendingApps.length === 0 && pendingCorrections.length === 0) ? (
                    <div className="py-8 text-center text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                        未処理の申請はありません。
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* 勤怠申請 */}
                        {pendingApps.map(app => (
                            <div key={app.id} className="p-4 rounded-xl bg-gray-50 border-l-4 border-l-primary shadow-sm flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
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
                                    <Button
                                        onClick={() => handleUpdateAppStatus(app, 'rejected', '却下')}
                                        variant="outline"
                                        size="sm"
                                        leftIcon={<X size={16} />}
                                        className="flex-1 md:flex-none border-danger text-danger hover:bg-danger-bg hover:border-danger hover:text-danger"
                                    >
                                        却下
                                    </Button>
                                    <Button
                                        onClick={() => handleUpdateAppStatus(app, app.status === 'pending' ? 'approved' : 'completed', app.status === 'pending' ? '一次承認' : '最終承認(完了)')}
                                        variant="primary"
                                        size="sm"
                                        leftIcon={<Check size={16} />}
                                        className="flex-1 md:flex-none"
                                    >
                                        {app.status === 'pending' ? '一次承認' : '最終承認(完了)'}
                                    </Button>
                                </div>
                            </div>
                        ))}

                        {/* 打刻修正申請 */}
                        {pendingCorrections.map(corr => (
                            <div key={corr.id} className="p-4 rounded-xl bg-orange-50 border-l-4 border-l-orange-400 shadow-sm flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                                <div className="space-y-1 w-full md:w-auto">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="font-bold text-orange-600 flex items-center gap-1"><Clock size={16} /> 打刻修正</span>
                                        {statusBadge(corr.status)}
                                    </div>
                                    <div className="text-sm">
                                        <span className="font-bold text-gray-700 mr-2">修正後時間:</span>
                                        {formatFullDateTime(toDate(corr.attendanceTime))} {corr.attendanceType === 'in' ? '出勤' : '退勤'}
                                    </div>
                                    <div className="text-sm flex items-start gap-1">
                                        <MessageSquare size={14} className="text-gray-400 mt-1" />
                                        <span className="text-gray-600">{corr.reason}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2 w-full md:w-auto">
                                    <Button
                                        onClick={() => handleUpdateCorrStatus(corr, 'rejected', '却下')}
                                        variant="outline"
                                        size="sm"
                                        leftIcon={<X size={16} />}
                                        className="flex-1 md:flex-none border-danger text-danger hover:bg-danger-bg hover:border-danger hover:text-danger"
                                    >
                                        却下
                                    </Button>
                                    <Button
                                        onClick={() => handleUpdateCorrStatus(corr, 'approved', '承認')}
                                        variant="primary"
                                        size="sm"
                                        leftIcon={<Check size={16} />}
                                        className="flex-1 md:flex-none bg-orange-500 hover:bg-orange-600 border-none"
                                    >
                                        承認して反映
                                    </Button>
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
                    <div className="py-8 text-center text-gray-400 animate-pulse">読み込み中...</div>
                ) : (historyApps.length === 0 && historyCorrections.length === 0) ? (
                    <div className="py-8 text-center text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                        処理済みの履歴はありません。
                    </div>
                ) : (
                    <div className="space-y-3">
                        {[...historyApps, ...historyCorrections]
                            .sort((a, b) => {
                                const timeA = toDate(a.createdAt).getTime();
                                const timeB = toDate(b.createdAt).getTime();
                                return timeB - timeA;
                            })
                            .map((item: any) => {
                                const isCorrection = 'attendanceTime' in item;
                                const dateStr = formatFullDateTime(toDate(item.createdAt));

                                return (
                                    <div key={item.id} className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 rounded-2xl bg-gray-50 border border-gray-100 gap-4">
                                        <div className="flex flex-col md:flex-row md:items-center gap-3">
                                            {statusBadge(item.status)}
                                            <span className="text-[10px] text-gray-400 font-mono italic">{dateStr}</span>
                                        </div>
                                        <div className="flex-1">
                                            <span className={`font-bold text-sm mr-2 ${isCorrection ? 'text-orange-600' : 'text-primary'}`}>
                                                {isCorrection ? '打刻修正' : item.type}
                                            </span>
                                            <span className="text-sm text-gray-600">
                                                {isCorrection ? formatFullDateTime(toDate(item.attendanceTime)) : item.date}
                                            </span>
                                        </div>
                                        <div className="text-xs text-gray-500 max-w-xs truncate">
                                            {item.reason}
                                        </div>
                                        
                                        {!isCorrection && (item.status === 'completed' || item.status === 'approved') && (
                                            <Button
                                                onClick={() => handleUpdateAppStatus(item, 'canceled', '承認取消')}
                                                variant="ghost"
                                                size="sm"
                                                leftIcon={<RotateCcw size={14} />}
                                                className="text-gray-400 hover:text-danger whitespace-nowrap"
                                                title="承認を取り消す（ステータスをキャンセルに戻す）"
                                            >
                                                取消
                                            </Button>
                                        )}
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
