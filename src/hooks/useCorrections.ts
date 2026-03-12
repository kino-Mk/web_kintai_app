import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS, StampCorrection } from '../types';

export function useAdminCorrections(filter: 'all' | 'pending') {
    return useQuery({
        queryKey: ['corrections', 'admin', filter],
        queryFn: async () => {
            let q = query(collection(db, COLLECTIONS.STAMP_CORRECTIONS), orderBy('createdAt', 'desc'));
            if (filter === 'pending') {
                q = query(collection(db, COLLECTIONS.STAMP_CORRECTIONS), where('status', '==', 'pending'), orderBy('createdAt', 'desc'));
            }
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as StampCorrection));
        }
    });
}
