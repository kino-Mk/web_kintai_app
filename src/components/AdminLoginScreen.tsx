import React, { useState } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { COLLECTIONS } from '../types';
import { Lock, Shield } from 'lucide-react';
import { hashPassword } from '../utils';
import { useModal } from '../contexts/ModalContext';

interface Props {
    onSuccess: () => void;
}

export const AdminLoginScreen: React.FC<Props> = ({ onSuccess }) => {
    const [password, setPassword] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // 初期設定用
    const [isSetup, setIsSetup] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const { showAlert } = useModal();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        setIsLoading(true);

        try {
            const settingsDoc = await getDoc(doc(db, COLLECTIONS.SETTINGS, 'system'));

            if (!settingsDoc.exists() || !settingsDoc.data().adminPasswordHash) {
                // 管理者パスワード未設定 → 初期設定画面を表示
                setIsSetup(true);
                setIsLoading(false);
                return;
            }

            const storedHash = settingsDoc.data().adminPasswordHash;
            const inputHash = await hashPassword(password);

            if (inputHash === storedHash) {
                onSuccess();
            } else {
                setErrorMsg('管理者パスワードが正しくありません');
                setPassword('');
            }
        } catch (error: any) {
            setErrorMsg(`認証エラー: ${error.message}`);
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
            setErrorMsg(`設定エラー: ${error.message}`);
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
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="4文字以上"
                                    className="w-full p-4 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-primary text-center tracking-widest text-lg"
                                    autoFocus
                                    disabled={isLoading}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 px-1">
                                    <Lock size={14} className="text-primary" /> 確認
                                </label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="もう一度入力"
                                    className="w-full p-4 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-primary text-center tracking-widest text-lg"
                                    disabled={isLoading}
                                />
                            </div>

                            {errorMsg && <p className="text-danger text-sm text-center font-bold">{errorMsg}</p>}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-primary text-white p-4 rounded-xl font-bold hover:bg-primary-dark transition-colors shadow-lg shadow-primary/30 active:scale-95 disabled:opacity-50"
                            >
                                {isLoading ? '設定中...' : 'パスワードを設定して開始'}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleLogin} className="space-y-6">
                            <div className="space-y-2">
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="管理者パスワードを入力"
                                    className="w-full p-4 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-primary text-center tracking-widest text-lg"
                                    autoFocus
                                    disabled={isLoading}
                                />
                            </div>

                            {errorMsg && <p className="text-danger text-sm text-center font-bold">{errorMsg}</p>}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-primary text-white p-4 rounded-xl font-bold hover:bg-primary-dark transition-colors shadow-lg shadow-primary/30 active:scale-95 disabled:opacity-50"
                            >
                                {isLoading ? '認証中...' : '管理画面にログイン'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};
