import { useQuery } from '@tanstack/react-query';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from '../types';

async function fetchSystemSettings(): Promise<any> {
    const docRef = doc(db, COLLECTIONS.SETTINGS, 'system');
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) {
        return {};
    }
    return snapshot.data();
}

export function useSettings() {
    return useQuery({
        queryKey: ['settings', 'system'],
        queryFn: fetchSystemSettings,
    });
}
