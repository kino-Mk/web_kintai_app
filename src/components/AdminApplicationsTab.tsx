import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Application, COLLECTIONS, ApplicationStatus } from '../types';
import { toDate, formatFullDateTime } from '../utils';
import { Check, X, Clock, User, Filter } from 'lucide-react';
import { useModal } from '../contexts/ModalContext';

export const AdminApplicationsTab: React.FC = () => {
    const [apps, setApps] = useState<Application[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'pending' | 'all'>('pending');
    const { showAlert, showConfirm } = useModal();

    useEffect(() => {
        let q = query(collection(db, COLLECTIONS.APPLICATIONS), orderBy('createdAt', 'desc'));
        if (filter === 'pending') {
            q = query(collection(db, COLLECTIONS.APPLICATIONS), where('status', '==', 'pending'), orderBy('createdAt', 'desc'));
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Application[];
            setApps(list);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [filter]);

    const handleStatusChange = async (app: Application, newStatus: ApplicationStatus) => {
        const action = newStatus === 'approved' ? '承認' : '却下';
        if (!(await showConfirm(`${app.empName} さんの申請を${action}しますか？`))) return;

        try {
            await updateDoc(doc(db, COLLECTIONS.APPLICATIONS, app.id!), {
                status: newStatus,
                updatedAt: serverTimestamp()
            });
            await showAlert(`申請を${action}しました。`);
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
                <span className="text-xs text-gray-400 font-bold">{apps.length} 件表示中</span>
            </div>

            <div className="space-y-3">
                {loading ? (
                    <div className="animate-pulse space-y-3">
                        {[...Array(3)].map((_, i) => <div key={i} className="bg-white h-32 rounded-3xl border border-gray-100"></div>)}
                    </div>
                ) : apps.length === 0 ? (
                    <div className="bg-white p-12 rounded-3xl text-center border border-dashed border-gray-200">
                        <p className="text-gray-400">対象の申請はありません。</p>
                    </div>
                ) : (
                    apps.map((app) => (
                        <div key={app.id} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                            <div className="flex flex-col md:flex-row justify-between gap-4">
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-400">
                                            <User size={20} />
                                        </div>
                                        <div>
                                            <span className="font-bold text-gray-800 block leading-tight">{app.empName}</span>
                                            <span className="text-[10px] text-gray-400 font-mono">{formatFullDateTime(toDate(app.createdAt))} 申請</span>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        <span className="px-3 py-1 bg-primary-light text-primary text-xs font-bold rounded-full">{app.type}</span>
                                        <span className="px-3 py-1 bg-gray-50 text-gray-600 text-xs font-bold rounded-full flex items-center gap-1">
                                            <Clock size={12} /> {app.date} {app.startTime ? `${app.startTime}〜${app.endTime}` : ''}
                                        </span>
                                    </div>

                                    <div className="p-3 bg-gray-50/50 rounded-xl text-sm text-gray-600 border border-gray-50">
                                        <p className="font-medium whitespace-pre-wrap">{app.reason}</p>
                                    </div>
                                </div>

                                <div className="flex md:flex-col justify-end gap-2 shrink-0">
                                    {app.status === 'pending' ? (
                                        <>
                                            <button
                                                onClick={() => handleStatusChange(app, 'approved')}
                                                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-success text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-success-bg hover:text-success transition-all active:scale-95"
                                            >
                                                <Check size={18} /> 承認
                                            </button>
                                            <button
                                                onClick={() => handleStatusChange(app, 'rejected')}
                                                className="flex-1 md:flex-none flex items-center justify-center gap-2 border border-danger text-danger px-4 py-2 rounded-xl text-sm font-bold hover:bg-danger-bg transition-all active:scale-95"
                                            >
                                                <X size={18} /> 却下
                                            </button>
                                        </>
                                    ) : (
                                        <span className={`px-4 py-2 rounded-xl text-sm font-bold text-center ${app.status === 'approved' ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger'
                                            }`}>
                                            {app.status === 'approved' ? '承認済み' : '却下済み'}
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
