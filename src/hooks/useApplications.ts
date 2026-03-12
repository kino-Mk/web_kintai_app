import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS, Application } from '../types';

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
