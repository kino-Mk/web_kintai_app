import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS, Employee } from '../types';

async function fetchEmployees(): Promise<Employee[]> {
    const q = query(collection(db, COLLECTIONS.EMPLOYEES), orderBy('name', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
        const data = doc.data();
        const { password, ...safeData } = data; // クライアント側に平文パスワードを持たせない
        return {
            id: doc.id,
            ...safeData
        } as Employee;
    });
}

export function useEmployees(includeHidden = false) {
    return useQuery({
        queryKey: ['employees'],
        queryFn: fetchEmployees,
        select: (data) => includeHidden ? data : data.filter(emp => !emp.isHidden)
    });
}

export function useEmployee(id: string | undefined) {
    return useQuery({
        queryKey: ['employee', id],
        queryFn: async () => {
            if (!id) return null;
            const docRef = doc(db, COLLECTIONS.EMPLOYEES, id);
            const docSnap = await getDoc(docRef);
            if (!docSnap.exists()) return null;
            const data = docSnap.data();
            const { password, ...safeData } = data;
            return {
                id: docSnap.id,
                ...safeData
            } as Employee;
        },
        enabled: !!id
    });
}
