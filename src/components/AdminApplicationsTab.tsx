import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, doc, updateDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { Application, COLLECTIONS, ApplicationStatus } from '../types';
import { toDate, formatFullDateTime } from '../utils';
import { Check, X, Clock, User, Filter } from 'lucide-react';
import { useModal } from '../contexts/ModalContext';
import { useAdminApplications } from '../hooks/useApplications';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from './ui/Button';

export const AdminApplicationsTab: React.FC = () => {
    const [filter, setFilter] = useState<'pending' | 'all'>('pending');
    const { showAlert, showConfirm } = useModal();
    const queryClient = useQueryClient();

    const { data: apps = [], isLoading: loading } = useAdminApplications(filter);

    const handleStatusChange = async (app: Application, newStatus: ApplicationStatus) => {
        const action = newStatus === 'approved' ? '承認' : '却下';
        let confirmed;
        if (newStatus === 'approved' && ['遅刻', '早退', '残業'].includes(app.type)) {
            confirmed = await showConfirm(`${app.empName} さんの申請を承認し「処理済み」にしますか？\n（承認録として打刻データが自動生成されます）`);
        } else {
            confirmed = await showConfirm(`${app.empName} さんの申請を${action}しますか？`);
        }

        if (!confirmed) return;

        try {
            // 打刻データの自動生成 (遅刻・早退・残業のみ、かつ承認時)
            if (newStatus === 'approved') {
                let attType: 'in' | 'out' | null = null;
                let targetTimeStr: string | undefined;

                if (app.type === '遅刻') {
                    attType = 'in';
                    targetTimeStr = app.startTime;
                } else if (app.type === '早退' || app.type === '残業') {
                    attType = 'out';
                    targetTimeStr = app.endTime;
                }

                if (attType && targetTimeStr) {
                    const [years, months, days] = app.date.split('-').map(Number);
                    const [hours, minutes] = targetTimeStr.split(':').map(Number);
                    const targetDate = new Date(years, months - 1, days, hours, minutes);

                    await addDoc(collection(db, COLLECTIONS.ATTENDANCE), {
                        empId: app.empId,
                        empName: app.empName,
                        type: attType,
                        timestamp: targetDate, // Firebase SDK automatically converts Date to Timestamp
                        remark: `${app.type}承認による自動登録`,
                        createdAt: serverTimestamp()
                    });
                }
            }

            await updateDoc(doc(db, COLLECTIONS.APPLICATIONS, app.id!), {
                status: newStatus,
                updatedAt: serverTimestamp()
            });

            await queryClient.invalidateQueries({ queryKey: ['applications'] });
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
                                            <Button
                                                onClick={() => handleStatusChange(app, 'approved')}
                                                variant="primary"
                                                leftIcon={<Check size={18} />}
                                                className="flex-1 md:flex-none bg-success hover:bg-success-dark text-white shadow-sm"
                                            >
                                                承認
                                            </Button>
                                            <Button
                                                onClick={() => handleStatusChange(app, 'rejected')}
                                                variant="outline"
                                                leftIcon={<X size={18} />}
                                                className="flex-1 md:flex-none border-danger text-danger hover:bg-danger-bg hover:border-danger hover:text-danger"
                                            >
                                                却下
                                            </Button>
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
