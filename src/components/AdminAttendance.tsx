import React, { useState } from 'react';
import { AdminApplicationsTab } from './AdminApplicationsTab';
import { AdminCorrectionsTab } from './AdminCorrectionsTab';
import { AdminDailyTab } from './AdminDailyTab';
import { AdminMonthlyTab } from './AdminMonthlyTab';
import { ClipboardList, CheckSquare, Calendar, BarChart3 } from 'lucide-react';
import { Button } from './ui/Button';

export const AdminAttendance: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'applications' | 'corrections' | 'daily' | 'monthly'>('applications');

    const tabs = [
        { id: 'applications', label: '休暇・欠勤申請', icon: ClipboardList },
        { id: 'corrections', label: '打刻修正依頼', icon: CheckSquare },
        { id: 'daily', label: '日次打刻状況', icon: Calendar },
        { id: 'monthly', label: '月次集計', icon: BarChart3 },
    ] as const;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">勤怠・申請管理</h2>
                    <p className="text-gray-500">各種申請の承認や、日次・月次の勤怠確認を行います。</p>
                </div>
            </div>

            <div className="flex border-b border-gray-100 overflow-x-auto no-scrollbar">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <Button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            variant="ghost"
                            leftIcon={<Icon size={18} />}
                            className={`px-6 py-4 text-sm font-bold border-b-2 rounded-none transition-all whitespace-nowrap h-auto shadow-none ${isActive
                                ? 'border-primary text-primary bg-primary-light/30'
                                : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            {tab.label}
                        </Button>
                    );
                })}
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                {activeTab === 'applications' && <AdminApplicationsTab />}
                {activeTab === 'corrections' && <AdminCorrectionsTab />}
                {activeTab === 'daily' && <AdminDailyTab />}
                {activeTab === 'monthly' && <AdminMonthlyTab />}
            </div>
        </div>
    );
};
