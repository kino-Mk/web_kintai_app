import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { FallbackProps } from 'react-error-boundary';

export const GlobalErrorFallback: React.FC<FallbackProps> = ({ error, resetErrorBoundary }) => {
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-3xl shadow-xl p-8 text-center border-t-8 border-danger animate-in fade-in zoom-in-95 duration-300">
                <div className="w-20 h-20 bg-danger/10 text-danger rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertTriangle size={40} />
                </div>
                
                <h1 className="text-2xl font-bold text-gray-800 mb-2">予期せぬエラーが発生しました</h1>
                <p className="text-gray-500 mb-6">
                    申し訳ありません。システムで問題が発生しました。再度お試しいただくか、管理者にお問い合わせください。
                </p>

                <div className="bg-gray-50 p-4 rounded-xl text-left mb-8 border border-gray-100 overflow-x-auto">
                    <p className="text-sm font-mono text-danger font-bold mb-1">エラー詳細:</p>
                    <p className="text-xs font-mono text-gray-600 whitespace-pre-wrap break-all">
                        {error instanceof Error ? error.message : String(error)}
                    </p>
                </div>

                <div className="flex gap-4 max-w-xs mx-auto">
                    <button
                        onClick={resetErrorBoundary}
                        className="flex-1 bg-primary text-white p-4 rounded-xl flex items-center justify-center gap-2 font-bold hover:bg-primary-dark transition-colors shadow-lg shadow-primary/30"
                    >
                        <RefreshCw size={20} />
                        再試行
                    </button>
                    <button
                        onClick={() => window.location.href = '/'}
                        className="flex-1 bg-gray-100 text-gray-700 p-4 rounded-xl flex items-center justify-center gap-2 font-bold hover:bg-gray-200 transition-colors"
                    >
                        ホームへ
                    </button>
                </div>
            </div>
        </div>
    );
};
