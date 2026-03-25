import { useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, query, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS, LeaveGrant } from '../types';
import { useEffect } from 'react';

export function useLeaveGrants() {
    const queryClient = useQueryClient();

    useEffect(() => {
        const q = query(collection(db, COLLECTIONS.LEAVE_GRANTS));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const grants = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveGrant));
            queryClient.setQueryData(['leaveGrants'], grants);
        });
        return () => unsubscribe();
    }, [queryClient]);

    return useQuery({
        queryKey: ['leaveGrants'],
        queryFn: async () => {
            const snap = await getDocs(query(collection(db, COLLECTIONS.LEAVE_GRANTS)));
            return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveGrant));
        },
        staleTime: Infinity,
    });
}
