import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Employee, COLLECTIONS } from '../types';
import { ArrowLeft, User, Clock, Calendar, Mail } from 'lucide-react';
import { Button } from './ui/Button';

import { TabDetailBasic } from './detail-tabs/TabDetailBasic';
import { TabDetailAttendance } from './detail-tabs/TabDetailAttendance';
import { TabDetailLeave } from './detail-tabs/TabDetailLeave';
import { TabDetailApplications } from './detail-tabs/TabDetailApplications';

interface Props {
    employeeId: string;
    onBack: () => void;
}

export const AdminEmployeeDetail: React.FC<Props> = ({ employeeId, onBack }) => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [currentEmpId, setCurrentEmpId] = useState(employeeId);
    const [activeTab, setActiveTab] = useState<'basic' | 'attendance' | 'leave' | 'applications'>('basic');

    useEffect(() => {
        const q = query(collection(db, COLLECTIONS.EMPLOYEES), orderBy('id', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id, // display id
                docId: doc.id,
                ...doc.data()
            })) as Employee[];
            setEmployees(list);
        });
        return () => unsubscribe();
    }, []);

    const currentEmployee = employees.find(e => e.id === currentEmpId || e.docId === currentEmpId);

    if (!currentEmployee) {
        return (
            <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button
                        onClick={onBack}
                        variant="ghost"
                        className="text-gray-400 hover:text-gray-600 rounded-full w-12 h-12 p-0"
                    >
                        <ArrowLeft size={24} />
                    </Button>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">
                            {currentEmployee.name} <span className="text-gray-400 text-lg">({currentEmployee.id})</span>
                        </h2>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <label className="text-sm font-bold text-gray-500">従業員切替:</label>
                    <select
                        value={currentEmpId}
                        onChange={(e) => setCurrentEmpId(e.target.value)}
                        className="p-2 rounded-lg bg-white border border-gray-200 focus:ring-2 focus:ring-primary focus:outline-none"
                    >
                        {employees.map(emp => (
                            <option key={emp.docId || emp.id} value={emp.docId || emp.id}>
                                {emp.name} ({emp.id}) {emp.isHidden ? '(非表示)' : ''}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="flex overflow-x-auto border-b border-gray-200 hide-scrollbar gap-2 px-1">
                <Button
                    onClick={() => setActiveTab('basic')}
                    variant="ghost"
                    leftIcon={<User size={18} />}
                    className={`px-6 py-4 font-bold whitespace-nowrap rounded-none border-b-2 h-auto shadow-none ${activeTab === 'basic' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                >
                    基本情報
                </Button>
                <Button
                    onClick={() => setActiveTab('attendance')}
                    variant="ghost"
                    leftIcon={<Clock size={18} />}
                    className={`px-6 py-4 font-bold whitespace-nowrap rounded-none border-b-2 h-auto shadow-none ${activeTab === 'attendance' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                >
                    勤務記録
                </Button>
                <Button
                    onClick={() => setActiveTab('leave')}
                    variant="ghost"
                    leftIcon={<Calendar size={18} />}
                    className={`px-6 py-4 font-bold whitespace-nowrap rounded-none border-b-2 h-auto shadow-none ${activeTab === 'leave' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                >
                    有給管理
                </Button>
                <Button
                    onClick={() => setActiveTab('applications')}
                    variant="ghost"
                    leftIcon={<Mail size={18} />}
                    className={`px-6 py-4 font-bold whitespace-nowrap rounded-none border-b-2 h-auto shadow-none ${activeTab === 'applications' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                >
                    申請履歴
                </Button>
            </div>

            <div className="bg-transparent">
                {activeTab === 'basic' && <TabDetailBasic employee={currentEmployee} />}
                {activeTab === 'attendance' && <TabDetailAttendance employee={currentEmployee} />}
                {activeTab === 'leave' && <TabDetailLeave employee={currentEmployee} />}
                {activeTab === 'applications' && <TabDetailApplications employee={currentEmployee} />}
            </div>
        </div>
    );
};
