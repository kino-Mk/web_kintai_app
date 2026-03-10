import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { StampCorrection, COLLECTIONS, ApplicationStatus } from '../types';
import { toDate, formatFullDateTime } from '../utils';
import { Check, X, Clock, Filter, AlertTriangle } from 'lucide-react';
import { useModal } from '../contexts/ModalContext';

export const AdminCorrectionsTab: React.FC = () => {
    const [corrections, setCorrections] = useState<StampCorrection[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'pending' | 'all'>('pending');
    const { showAlert, showConfirm } = useModal();

    useEffect(() => {
        let q = query(collection(db, COLLECTIONS.STAMP_CORRECTIONS), orderBy('createdAt', 'desc'));
        if (filter === 'pending') {
            q = query(collection(db, COLLECTIONS.STAMP_CORRECTIONS), where('status', '==', 'pending'), orderBy('createdAt', 'desc'));
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as StampCorrection[];
            setCorrections(list);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [filter]);

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
            }

            await updateDoc(doc(db, COLLECTIONS.STAMP_CORRECTIONS, corr.id!), {
                status: newStatus,
                updatedAt: serverTimestamp()
            });

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
                                            <button
                                                onClick={() => handleStatusChange(corr, 'approved')}
                                                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-success text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-success-dark transition-all active:scale-95"
                                            >
                                                <Check size={18} /> 承認
                                            </button>
                                            <button
                                                onClick={() => handleStatusChange(corr, 'rejected')}
                                                className="flex-1 md:flex-none flex items-center justify-center gap-2 border border-danger text-danger px-4 py-2 rounded-xl text-sm font-bold hover:bg-danger-bg transition-all active:scale-95"
                                            >
                                                <X size={18} /> 却下
                                            </button>
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
