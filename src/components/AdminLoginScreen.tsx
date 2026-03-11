import React, { useState } from 'react';
import { auth } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { Lock, Shield, Mail } from 'lucide-react';
import { useModal } from '../contexts/ModalContext';

interface Props {
    onSuccess: () => void;
}

export const AdminLoginScreen: React.FC<Props> = ({ onSuccess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // 初期設定用
    const [isSetup, setIsSetup] = useState(false);
    const [confirmPassword, setConfirmPassword] = useState('');
    const { showAlert } = useModal();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        setIsLoading(true);

        try {
            await signInWithEmailAndPassword(auth, email, password);
            onSuccess();
        } catch (error: any) {
            const code = error.code;
            if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
                // アカウントが存在しない場合、初期設定モードに切り替え
                setIsSetup(true);
                setErrorMsg('管理者アカウントが見つかりません。新規作成してください。');
            } else if (code === 'auth/wrong-password') {
                setErrorMsg('パスワードが正しくありません');
            } else if (code === 'auth/invalid-email') {
                setErrorMsg('メールアドレスの形式が正しくありません');
            } else if (code === 'auth/too-many-requests') {
                setErrorMsg('ログイン試行回数が上限に達しました。しばらく待ってから再試行してください。');
            } else {
                setErrorMsg(`認証エラー: ${error.message}`);
            }
            setPassword('');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSetup = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');

        if (!email.trim()) {
            setErrorMsg('メールアドレスを入力してください。');
            return;
        }
        if (!password || password.length < 6) {
            setErrorMsg('パスワードは6文字以上で設定してください。');
            return;
        }
        if (password !== confirmPassword) {
            setErrorMsg('パスワードが一致しません。');
            return;
        }

        setIsLoading(true);
        try {
            await createUserWithEmailAndPassword(auth, email, password);
            await showAlert('管理者アカウントを作成しました。');
            onSuccess();
        } catch (error: any) {
            const code = error.code;
            if (code === 'auth/email-already-in-use') {
                setErrorMsg('このメールアドレスは既に使用されています。ログインを試してください。');
                setIsSetup(false);
            } else if (code === 'auth/weak-password') {
                setErrorMsg('パスワードが弱すぎます。6文字以上で設定してください。');
            } else if (code === 'auth/invalid-email') {
                setErrorMsg('メールアドレスの形式が正しくありません。');
            } else {
                setErrorMsg(`アカウント作成エラー: ${error.message}`);
            }
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
                        {isSetup ? '管理者アカウント作成' : '管理者認証'}
                    </h1>
                    <p className="text-sm text-white/70 mt-2">
                        {isSetup
                            ? '管理者アカウントを新規作成します。'
                            : '管理画面にアクセスするにはログインが必要です。'
                        }
                    </p>
                </div>

                <div className="p-8">
                    {isSetup ? (
                        <form onSubmit={handleSetup} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 px-1">
                                    <Mail size={14} className="text-primary" /> メールアドレス
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="admin@example.com"
                                    className="w-full p-4 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-primary text-sm"
                                    autoFocus
                                    disabled={isLoading}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 px-1">
                                    <Lock size={14} className="text-primary" /> パスワード
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="6文字以上"
                                    className="w-full p-4 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-primary text-center tracking-widest text-lg"
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
                                {isLoading ? '作成中...' : 'アカウントを作成して開始'}
                            </button>

                            <button
                                type="button"
                                onClick={() => { setIsSetup(false); setErrorMsg(''); }}
                                className="w-full text-gray-500 text-sm font-bold hover:text-gray-700 py-2"
                            >
                                ← ログイン画面に戻る
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleLogin} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 px-1">
                                    <Mail size={14} className="text-primary" /> メールアドレス
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="admin@example.com"
                                    className="w-full p-4 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-primary text-sm"
                                    autoFocus
                                    disabled={isLoading}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 px-1">
                                    <Lock size={14} className="text-primary" /> パスワード
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="パスワードを入力"
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
                                {isLoading ? '認証中...' : '管理画面にログイン'}
                            </button>

                            <button
                                type="button"
                                onClick={() => { setIsSetup(true); setErrorMsg(''); }}
                                className="w-full text-gray-500 text-sm font-bold hover:text-gray-700 py-2"
                            >
                                管理者アカウントを新規作成 →
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};
