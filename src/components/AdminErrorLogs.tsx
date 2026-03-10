import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp, limit } from 'firebase/firestore';
import { ErrorLog, COLLECTIONS } from '../types';
import { toDate, formatFullDateTime } from '../utils';
import { AlertCircle, CheckCircle2, Terminal, ChevronDown, ChevronUp, Clock, Globe, User, Trash2 } from 'lucide-react';
import { useModal } from '../contexts/ModalContext';

export const AdminErrorLogs: React.FC = () => {
    const [logs, setLogs] = useState<ErrorLog[]>([]);
    const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const { showAlert, showConfirm } = useModal();

    useEffect(() => {
        const q = query(
            collection(db, COLLECTIONS.ERROR_LOGS),
            orderBy('timestamp', 'desc'),
            limit(50)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ErrorLog[]);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleResolve = async (log: ErrorLog) => {
        if (!(await showConfirm('このエラーを解決済みとしてマークしますか？'))) return;

        try {
            await updateDoc(doc(db, COLLECTIONS.ERROR_LOGS, log.id!), {
                resolved: true,
                resolvedAt: serverTimestamp()
            });
        } catch (error: any) {
            await showAlert(`更新失敗: ${error.message}`);
        }
    };

    const handleDeleteLog = async (logId: string) => {
        if (!(await showConfirm('このエラーログを完全に削除しますか？\n（この操作は元に戻せません）'))) return;

        try {
            await deleteDoc(doc(db, COLLECTIONS.ERROR_LOGS, logId));
            await showAlert('エラーログを削除しました。');
            if (expandedLogId === logId) setExpandedLogId(null);
        } catch (error: any) {
            await showAlert(`削除失敗: ${error.message}`);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">エラーログ</h2>
                    <p className="text-gray-500">直近50件のシステムエラーと実行ログを表示します。</p>
                </div>
            </div>

            <div className="space-y-4">
                {loading ? (
                    <div className="animate-pulse space-y-4">
                        {[...Array(3)].map((_, i) => <div key={i} className="bg-white h-24 rounded-3xl border border-gray-100"></div>)}
                    </div>
                ) : logs.length === 0 ? (
                    <div className="bg-white p-12 rounded-3xl text-center border border-dashed border-gray-200">
                        <p className="text-gray-400 font-bold">現在記録されているエラーはありません。</p>
                    </div>
                ) : (
                    logs.map((log) => (
                        <div
                            key={log.id}
                            className={`bg-white rounded-3xl shadow-sm border transition-all overflow-hidden ${log.resolved ? 'border-gray-100 opacity-60' : 'border-danger-bg'
                                }`}
                        >
                            <div
                                className="p-6 cursor-pointer hover:bg-gray-50/50 flex flex-col md:flex-row justify-between gap-4"
                                onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id!)}
                            >
                                <div className="flex items-start gap-4">
                                    <div className={`p-3 rounded-2xl shrink-0 ${log.resolved ? 'bg-gray-100 text-gray-400' : 'bg-danger-bg text-danger'}`}>
                                        {log.resolved ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="font-bold text-gray-800 line-clamp-1">{log.message}</h3>
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400 font-medium">
                                            <span className="flex items-center gap-1"><Clock size={12} /> {formatFullDateTime(toDate(log.timestamp))}</span>
                                            <span className="bg-gray-50 px-2 py-0.5 rounded text-primary">Context: {log.context || 'N/A'}</span>
                                            {log.screen && <span className="bg-gray-50 px-2 py-0.5 rounded text-gray-500">Screen: {log.screen}</span>}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 self-end md:self-center">
                                    {!log.resolved && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleResolve(log); }}
                                            className="px-4 py-2 bg-success-bg text-success text-xs font-bold rounded-xl hover:bg-success hover:text-white transition-all shadow-sm active:scale-95 whitespace-nowrap"
                                        >
                                            解決済みにする
                                        </button>
                                    )}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteLog(log.id!); }}
                                        className="p-2 text-gray-400 hover:text-danger hover:bg-danger-bg rounded-xl transition-all shadow-sm flex items-center justify-center"
                                        title="エラーログを削除"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                    <div className="text-gray-300">
                                        {expandedLogId === log.id ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                                    </div>
                                </div>
                            </div>

                            {expandedLogId === log.id && (
                                <div className="px-6 pb-6 pt-0 space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                        <div className="p-4 bg-gray-50 rounded-2xl space-y-2">
                                            <div className="flex items-center gap-2 text-gray-500 font-bold uppercase tracking-wider"><Globe size={14} /> URL / UserAgent</div>
                                            <div className="font-mono break-all text-gray-600">{log.url}</div>
                                            <div className="text-[10px] text-gray-400 truncate">{log.userAgent}</div>
                                        </div>
                                        <div className="p-4 bg-gray-50 rounded-2xl space-y-2">
                                            <div className="flex items-center gap-2 text-gray-500 font-bold uppercase tracking-wider"><User size={14} /> User Info</div>
                                            <div className="font-bold text-gray-600">Employee ID: {log.empId || 'Unknown'}</div>
                                        </div>
                                    </div>

                                    <div className="space-y-4 border-t border-gray-100 pt-6">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2"><Terminal size={14} /> Stack Trace</label>
                                            <pre className="bg-gray-900 text-gray-300 p-4 rounded-xl overflow-x-auto text-[10px] font-mono leading-relaxed">
                                                {log.stack || 'No stack trace available'}
                                            </pre>
                                        </div>

                                        {log.consoleLogs && log.consoleLogs.length > 0 && (
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2"><Terminal size={14} /> Console History</label>
                                                <div className="bg-gray-950 text-emerald-400 p-4 rounded-xl space-y-1 font-mono text-[10px] max-h-64 overflow-y-auto custom-scrollbar border border-gray-800">
                                                    {log.consoleLogs.map((entry, i) => (
                                                        <div key={i} className="py-0.5 border-b border-gray-900 last:border-none opacity-80 hover:opacity-100 transition-opacity">
                                                            {entry}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
