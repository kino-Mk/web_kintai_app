import React, { useState, useEffect } from 'react';
import { useModal } from '../contexts/ModalContext';
import { Lock, Terminal, ShieldAlert } from 'lucide-react';

interface Props {
    onUnlock: () => void;
}

const KONAMI_CODE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

export const AdminLock: React.FC<Props> = ({ onUnlock }) => {
    const [konamiIndex, setKonamiIndex] = useState(0);
    const [isDummyModalOpen, setIsDummyModalOpen] = useState(false);
    const [password, setPassword] = useState('');
    const [failCount, setFailCount] = useState(0);
    const [isScaring, setIsScaring] = useState(false);
    const [scareLogs, setScareLogs] = useState<string[]>([]);
    const { showAlert } = useModal();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const key = e.key === ' ' ? 'Space' : e.key;
            if (key === KONAMI_CODE[konamiIndex]) {
                const nextIndex = konamiIndex + 1;
                if (nextIndex === KONAMI_CODE.length) {
                    setKonamiIndex(0);
                    onUnlock();
                    showAlert('システムロックを解除しました。');
                } else {
                    setKonamiIndex(nextIndex);
                }
            } else {
                setKonamiIndex(0);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [konamiIndex, onUnlock, showAlert]);

    const handleDummySubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const nextFailCount = failCount + 1;
        if (nextFailCount >= 3) {
            triggerScare();
        } else {
            setFailCount(nextFailCount);
            setPassword('');
            showAlert('パスワードが正しくありません。');
        }
    };

    const triggerScare = async () => {
        setIsDummyModalOpen(false);
        setIsScaring(true);
        const messages = [
            "Initializing system override...",
            "Bypassing security protocols... [DONE]",
            "CRITICAL: Unauthorized access detected.",
            "Initiating self-destruct sequence to protect data...",
            "Wiping Firestore collection: employees...",
            "Wiping Firestore collection: attendance...",
            "Purging images/...",
            "Deleting sw.js...",
            "Formatting primary partition...",
            "FATAL: Permission denied in kernel space.",
            "Attempting recursive deletion... [FORCED]",
            "System resources exhausted.",
            "I/O Error: Sector 0x882A corrupted.",
            "Memory leak detected @ 0xFF02A388",
            "ERROR: Root filesystem is read-only.",
            "Remounting / as RW...",
            "Deleting /index.html...",
            "Deleting /js/admin.js...",
            "CRITICAL ERROR: Kernel panic!"
        ];

        for (let i = 0; i < 60; i++) {
            const msg = messages[Math.floor(Math.random() * messages.length)];
            setScareLogs(prev => [...prev.slice(-20), `[${new Date().toLocaleTimeString()}] ${msg}`]);
            await new Promise(r => setTimeout(r, Math.max(20, 100 - i * 2)));
        }

        // Final fatal error is handled by the UI state
    };

    if (isScaring) {
        return (
            <div className="fixed inset-0 z-[9999] bg-black text-green-500 font-mono p-4 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto space-y-1">
                    {scareLogs.map((log, i) => <div key={i}>{log}</div>)}
                    <div className="animate-pulse">_</div>
                </div>
                {scareLogs.length > 50 && (
                    <div className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                        <div className="bg-red-600 text-white p-12 rounded-3xl shadow-2xl border-4 border-white animate-bounce text-center">
                            <ShieldAlert size={80} className="mx-auto mb-6" />
                            <h1 className="text-6xl font-black mb-4 italic">FATAL ERROR</h1>
                            <p className="text-2xl font-bold">SYSTEM DESTROYED</p>
                            <p className="mt-4 opacity-70">Please contact the creator.</p>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[1000] bg-gray-900/95 backdrop-blur-md flex items-center justify-center p-6 text-center">
            <div className="max-w-md w-full">
                <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-white/20">
                    <Lock size={40} className="text-white/40" />
                </div>
                <h2 className="text-3xl font-bold text-white mb-2 italic tracking-tighter uppercase underline decoration-primary decoration-4 underline-offset-8">
                    System Locked
                </h2>
                <p className="text-white/40 mb-12 font-mono text-sm tracking-widest uppercase">
                    Unauthorized access is strictly prohibited.
                </p>

                <button
                    onClick={() => setIsDummyModalOpen(true)}
                    className="group relative overflow-hidden bg-white/5 border border-white/10 px-8 py-4 rounded-2xl text-white/60 font-bold hover:bg-primary hover:text-white hover:border-primary transition-all active:scale-95"
                >
                    <span className="relative z-10 flex items-center gap-2">
                        <Terminal size={20} />
                        Administrative Access
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-white/10 to-primary/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                </button>
            </div>

            {isDummyModalOpen && (
                <div className="fixed inset-0 z-[1100] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-bold text-gray-800 mb-6">管理者認証</h3>
                        <form onSubmit={handleDummySubmit} className="space-y-4">
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="パスワードを入力..."
                                className="w-full p-4 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-primary text-center text-lg"
                                autoFocus
                            />
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsDummyModalOpen(false)}
                                    className="flex-1 py-4 text-gray-400 font-bold hover:bg-gray-50 rounded-xl transition-colors"
                                >
                                    キャンセル
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-4 bg-primary text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:bg-primary-dark transition-all active:scale-95"
                                >
                                    ログイン
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
