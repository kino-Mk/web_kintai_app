import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, query, where, orderBy, updateDoc, doc, serverTimestamp, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS, Application, ApplicationStatus } from '../types';

async function fetchApplicationsByEmployee(empId: string): Promise<Application[]> {
    const q = query(
        collection(db, COLLECTIONS.APPLICATIONS),
        where('empId', '==', empId),
        orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    } as Application));
}

export function useApplicationsByEmployee(empId: string | undefined) {
    return useQuery({
        queryKey: ['applications', empId],
        queryFn: () => fetchApplicationsByEmployee(empId!),
        enabled: !!empId,
    });
}

async function fetchPendingApplications(): Promise<Application[]> {
    const q = query(
        collection(db, COLLECTIONS.APPLICATIONS),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    } as Application));
}

export function usePendingApplications() {
    return useQuery({
        queryKey: ['applications', 'pending'],
        queryFn: fetchPendingApplications,
    });
}

export function useAdminApplications(filter: 'all' | 'pending') {
    return useQuery({
        queryKey: ['applications', 'admin', filter],
        queryFn: async () => {
            let q = query(collection(db, COLLECTIONS.APPLICATIONS), orderBy('createdAt', 'desc'));
            if (filter === 'pending') {
                q = query(collection(db, COLLECTIONS.APPLICATIONS), where('status', '==', 'pending'), orderBy('createdAt', 'desc'));
            }
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Application));
        }
    });
}

export function useUpdateApplicationStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ application, newStatus }: { application: Application; newStatus: ApplicationStatus }) => {
            if (!application.id) throw new Error("Application ID is missing");

            // 承認時の打刻データ自動生成ロジック (遅刻・早退・残業のみ)
            if (newStatus === 'approved') {
                let attType: 'in' | 'out' | null = null;
                let targetTimeStr: string | undefined;

                if (application.type === '遅刻') {
                    attType = 'in';
                    targetTimeStr = application.startTime;
                } else if (application.type === '早退' || application.type === '残業') {
                    attType = 'out';
                    targetTimeStr = application.endTime;
                }

                if (attType && targetTimeStr) {
                    const [years, months, days] = application.date.split('-').map(Number);
                    const [hours, minutes] = targetTimeStr.split(':').map(Number);
                    const targetDate = new Date(years, months - 1, days, hours, minutes);

                    await addDoc(collection(db, COLLECTIONS.ATTENDANCE), {
                        empId: application.empId,
                        empName: application.empName,
                        type: attType,
                        timestamp: targetDate,
                        remark: `${application.type}承認による自動登録`,
                        createdAt: serverTimestamp()
                    });
                }
            }

            // ステータス更新
            await updateDoc(doc(db, COLLECTIONS.APPLICATIONS, application.id), {
                status: newStatus,
                updatedAt: serverTimestamp()
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['applications'] });
            queryClient.invalidateQueries({ queryKey: ['attendance'] });
        }
    });
}
