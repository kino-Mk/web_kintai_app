import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { COLLECTIONS, AttendanceRecord } from '../types';
import { AlertCircle, FileText, Clock, ChevronRight, User } from 'lucide-react';
import { getStartOfToday } from '../utils';
import { subDays, format, startOfDay, endOfDay } from 'date-fns';
import { useEmployees } from '../hooks/useEmployees';
import { usePendingApplications } from '../hooks/useApplications';
import { Card } from './ui/Card';

interface DashboardAlert {
    type: 'missing-checkout' | 'pending-application';
    title: string;
    description: string;
    date: string;
    empName: string;
    empId: string;
}

export const AdminDashboard: React.FC = () => {
    const { data: employees = [], isLoading: loadingEmps } = useEmployees();
    const { data: pendingApps = [], isLoading: loadingApps } = usePendingApplications();
    const [missingAlerts, setMissingAlerts] = useState<DashboardAlert[]>([]);
    const [loadingMissing, setLoadingMissing] = useState(true);

    const appAlerts: DashboardAlert[] = pendingApps.map(app => ({
        type: 'pending-application',
        title: '未処理の申請',
        description: `${app.type}申請があります (${app.reason || '理由なし'})`,
        date: app.date,
        empName: app.empName,
        empId: app.empId
    }));

    useEffect(() => {
        if (loadingEmps || employees.length === 0) {
            setLoadingMissing(false);
            return;
        }

        const checkMissingCheckouts = async () => {
            setLoadingMissing(true);
            const newMissingAlerts: DashboardAlert[] = [];
            
            try {
                for (let i = 1; i <= 7; i++) {
                    const day = subDays(getStartOfToday(), i);
                    const dayStart = startOfDay(day);
                    const dayEnd = endOfDay(day);

                    const qAtt = query(
                        collection(db, COLLECTIONS.ATTENDANCE),
                        where('timestamp', '>=', dayStart),
                        where('timestamp', '<=', dayEnd),
                        orderBy('timestamp', 'asc')
                    );

                    const attSnap = await getDocs(qAtt);
                    const dayRecords = attSnap.docs.map(doc => doc.data() as AttendanceRecord);

                    employees.forEach(emp => {
                        const empRecs = dayRecords.filter(r => r.empId === emp.id);
                        if (empRecs.length > 0) {
                            const lastType = empRecs[empRecs.length - 1].type;
                            if (lastType === 'in') {
                                newMissingAlerts.push({
                                    type: 'missing-checkout',
                                    title: '打刻漏れ(退勤)',
                                    description: `${format(day, 'MM/dd')} の退勤打刻がありません`,
                                    date: format(day, 'yyyy-MM-dd'),
                                    empName: emp.name,
                                    empId: emp.id
                                });
                            }
                        }
                    });
                }
                setMissingAlerts(newMissingAlerts);
            } catch (error) {
                console.error("Error fetching missing checkouts:", error);
            } finally {
                setLoadingMissing(false);
            }
        };

        checkMissingCheckouts();
    }, [employees, loadingEmps]);

    const alerts = [...appAlerts, ...missingAlerts];
    const isLoading = loadingEmps || loadingApps || loadingMissing;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h2 className="text-3xl font-bold text-gray-800 mb-2 tracking-tight">ダッシュボード</h2>
                <p className="text-gray-500">現在の運用状況と通知を確認します。</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="rounded-[2.5rem] border-gray-100 flex items-center justify-between p-8">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500">
                            <FileText size={28} />
                        </div>
                        <div>
                            <span className="text-xs text-amber-500 font-bold uppercase tracking-widest block mb-1">Applications</span>
                            <span className="text-2xl font-bold text-gray-800">未処理の申請</span>
                        </div>
                    </div>
                    <div className="text-5xl font-black text-amber-500">
                        {appAlerts.length}
                    </div>
                </Card>

                <Card className="rounded-[2.5rem] border-gray-100 flex items-center justify-between p-8">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center text-red-500">
                            <AlertCircle size={28} />
                        </div>
                        <div>
                            <span className="text-xs text-red-500 font-bold uppercase tracking-widest block mb-1">Missing Stamps</span>
                            <span className="text-2xl font-bold text-gray-800">打刻漏れ（7日分）</span>
                        </div>
                    </div>
                    <div className="text-5xl font-black text-red-500">
                        {missingAlerts.length}
                    </div>
                </Card>
            </div>

            <Card className="rounded-[2.5rem] border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
                    <h3 className="font-bold text-gray-700 flex items-center gap-2">
                        <Clock size={18} className="text-primary" />
                        優先対応アラート
                    </h3>
                    <span className="text-xs text-gray-400 font-mono tracking-tighter">TOTAL: {alerts.length}</span>
                </div>

                <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto custom-scrollbar">
                    {isLoading ? (
                        <div className="p-12 text-center text-gray-400 animate-pulse">データを読み込み中...</div>
                    ) : alerts.length === 0 ? (
                        <div className="p-12 text-center text-gray-400">現在アラートはありません。</div>
                    ) : (
                        alerts.map((alert, i) => (
                            <div key={i} className="p-6 hover:bg-gray-50/80 transition-all group flex items-start gap-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${alert.type === 'missing-checkout' ? 'bg-red-100 text-red-500' : 'bg-amber-100 text-amber-500'}`}>
                                    {alert.type === 'missing-checkout' ? <AlertCircle size={20} /> : <FileText size={20} />}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className={`text-xs font-bold uppercase tracking-wider ${alert.type === 'missing-checkout' ? 'text-red-400' : 'text-amber-400'}`}>
                                            {alert.title}
                                        </span>
                                        <span className="text-xs text-gray-400 font-mono">{alert.date}</span>
                                    </div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                                            <User size={12} />
                                        </div>
                                        <span className="font-bold text-gray-700">{alert.empName}</span>
                                    </div>
                                    <p className="text-sm text-gray-500">{alert.description}</p>
                                </div>
                                <ChevronRight className="text-gray-200 group-hover:text-gray-400 transition-colors self-center" size={20} />
                            </div>
                        ))
                    )}
                </div>
            </Card>
        </div>
    );
};
