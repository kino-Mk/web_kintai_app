import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { COLLECTIONS } from '../types';
import { Save, Mail, Globe, Lock, ShieldCheck } from 'lucide-react';
import { useModal } from '../contexts/ModalContext';

export const AdminSettings: React.FC = () => {
    const [settings, setSettings] = useState({
        adminEmail: '',
        gasWebAppUrl: '',
        adminPassword: ''
    });
    const [loading, setLoading] = useState(true);
    const { showAlert } = useModal();

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
            });
            await showAlert('設定を保存しました。');
        } catch (error: any) {
            await showAlert(`保存失敗: ${error.message}`);
        } finally {
            setLoading(false);
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

                    <div className="pt-6 border-t border-gray-100">
                        <div className="space-y-3 max-w-sm">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <Lock size={14} className="text-primary" /> 管理画面パスワード
                            </label>
                            <div className="relative">
                                <input
                                    type="password"
                                    value={settings.adminPassword}
                                    onChange={(e) => setSettings({ ...settings, adminPassword: e.target.value })}
                                    placeholder="••••••••"
                                    className="w-full p-4 rounded-2xl bg-gray-100/50 border-none focus:ring-2 focus:ring-primary text-sm font-bold"
                                />
                                <ShieldCheck className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300" size={20} />
                            </div>
                            <p className="text-[10px] text-gray-400">共有端末で管理画面を制限する場合に設定します（現在はURL引数で制御中）。</p>
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
        </div>
    );
};
