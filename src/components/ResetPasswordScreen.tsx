import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, deleteDoc, updateDoc, doc } from 'firebase/firestore';
import { Lock, AlertTriangle, CheckCircle } from 'lucide-react';
import { hashPassword } from '../utils';
import { Input } from './ui/Input';
import { Button } from './ui/Button';

interface Props {
    token: string;
    onHome: () => void;
}

export const ResetPasswordScreen: React.FC<Props> = ({ token, onHome }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [isValid, setIsValid] = useState(false);
    const [empId, setEmpId] = useState('');
    const [empName, setEmpName] = useState('');
    const [tokenDocId, setTokenDocId] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [formError, setFormError] = useState('');

    useEffect(() => {
        const validateToken = async () => {
            if (!token) {
                setErrorMsg('トークンが指定されていません。メールのリンクからアクセスしてください。');
                setIsLoading(false);
                return;
            }

            try {
                const q = query(collection(db, 'passwordResetTokens'), where('token', '==', token));
                const snapshot = await getDocs(q);

                if (snapshot.empty) {
                    setErrorMsg('このリンクは無効です。新しいリセットリンクを申請してください。');
                    setIsLoading(false);
                    return;
                }

                const tokenDoc = snapshot.docs[0];
                const tokenData = tokenDoc.data();

                const expiresAt = tokenData.expiresAt.toDate();
                if (new Date() > expiresAt) {
                    await deleteDoc(tokenDoc.ref);
                    setErrorMsg('このリンクの有効期限が切れています（1時間）。新しいリセットリンクを申請してください。');
                    setIsLoading(false);
                    return;
                }

                // 従業員情報を取得
                const empSnapshot = await getDocs(query(collection(db, 'employees'), where('id', '==', tokenData.empId)));
                if (!empSnapshot.empty) {
                    const empData = empSnapshot.docs[0].data();
                    setEmpName(empData.name);
                    setEmpId(empSnapshot.docs[0].id); // docId
                } else {
                    // Fallback to doc id if id didn't match
                    const docRef = doc(db, 'employees', tokenData.empId);
                    setEmpId(docRef.id);
                }

                setTokenDocId(tokenDoc.id);
                setIsValid(true);
            } catch (error: any) {
                console.error('Token validation error:', error);
                setErrorMsg('エラーが発生しました。しばらくしてからお試しください。');
            } finally {
                setIsLoading(false);
            }
        };

        validateToken();
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');

        if (!newPassword) {
            setFormError('パスワードを入力してください。');
            return;
        }
        if (newPassword.length < 4) {
            setFormError('パスワードは4文字以上で設定してください。');
            return;
        }
        if (newPassword !== confirmPassword) {
            setFormError('パスワードが一致しません。');
            return;
        }

        setIsSubmitting(true);
        try {
            // パスワードをハッシュ化して保存
            const hashedPassword = await hashPassword(newPassword);
            await updateDoc(doc(db, 'employees', empId), {
                passwordHash: hashedPassword,
                password: '' // 旧平文パスワードをクリア
            });

            await deleteDoc(doc(db, 'passwordResetTokens', tokenDocId));

            setIsSuccess(true);
        } catch (error: any) {
            console.error('Password reset error:', error);
            setFormError('パスワードの更新に失敗しました。しばらくしてからお試しください。');
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="max-w-md mx-auto mt-12 bg-white p-8 rounded-3xl shadow-sm border border-gray-100 text-center">
                <div className="w-16 h-16 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                    <Lock size={32} />
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">パスワード再設定</h2>
                <p className="text-gray-500">トークンを確認中...</p>
            </div>
        );
    }

    if (!isValid) {
        return (
            <div className="max-w-md mx-auto mt-12 bg-white p-8 rounded-3xl shadow-sm border border-danger-bg text-center">
                <div className="w-16 h-16 bg-danger-bg text-danger rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle size={32} />
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">リンクが無効です</h2>
                <p className="text-danger font-medium mb-6">{errorMsg}</p>
                <Button onClick={onHome} variant="outline" className="w-full">
                    トップページに戻る
                </Button>
            </div>
        );
    }

    if (isSuccess) {
        return (
            <div className="max-w-md mx-auto mt-12 bg-white p-8 rounded-3xl shadow-sm border border-success-bg text-center">
                <div className="w-16 h-16 bg-success-bg text-success rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle size={32} />
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">パスワードを更新しました</h2>
                <p className="text-gray-500 mb-6">新しいパスワードで認証・申請を行えます。</p>
                <Button onClick={onHome} variant="primary" className="w-full">
                    トップページへ
                </Button>
            </div>
        );
    }

    return (
        <div className="max-w-md mx-auto mt-12 bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
            <div className="text-center mb-8">
                <div className="w-16 h-16 bg-primary-light text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                    <Lock size={32} />
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">新しいパスワードを設定</h2>
                <p className="text-sm text-gray-500">{empName} さんのパスワードを再設定します</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <Input
                        type="password"
                        placeholder="新しいパスワード"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        autoFocus
                        disabled={isSubmitting}
                    />
                </div>
                <div>
                    <Input
                        type="password"
                        placeholder="確認のためもう一度入力"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={isSubmitting}
                    />
                </div>

                {formError && (
                    <div className="p-3 bg-danger-bg text-danger text-sm font-bold rounded-xl text-center">
                        {formError}
                    </div>
                )}

                <Button
                    type="submit"
                    disabled={isSubmitting}
                    isLoading={isSubmitting}
                    className="w-full mt-4"
                >
                    {isSubmitting ? '更新中...' : 'パスワードを更新'}
                </Button>
            </form>
        </div>
    );
};
