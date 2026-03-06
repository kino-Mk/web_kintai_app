import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Employee, COLLECTIONS } from '../types';
import { User, Search, AlertCircle } from 'lucide-react';
import { StampCorrectionModal } from './StampCorrectionModal';

interface Props {
    onSelect: (employee: Employee) => void;
}

export const EmployeeSelection: React.FC<Props> = ({ onSelect }) => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        const q = query(collection(db, COLLECTIONS.EMPLOYEES), orderBy('name', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Employee[];

            setEmployees(list.filter(e => !e.isHidden));
            setLoading(false);
        }, (error) => {
            console.error("Employee list error:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    if (loading) {
        return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => (
                    <div key={i} className="animate-pulse bg-white border border-gray-100 h-32 rounded-2xl"></div>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="relative">
                <input
                    type="text"
                    placeholder="名前またはIDで検索..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="w-full pl-12 pr-6 py-4 rounded-2xl bg-gray-100/50 border-none focus:ring-2 focus:ring-primary transition-all text-lg placeholder:text-gray-400"
                />
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={24} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {employees
                    .filter(emp => !emp.isHidden && (emp.name.includes(filter) || emp.id.includes(filter)))
                    .map((emp) => (
                        <button
                            key={emp.id}
                            onClick={() => onSelect(emp)}
                            className="flex flex-col items-center p-6 bg-white border border-gray-100 rounded-[2rem] hover:shadow-xl hover:border-primary-light transition-all group active:scale-95"
                        >
                            <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center text-gray-300 group-hover:bg-primary-light group-hover:text-primary transition-colors mb-4">
                                <User size={32} />
                            </div>
                            <span className="font-bold text-gray-700 group-hover:text-primary transition-colors line-clamp-1">{emp.name}</span>
                            <span className="text-[10px] text-gray-300 mt-1 font-mono">{emp.id}</span>
                        </button>
                    ))}
            </div>

            <div className="pt-6 border-t border-gray-50">
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="w-full flex items-center justify-center gap-2 py-4 px-6 rounded-2xl border-2 border-dashed border-warning text-warning font-bold hover:bg-warning-bg transition-all active:scale-95"
                >
                    <AlertCircle size={20} />
                    打刻内容の修正を申請する
                </button>
            </div>

            <StampCorrectionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </div>
    );
};
