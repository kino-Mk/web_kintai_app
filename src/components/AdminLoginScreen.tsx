import React, { useState } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { COLLECTIONS } from '../types';
import { Lock, Shield } from 'lucide-react';
import { hashPassword, verifyPassword } from '../utils';
import { useModal } from '../contexts/ModalContext';
import { Input } from './ui/Input';
import { Button } from './ui/Button';

interface Props {
    onSuccess: () => void;
}

export const AdminLoginScreen: React.FC<Props> = ({ onSuccess }) => {
    const [password, setPassword] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // パスワード試行回数制限
    const MAX_ATTEMPTS = 5;
    const LOCKOUT_SECONDS = 30;
    const [failCount, setFailCount] = useState(0);
    const [lockedUntil, setLockedUntil] = useState<number | null>(null);

    // 初期設定用
    const [isSetup, setIsSetup] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const { showAlert } = useModal();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');

        // ロックアウト中かチェック
        if (lockedUntil && Date.now() < lockedUntil) {
            const remainSec = Math.ceil((lockedUntil - Date.now()) / 1000);
            setErrorMsg(`パスワード入力がロックされています。${remainSec}秒後にお試しください。`);
            return;
        }
        if (lockedUntil && Date.now() >= lockedUntil) {
            setLockedUntil(null);
            setFailCount(0);
        }

        setIsLoading(true);

        try {
            const settingsDoc = await getDoc(doc(db, COLLECTIONS.SETTINGS, 'system'));

            if (!settingsDoc.exists() || !settingsDoc.data().adminPasswordHash) {
                setIsSetup(true);
                setIsLoading(false);
                return;
            }

            const storedHash = settingsDoc.data().adminPasswordHash;
            const isValid = await verifyPassword(password, storedHash);

            if (isValid) {
                // 旧形式ハッシュの場合、ソルト付きに再ハッシュして更新
                if (!storedHash.includes(':')) {
                    try {
                        const newHash = await hashPassword(password);
                        await setDoc(doc(db, COLLECTIONS.SETTINGS, 'system'), {
                            adminPasswordHash: newHash,
                            updatedAt: serverTimestamp()
                        }, { merge: true });
                    } catch (e) { /* マイグレーション失敗でもログインは成功 */ }
                }
                setFailCount(0);
                onSuccess();
            } else {
                const newCount = failCount + 1;
                setFailCount(newCount);
                if (newCount >= MAX_ATTEMPTS) {
                    setLockedUntil(Date.now() + LOCKOUT_SECONDS * 1000);
                    setErrorMsg(`パスワードを${MAX_ATTEMPTS}回間違えました。${LOCKOUT_SECONDS}秒間ロックされます。`);
                } else {
                    setErrorMsg(`管理者パスワードが正しくありません（${newCount}/${MAX_ATTEMPTS}）`);
                }
                setPassword('');
            }
        } catch (error: any) {
            console.error('Admin login error:', error);
            setErrorMsg('認証処理中にエラーが発生しました');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSetup = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');

        if (!newPassword || newPassword.length < 4) {
            setErrorMsg('パスワードは4文字以上で設定してください。');
            return;
        }
        if (newPassword !== confirmPassword) {
            setErrorMsg('パスワードが一致しません。');
            return;
        }

        setIsLoading(true);
        try {
            const hashedPassword = await hashPassword(newPassword);
            const settingsRef = doc(db, COLLECTIONS.SETTINGS, 'system');
            const settingsDoc = await getDoc(settingsRef);

            // 既存の設定を保持しつつ管理者パスワードを追加
            const existingData = settingsDoc.exists() ? settingsDoc.data() : {};
            await setDoc(settingsRef, {
                ...existingData,
                adminPasswordHash: hashedPassword,
                updatedAt: serverTimestamp()
            });

            await showAlert('管理者パスワードを設定しました。');
            onSuccess();
        } catch (error: any) {
            console.error('Admin setup error:', error);
            setErrorMsg('設定に失敗しました。しばらくしてからお試しください。');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-3xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                <div className="bg-primary p-8 text-center">
                    <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Shield size={40} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">
                        {isSetup ? '管理者パスワード設定' : '管理者認証'}
                    </h1>
                    <p className="text-sm text-white/70 mt-2">
                        {isSetup
                            ? '初回アクセスです。管理者パスワードを設定してください。'
                            : '管理画面にアクセスするにはパスワードが必要です。'
                        }
                    </p>
                </div>

                <div className="p-8">
                    {isSetup ? (
                        <form onSubmit={handleSetup} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 px-1">
                                    <Lock size={14} className="text-primary" /> 新しい管理者パスワード
                                </label>
                                <Input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="4文字以上"
                                    className="text-center tracking-widest text-lg"
                                    autoFocus
                                    disabled={isLoading}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 px-1">
                                    <Lock size={14} className="text-primary" /> 確認
                                </label>
                                <Input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="もう一度入力"
                                    className="text-center tracking-widest text-lg"
                                    disabled={isLoading}
                                />
                            </div>

                            {errorMsg && <p className="text-danger text-sm text-center font-bold">{errorMsg}</p>}

                            <Button
                                type="submit"
                                disabled={isLoading}
                                isLoading={isLoading}
                                className="w-full"
                            >
                                {isLoading ? '設定中...' : 'パスワードを設定して開始'}
                            </Button>
                        </form>
                    ) : (
                        <form onSubmit={handleLogin} className="space-y-6">
                            <div className="space-y-2">
                                <Input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="管理者パスワードを入力"
                                    className="text-center tracking-widest text-lg"
                                    autoFocus
                                    disabled={isLoading}
                                />
                            </div>

                            {errorMsg && <p className="text-danger text-sm text-center font-bold">{errorMsg}</p>}

                            <Button
                                type="submit"
                                disabled={isLoading}
                                isLoading={isLoading}
                                className="w-full"
                            >
                                {isLoading ? '認証中...' : '管理画面にログイン'}
                            </Button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};
