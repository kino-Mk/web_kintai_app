import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { COLLECTIONS } from '../types';
import { Save, Mail, Globe, Lock } from 'lucide-react';
import { useModal } from '../contexts/ModalContext';
import { hashPassword } from '../utils';

export const AdminSettings: React.FC = () => {
    const [settings, setSettings] = useState({
        adminEmail: '',
        gasWebAppUrl: ''
    });
    const [loading, setLoading] = useState(true);
    const { showAlert } = useModal();

    // パスワード変更用
    const [currentPw, setCurrentPw] = useState('');
    const [newPw, setNewPw] = useState('');
    const [confirmPw, setConfirmPw] = useState('');
    const [pwLoading, setPwLoading] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const docRef = doc(db, COLLECTIONS.SETTINGS, 'system');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setSettings({ ...settings, ...docSnap.data() });
                }
            } catch (error) {
                console.error('Fetch settings error:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await setDoc(doc(db, COLLECTIONS.SETTINGS, 'system'), {
                ...settings,
                updatedAt: serverTimestamp()
            }, { merge: true });
            await showAlert('設定を保存しました。');
        } catch (error: any) {
            await showAlert(`保存失敗: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!newPw || newPw.length < 4) {
            await showAlert('新しいパスワードは4文字以上で設定してください。');
            return;
        }
        if (newPw !== confirmPw) {
            await showAlert('新しいパスワードが一致しません。');
            return;
        }

        setPwLoading(true);
        try {
            // 現在のパスワードを検証
            const settingsDoc = await getDoc(doc(db, COLLECTIONS.SETTINGS, 'system'));
            if (settingsDoc.exists() && settingsDoc.data().adminPasswordHash) {
                const currentHash = await hashPassword(currentPw);
                if (currentHash !== settingsDoc.data().adminPasswordHash) {
                    await showAlert('現在のパスワードが正しくありません。');
                    setPwLoading(false);
                    return;
                }
            }

            // 新しいパスワードをハッシュ化して保存
            const newHash = await hashPassword(newPw);
            await setDoc(doc(db, COLLECTIONS.SETTINGS, 'system'), {
                adminPasswordHash: newHash,
                updatedAt: serverTimestamp()
            }, { merge: true });

            setCurrentPw('');
            setNewPw('');
            setConfirmPw('');
            await showAlert('管理者パスワードを変更しました。');
        } catch (error: any) {
            await showAlert(`パスワード変更に失敗しました: ${error.message}`);
        } finally {
            setPwLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">システム設定</h2>
                    <p className="text-gray-500">通知先や外部連携、セキュリティの設定を行います。</p>
                </div>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <Mail size={14} className="text-primary" /> 管理者メールアドレス
                            </label>
                            <input
                                type="email"
                                value={settings.adminEmail}
                                onChange={(e) => setSettings({ ...settings, adminEmail: e.target.value })}
                                placeholder="admin@example.com"
                                className="w-full p-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-primary text-sm font-bold"
                            />
                            <p className="text-[10px] text-gray-400">通知（GAS経由）の送信先となるメールアドレスです。</p>
                        </div>

                        <div className="space-y-3">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <Globe size={14} className="text-primary" /> GAS WebApp URL
                            </label>
                            <input
                                type="url"
                                value={settings.gasWebAppUrl}
                                onChange={(e) => setSettings({ ...settings, gasWebAppUrl: e.target.value })}
                                placeholder="https://script.google.com/macros/s/.../exec"
                                className="w-full p-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-primary text-sm font-mono"
                            />
                            <p className="text-[10px] text-gray-400">通知送信に使用する Google Apps Script のエンドポイントです。</p>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex items-center gap-2 bg-primary text-white px-10 py-4 rounded-2xl shadow-xl hover:bg-primary-dark transition-all font-bold active:scale-95 disabled:opacity-50"
                    >
                        <Save size={20} />
                        設定を保存する
                    </button>
                </div>
            </form>

            {/* 管理者パスワード変更セクション */}
            <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-6">
                    <h3 className="text-lg font-bold text-gray-700 flex items-center gap-2">
                        <Lock size={20} className="text-primary" />
                        管理者パスワード変更
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">現在のパスワード</label>
                            <input
                                type="password"
                                value={currentPw}
                                onChange={(e) => setCurrentPw(e.target.value)}
                                placeholder="現在のパスワード"
                                className="w-full p-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-primary text-sm"
                                disabled={pwLoading}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">新しいパスワード</label>
                            <input
                                type="password"
                                value={newPw}
                                onChange={(e) => setNewPw(e.target.value)}
                                placeholder="4文字以上"
                                className="w-full p-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-primary text-sm"
                                disabled={pwLoading}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">確認</label>
                            <input
                                type="password"
                                value={confirmPw}
                                onChange={(e) => setConfirmPw(e.target.value)}
                                placeholder="もう一度入力"
                                className="w-full p-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-primary text-sm"
                                disabled={pwLoading}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <button
                        type="submit"
                        disabled={pwLoading}
                        className="flex items-center gap-2 bg-amber-500 text-white px-10 py-4 rounded-2xl shadow-xl hover:bg-amber-600 transition-all font-bold active:scale-95 disabled:opacity-50"
                    >
                        <Lock size={20} />
                        パスワードを変更する
                    </button>
                </div>
            </form>
        </div>
    );
};
