import React, { useState } from 'react';
import { Employee, COLLECTIONS } from '../types';
import { db } from '../firebase';
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { X, Lock, Mail, ArrowLeft } from 'lucide-react';

interface Props {
    employee: Employee;
    onSuccess: () => void;
    onClose: () => void;
}

/**
 * 暗号学的に安全なランダムトークンを生成する
 */
function generateSecureToken(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const randomValues = new Uint32Array(length);
    crypto.getRandomValues(randomValues);
    let token = '';
    for (let i = 0; i < length; i++) {
        token += chars.charAt(randomValues[i] % chars.length);
    }
    return token;
}

export const PasswordModal: React.FC<Props> = ({ employee, onSuccess, onClose }) => {
    const [view, setView] = useState<'password' | 'reset'>('password');
    const [password, setPassword] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    // リセット用
    const [email, setEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [resetMsg, setResetMsg] = useState({ text: '', type: '' });

    const handlePasswordSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');

        if (!employee.password) {
            setErrorMsg('パスワードが設定されていません。管理者に設定を依頼してください。');
            return;
        }

        if (password === employee.password) {
            onSuccess();
        } else {
            setErrorMsg('パスワードが正しくありません');
            setPassword('');
        }
    };

    const handleResetRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        setResetMsg({ text: '', type: '' });

        if (!email.trim()) {
            setResetMsg({ text: 'メールアドレスを入力してください。', type: 'error' });
            return;
        }

        setIsSubmitting(true);
        try {
            const empDoc = await getDoc(doc(db, COLLECTIONS.EMPLOYEES, employee.docId || employee.id));
            if (!empDoc.exists()) {
                setResetMsg({ text: '従業員データが見つかりません。', type: 'error' });
                setIsSubmitting(false);
                return;
            }

            const empData = empDoc.data();
            const registeredEmail = (empData.email || '').toLowerCase();

            if (!registeredEmail || registeredEmail !== email.toLowerCase()) {
                setResetMsg({ text: '登録されているメールアドレスと一致しません。', type: 'error' });
                setIsSubmitting(false);
                return;
            }

            // 暗号学的に安全なトークンを生成
            const token = generateSecureToken(64);

            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 1);

            await addDoc(collection(db, 'passwordResetTokens'), {
                empId: employee.id,
                token: token,
                expiresAt: expiresAt,
                createdAt: serverTimestamp()
            });

            // GAS WebApp URLをFirestoreのsettingsから取得（未設定時はフォールバック）
            const FALLBACK_GAS_URL = 'https://script.google.com/macros/s/AKfycbzz2AyAjBQFQhL2sofqH0woLy-KA9tH201r0cIDHd2RGgwMgEZjQym3yXSxIWwhjf4c/exec';
            const settingsDoc = await getDoc(doc(db, COLLECTIONS.SETTINGS, 'system'));
            const gasUrl = (settingsDoc.exists() && settingsDoc.data().gasWebAppUrl)
                ? settingsDoc.data().gasWebAppUrl
                : FALLBACK_GAS_URL;

            const response = await fetch(gasUrl, {
                method: 'POST',
                body: JSON.stringify({
                    empId: employee.id,
                    email: registeredEmail,
                    token: token,
                    empName: empData.name || employee.id
                }),
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8',
                }
            });

            const result = await response.json();

            if (result.success) {
                setResetMsg({ text: 'リセットリンクを送信しました。メールをご確認ください。', type: 'success' });
            } else {
                setResetMsg({ text: result.message || 'メール送信に失敗しました。', type: 'error' });
            }
        } catch (error: any) {
            setResetMsg({ text: `エラーが発生しました: ${error.message}`, type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="font-bold text-gray-800">
                        {view === 'password' ? '本人確認' : 'パスワード再設定'}
                    </h3>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6">
                    {view === 'password' ? (
                        <form onSubmit={handlePasswordSubmit} className="space-y-6">
                            <div className="text-center">
                                <div className="w-16 h-16 bg-primary-light text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Lock size={32} />
                                </div>
                                <h2 className="text-xl font-bold text-gray-800 mb-2">{employee.name} さん</h2>
                                <p className="text-sm text-gray-500">モバイル端末からのアクセス時はパスワードが必要です。</p>
                            </div>

                            <div className="space-y-2">
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="パスワードを入力"
                                    className="w-full p-4 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-primary text-center tracking-widest text-lg"
                                    autoFocus
                                />
                                {errorMsg && <p className="text-danger text-sm text-center font-bold mt-2">{errorMsg}</p>}
                            </div>

                            <button type="submit" className="w-full bg-primary text-white p-4 rounded-xl font-bold hover:bg-primary-dark transition-colors shadow-lg shadow-primary/30 active:scale-95">
                                認証する
                            </button>

                            <div className="text-center mt-4">
                                <button
                                    type="button"
                                    onClick={() => setView('reset')}
                                    className="text-sm text-primary hover:underline"
                                >
                                    パスワードを忘れた際はこちら
                                </button>
                            </div>
                        </form>
                    ) : (
                        <form onSubmit={handleResetRequest} className="space-y-6">
                            <div className="text-center">
                                <div className="w-16 h-16 bg-orange-100 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Mail size={32} />
                                </div>
                                <h2 className="text-xl font-bold text-gray-800 mb-2">パスワードリセット申請</h2>
                                <p className="text-sm text-gray-500">登録されているメールアドレスを入力してください。再設定用のリンクを送信します。</p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 mb-1 block">対象の従業員ID</label>
                                    <div className="w-full p-3 rounded-xl bg-gray-100 text-gray-500 font-mono">
                                        {employee.id}: {employee.name}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 mb-1 block">メールアドレス</label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="登録アドレスを入力"
                                        className="w-full p-4 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-primary"
                                        autoFocus
                                        disabled={isSubmitting}
                                    />
                                </div>
                            </div>

                            {resetMsg.text && (
                                <div className={`p-3 rounded-xl text-sm font-bold text-center ${resetMsg.type === 'success' ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger'}`}>
                                    {resetMsg.text}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full bg-orange-500 text-white p-4 rounded-xl font-bold hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/30 active:scale-95 disabled:opacity-50"
                            >
                                {isSubmitting ? '送信中...' : 'リセットリンクを送信'}
                            </button>

                            <div className="text-center mt-4">
                                <button
                                    type="button"
                                    onClick={() => setView('password')}
                                    className="text-sm text-gray-500 hover:text-gray-700 flex items-center justify-center gap-1 mx-auto"
                                    disabled={isSubmitting}
                                >
                                    <ArrowLeft size={16} />
                                    認証画面に戻る
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};
