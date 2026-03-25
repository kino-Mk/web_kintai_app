import { useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, query, orderBy, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS, Employee } from '../types';
import { useEffect } from 'react';

async function fetchEmployees(): Promise<Employee[]> {
    const q = query(collection(db, COLLECTIONS.EMPLOYEES), orderBy('name', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
        const data = doc.data();
        const { password, ...safeData } = data;
        return {
            id: doc.id,
            ...safeData
        } as Employee;
    });
}

export function useEmployees(includeHidden = false) {
    const queryClient = useQueryClient();

    useEffect(() => {
        const q = query(collection(db, COLLECTIONS.EMPLOYEES), orderBy('name', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const employees = snapshot.docs.map(doc => {
                const data = doc.data();
                const { password, ...safeData } = data;
                return {
                    id: doc.id,
                    ...safeData
                } as Employee;
            });
            queryClient.setQueryData(['employees'], employees);
        });
        return () => unsubscribe();
    }, [queryClient]);

    return useQuery({
        queryKey: ['employees'],
        queryFn: fetchEmployees,
        select: (data) => includeHidden ? data : data.filter(emp => !emp.isHidden),
        staleTime: Infinity, // onSnapshot がデータを管理するため、手動 refetch を抑制
    });
}

export function useEmployee(id: string | undefined) {
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!id) return;
        const docRef = doc(db, COLLECTIONS.EMPLOYEES, id);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const { password, ...safeData } = data;
                const employee = {
                    id: docSnap.id,
                    ...safeData
                } as Employee;
                queryClient.setQueryData(['employee', id], employee);
            } else {
                queryClient.setQueryData(['employee', id], null);
            }
        });
        return () => unsubscribe();
    }, [id, queryClient]);

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
        enabled: !!id,
        staleTime: Infinity,
    });
}
