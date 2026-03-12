import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { COLLECTIONS } from '../types';
import { Save, Mail, Globe, Lock } from 'lucide-react';
import { useModal } from '../contexts/ModalContext';
import { hashPassword, verifyPassword } from '../utils';
import { useSettings } from '../hooks/useSettings';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card } from './ui/Card';

export const AdminSettings: React.FC = () => {
    const { data: initialSettings, isLoading } = useSettings();
    const queryClient = useQueryClient();

    const [settings, setSettings] = useState({
        adminEmail: '',
        gasWebAppUrl: ''
    });
    const [saving, setSaving] = useState(false);
    const { showAlert } = useModal();

    // パスワード変更用
    const [currentPw, setCurrentPw] = useState('');
    const [newPw, setNewPw] = useState('');
    const [confirmPw, setConfirmPw] = useState('');
    const [pwLoading, setPwLoading] = useState(false);

    useEffect(() => {
        if (initialSettings) {
            setSettings({
                adminEmail: initialSettings.adminEmail || '',
                gasWebAppUrl: initialSettings.gasWebAppUrl || ''
            });
        }
    }, [initialSettings]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await setDoc(doc(db, COLLECTIONS.SETTINGS, 'system'), {
                ...settings,
                updatedAt: serverTimestamp()
            }, { merge: true });
            
            await queryClient.invalidateQueries({ queryKey: ['settings'] });
            await showAlert('設定を保存しました。');
        } catch (error: any) {
            console.error('Settings save error:', error);
            await showAlert('保存に失敗しました。しばらくしてからお試しください。');
        } finally {
            setSaving(false);
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
                const isValid = await verifyPassword(currentPw, settingsDoc.data().adminPasswordHash);
                if (!isValid) {
                    await showAlert('現在のパスワードが正しくありません。');
                    setPwLoading(false);
                    return;
                }
            }

            // 新しいパスワードをソルト付きハッシュ化して保存
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
            console.error('Password change error:', error);
            await showAlert('パスワード変更に失敗しました。しばらくしてからお試しください。');
        } finally {
            setPwLoading(false);
        }
    };

    if (isLoading) {
        return <div className="p-12 text-center text-gray-400 animate-pulse">設定を読み込み中...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">システム設定</h2>
                    <p className="text-gray-500">通知先や外部連携、セキュリティの設定を行います。</p>
                </div>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
                <Card className="rounded-[2.5rem] p-8 border-gray-100">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <Mail size={14} className="text-primary" /> 管理者メールアドレス
                            </label>
                            <Input
                                type="email"
                                value={settings.adminEmail}
                                onChange={(e) => setSettings({ ...settings, adminEmail: e.target.value })}
                                placeholder="admin@example.com"
                                className="bg-gray-50 border-none font-bold"
                            />
                            <p className="text-[10px] text-gray-400">通知（GAS経由）の送信先となるメールアドレスです。</p>
                        </div>

                        <div className="space-y-3">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <Globe size={14} className="text-primary" /> GAS WebApp URL
                            </label>
                            <Input
                                type="url"
                                value={settings.gasWebAppUrl}
                                onChange={(e) => setSettings({ ...settings, gasWebAppUrl: e.target.value })}
                                placeholder="https://script.google.com/macros/s/.../exec"
                                className="bg-gray-50 border-none font-mono"
                            />
                            <p className="text-[10px] text-gray-400">通知送信に使用する Google Apps Script のエンドポイントです。</p>
                        </div>
                    </div>
                </Card>

                <div className="flex justify-end pt-4">
                    <Button
                        type="submit"
                        isLoading={saving}
                        leftIcon={<Save size={20} />}
                        className="px-10 py-4 rounded-2xl h-[52px]"
                    >
                        設定を保存する
                    </Button>
                </div>
            </form>

            <form onSubmit={handlePasswordChange} className="space-y-4">
                <Card className="rounded-[2.5rem] p-8 border-gray-100 space-y-6">
                    <h3 className="text-lg font-bold text-gray-700 flex items-center gap-2">
                        <Lock size={20} className="text-primary" />
                        管理者パスワード変更
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">現在のパスワード</label>
                            <Input
                                type="password"
                                value={currentPw}
                                onChange={(e) => setCurrentPw(e.target.value)}
                                placeholder="現在のパスワード"
                                disabled={pwLoading}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">新しいパスワード</label>
                            <Input
                                type="password"
                                value={newPw}
                                onChange={(e) => setNewPw(e.target.value)}
                                placeholder="4文字以上"
                                disabled={pwLoading}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">確認</label>
                            <Input
                                type="password"
                                value={confirmPw}
                                onChange={(e) => setConfirmPw(e.target.value)}
                                placeholder="もう一度入力"
                                disabled={pwLoading}
                            />
                        </div>
                    </div>
                </Card>

                <div className="flex justify-end pt-4">
                    <Button
                        type="submit"
                        isLoading={pwLoading}
                        leftIcon={<Lock size={20} />}
                        className="px-10 py-4 h-[52px] rounded-2xl bg-amber-500 hover:bg-amber-600 shadow-amber-500/20"
                    >
                        パスワードを変更する
                    </Button>
                </div>
            </form>
        </div>
    );
};
