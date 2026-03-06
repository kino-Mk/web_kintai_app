import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ModalContextType {
    showAlert: (message: string) => Promise<void>;
    showConfirm: (message: string) => Promise<boolean>;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [modal, setModal] = useState<{
        isOpen: boolean;
        message: string;
        type: 'alert' | 'confirm';
        resolve: (value: any) => void;
    } | null>(null);

    const showAlert = (message: string) => {
        return new Promise<void>((resolve) => {
            setModal({ isOpen: true, message, type: 'alert', resolve });
        });
    };

    const showConfirm = (message: string) => {
        return new Promise<boolean>((resolve) => {
            setModal({ isOpen: true, message, type: 'confirm', resolve });
        });
    };

    const handleClose = (value: boolean) => {
        if (modal) {
            modal.resolve(value);
            setModal(null);
        }
    };

    return (
        <ModalContext.Provider value={{ showAlert, showConfirm }}>
            {children}
            {modal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 transform animate-in zoom-in-95 duration-200">
                        <div className="text-gray-800 text-lg mb-6 whitespace-pre-wrap">
                            {modal.message}
                        </div>
                        <div className="flex justify-end gap-3">
                            {modal.type === 'confirm' && (
                                <button
                                    onClick={() => handleClose(false)}
                                    className="px-6 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                                >
                                    キャンセル
                                </button>
                            )}
                            <button
                                onClick={() => handleClose(true)}
                                className="px-6 py-2 rounded-xl bg-primary text-white hover:bg-primary-dark transition-all shadow-lg active:scale-95"
                            >
                                {modal.type === 'confirm' ? 'はい' : 'OK'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ModalContext.Provider>
    );
};

export const useModal = () => {
    const context = useContext(ModalContext);
    if (!context) throw new Error('useModal must be used within a ModalProvider');
    return context;
};
