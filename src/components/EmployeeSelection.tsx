import React, { useState } from 'react';
import { VirtuosoGrid } from 'react-virtuoso';
import { Employee } from '../types';
import { User, Search, AlertCircle } from 'lucide-react';
import { StampCorrectionModal } from './StampCorrectionModal';
import { useEmployees } from '../hooks/useEmployees';
import { Skeleton } from './ui/Skeleton';
import { Input } from './ui/Input';

interface Props {
    onSelect: (employee: Employee) => void;
    attendanceStates?: Record<string, 'in' | 'out'>;
}

export const EmployeeSelection: React.FC<Props> = ({ onSelect, attendanceStates = {} }) => {
    const { data: employees = [], isLoading } = useEmployees();
    const [filter, setFilter] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'all' | 'in'>('all');

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (isLoading) {
        return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => (
                    <Skeleton key={i} className="h-32 rounded-2xl" />
                ))}
            </div>
        );
    }

    const filteredEmployees = employees.filter(emp => {
        const matchesFilter = emp.name.includes(filter) || emp.id.includes(filter);
        if (activeTab === 'in') return matchesFilter && attendanceStates[emp.id] === 'in';
        return matchesFilter;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                    <Input
                        type="text"
                        placeholder="名前またはIDで検索..."
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        icon={<Search size={24} />}
                        className="py-4 rounded-2xl border-none shadow-sm text-lg"
                    />
                </div>
                <div className="flex bg-gray-100/50 p-1 rounded-2xl">
                    <button
                        onClick={() => setActiveTab('all')}
                        className={`px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'all' ? 'bg-white shadow-sm text-primary' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        全員
                    </button>
                    <button
                        onClick={() => setActiveTab('in')}
                        className={`px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'in' ? 'bg-white shadow-sm text-success' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        出勤中
                    </button>
                </div>
            </div>

            <VirtuosoGrid
                style={{ height: '500px' }}
                data={filteredEmployees}
                listClassName="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-2 custom-scrollbar"
                itemClassName="flex"
                itemContent={(_index, emp) => {
                    const status = attendanceStates[emp.id];
                    return (
                        <button
                            onClick={() => onSelect(emp)}
                            className="w-full flex flex-col items-center p-6 bg-white border border-gray-100 rounded-[2rem] hover:shadow-xl hover:border-primary-light transition-all group active:scale-95 relative overflow-hidden"
                        >
                            <div className={`absolute top-4 right-4 w-3 h-3 rounded-full shadow-sm ${status === 'in' ? 'bg-success animate-pulse' : 'bg-gray-200'}`}></div>
                            <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center text-gray-300 group-hover:bg-primary-light group-hover:text-primary transition-colors mb-4">
                                <User size={32} />
                            </div>
                            <span className="font-bold text-gray-700 group-hover:text-primary transition-colors line-clamp-1">{emp.name}</span>
                            <span className="text-[10px] text-gray-300 mt-1 font-mono">{emp.id}</span>
                        </button>
                    );
                }}
            />

            <div className="pt-6 border-t border-gray-50">
                {isMobile ? (
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="w-full flex items-center justify-center gap-2 py-4 px-6 rounded-2xl border-2 border-dashed border-warning text-warning font-bold hover:bg-warning-bg transition-all active:scale-95"
                    >
                        <AlertCircle size={20} />
                        打刻内容の修正を申請する
                    </button>
                ) : (
                    <div className="text-center p-4 bg-gray-50 rounded-2xl border border-gray-200">
                        <p className="text-sm text-gray-500 font-bold flex items-center justify-center gap-2">
                            <AlertCircle size={16} className="text-gray-400" />
                            打刻の修正申請はスマートフォンからのみ可能です
                        </p>
                    </div>
                )}
            </div>

            <StampCorrectionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </div>
    );
};
