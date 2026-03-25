import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, query, where, orderBy, updateDoc, doc, serverTimestamp, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS, StampCorrection, ApplicationStatus } from '../types';
import { toDate } from '../utils';
import { useEffect } from 'react';

export function useAdminCorrections(filter: 'all' | 'pending') {
    const queryClient = useQueryClient();

    useEffect(() => {
        let q = query(collection(db, COLLECTIONS.STAMP_CORRECTIONS), orderBy('createdAt', 'desc'));
        if (filter === 'pending') {
            q = query(collection(db, COLLECTIONS.STAMP_CORRECTIONS), where('status', '==', 'pending'), orderBy('createdAt', 'desc'));
        }
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const corrections = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as StampCorrection));
            queryClient.setQueryData(['corrections', 'admin', filter], corrections);
        });
        return () => unsubscribe();
    }, [filter, queryClient]);

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
        },
        staleTime: Infinity,
    });
}

export function useCorrectionsByEmployee(empId: string | undefined) {
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!empId) return;
        const q = query(
            collection(db, COLLECTIONS.STAMP_CORRECTIONS),
            where('empId', '==', empId),
            orderBy('createdAt', 'desc')
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const corrections = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as StampCorrection));
            queryClient.setQueryData(['corrections', 'emp', empId], corrections);
        });
        return () => unsubscribe();
    }, [empId, queryClient]);

    return useQuery({
        queryKey: ['corrections', 'emp', empId],
        queryFn: async () => {
            if (!empId) return [];
            const q = query(
                collection(db, COLLECTIONS.STAMP_CORRECTIONS),
                where('empId', '==', empId),
                orderBy('createdAt', 'desc')
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as StampCorrection));
        },
        enabled: !!empId,
        staleTime: Infinity,
    });
}

export function useUpdateCorrectionStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ correction, newStatus }: { correction: StampCorrection; newStatus: ApplicationStatus }) => {
            if (!correction.id) throw new Error("Correction ID is missing");

            // 承認時の打刻データ反映ロジック (上書き更新に統一)
            if (newStatus === 'approved' || newStatus === 'completed') {
                const attRef = doc(db, COLLECTIONS.ATTENDANCE, correction.attendanceDocId);
                const attDoc = await getDoc(attRef);

                if (attDoc.exists()) {
                    await updateDoc(attRef, {
                        timestamp: toDate(correction.attendanceTime),
                        isCorrected: true,
                        remark: correction.reason,
                        updatedAt: serverTimestamp()
                    });
                }
            }

            // 修正依頼ステータス更新
            // 一致させるため、引数の newStatus が何であれ最終的には完了状態(completedまたはapproved)にする
            const statusToSet = newStatus === 'approved' ? 'completed' : newStatus;

            await updateDoc(doc(db, COLLECTIONS.STAMP_CORRECTIONS, correction.id), {
                status: statusToSet,
                updatedAt: serverTimestamp()
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['corrections'] });
            queryClient.invalidateQueries({ queryKey: ['attendance'] });
        }
    });
}
