import React, { useState } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { StampCorrection, COLLECTIONS, ApplicationStatus } from '../types';
import { toDate, formatFullDateTime } from '../utils';
import { Check, X, Clock, Filter, AlertTriangle } from 'lucide-react';
import { useModal } from '../contexts/ModalContext';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from './ui/Button';
import { useAdminCorrections } from '../hooks/useCorrections';

export const AdminCorrectionsTab: React.FC = () => {
    const [filter, setFilter] = useState<'pending' | 'all'>('pending');
    const { showAlert, showConfirm } = useModal();
    const queryClient = useQueryClient();

    const { data: corrections = [], isLoading: loading } = useAdminCorrections(filter);

    const handleStatusChange = async (corr: StampCorrection, newStatus: ApplicationStatus) => {
        const action = newStatus === 'approved' ? '承認' : '却下';

        let confirmMsg = `${corr.empName} さんの修正依頼を${action}しますか？`;
        if (newStatus === 'approved') {
            confirmMsg += '\n承認すると該当の打刻データが自動的に削除されます。';
        }

        if (!(await showConfirm(confirmMsg))) return;

        try {
            if (newStatus === 'approved' && corr.attendanceDocId) {
                await deleteDoc(doc(db, COLLECTIONS.ATTENDANCE, corr.attendanceDocId));
                // invalidate attendance queries as well
                await queryClient.invalidateQueries({ queryKey: ['attendance'] });
            }

            await updateDoc(doc(db, COLLECTIONS.STAMP_CORRECTIONS, corr.id!), {
                status: newStatus,
                updatedAt: serverTimestamp()
            });

            await queryClient.invalidateQueries({ queryKey: ['corrections'] });

            if (newStatus === 'approved') {
                await showAlert('承認しました。該当の打刻データを削除しました。');
            } else {
                await showAlert(`修正依頼を${action}しました。`);
            }
        } catch (error: any) {
            await showAlert(`更新に失敗しました: ${error.message}`);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
                    <Filter size={16} /> フィルター:
                    <button
                        onClick={() => setFilter('pending')}
                        className={`px-3 py-1 rounded-lg transition-colors ${filter === 'pending' ? 'bg-primary text-white shadow-sm' : 'hover:bg-gray-100'}`}
                    >
                        未処理のみ
                    </button>
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-3 py-1 rounded-lg transition-colors ${filter === 'all' ? 'bg-primary text-white shadow-sm' : 'hover:bg-gray-100'}`}
                    >
                        すべて
                    </button>
                </div>
                <span className="text-xs text-gray-400 font-bold">{corrections.length} 件表示中</span>
            </div>

            <div className="space-y-3">
                {loading ? (
                    <div className="animate-pulse space-y-3">
                        {[...Array(3)].map((_, i) => <div key={i} className="bg-white h-32 rounded-3xl border border-gray-100"></div>)}
                    </div>
                ) : corrections.length === 0 ? (
                    <div className="bg-white p-12 rounded-3xl text-center border border-dashed border-gray-200">
                        <p className="text-gray-400">対象の修正依頼はありません。</p>
                    </div>
                ) : (
                    corrections.map((corr) => (
                        <div key={corr.id} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                            <div className="flex flex-col md:flex-row justify-between gap-4">
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-warning-bg rounded-full flex items-center justify-center text-warning">
                                            <AlertTriangle size={20} />
                                        </div>
                                        <div>
                                            <span className="font-bold text-gray-800 block leading-tight">{corr.empName}</span>
                                            <span className="text-[10px] text-gray-400 font-mono">{formatFullDateTime(toDate(corr.createdAt))} 依頼</span>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded-full flex items-center gap-1">
                                            <Clock size={12} /> 元の打刻: {formatFullDateTime(toDate(corr.attendanceTime))} ({corr.attendanceType === 'in' ? '出勤' : '退勤'})
                                        </span>
                                    </div>

                                    <div className="p-3 bg-gray-50/50 rounded-xl text-sm text-gray-600 border border-gray-50">
                                        <p className="font-medium whitespace-pre-wrap">{corr.reason}</p>
                                    </div>
                                </div>

                                <div className="flex md:flex-col justify-end gap-2 shrink-0">
                                    {corr.status === 'pending' ? (
                                        <>
                                            <Button
                                                onClick={() => handleStatusChange(corr, 'approved')}
                                                variant="primary"
                                                leftIcon={<Check size={18} />}
                                                className="flex-1 md:flex-none bg-success hover:bg-success-dark text-white shadow-sm"
                                            >
                                                承認
                                            </Button>
                                            <Button
                                                onClick={() => handleStatusChange(corr, 'rejected')}
                                                variant="outline"
                                                leftIcon={<X size={18} />}
                                                className="flex-1 md:flex-none border-danger text-danger hover:bg-danger-bg hover:border-danger hover:text-danger"
                                            >
                                                却下
                                            </Button>
                                        </>
                                    ) : (
                                        <span className={`px-4 py-2 rounded-xl text-sm font-bold text-center ${corr.status === 'approved' ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger'
                                            }`}>
                                            {corr.status === 'approved' ? '承認済み' : '却下済み'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
