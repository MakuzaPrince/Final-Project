import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const DialogContext = createContext(null);
export const useDialog = () => useContext(DialogContext);

const ICONS = {
    success: <CheckCircle size={16} className="text-emerald-500 shrink-0 mt-0.5" />,
    error:   <XCircle    size={16} className="text-red-500    shrink-0 mt-0.5" />,
    warning: <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />,
    info:    <Info       size={16} className="text-blue-500   shrink-0 mt-0.5" />,
};

function DialogUI({ dialog, onConfirm, onCancel, inputRef }) {
    const isAction = dialog.type === 'confirm' || dialog.type === 'prompt';
    const borderColor = {
        success: 'border-emerald-200 dark:border-emerald-800',
        error:   'border-red-200 dark:border-red-800',
        warning: 'border-amber-200 dark:border-amber-800',
        info:    'border-blue-200 dark:border-blue-800',
    }[dialog.subtype] || 'border-gray-200 dark:border-gray-700';

    return (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[99999] w-full max-w-sm px-4 animate-in slide-in-from-top-4 duration-200">
            <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border ${borderColor} overflow-hidden`}>
                <div className="p-4 flex items-start gap-3">
                    {dialog.subtype && ICONS[dialog.subtype]}
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 flex-1 leading-snug whitespace-pre-line">
                        {dialog.message}
                    </p>
                    {dialog.type === 'toast' && (
                        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0 -mt-0.5">
                            <X size={14} />
                        </button>
                    )}
                </div>

                {dialog.type === 'prompt' && (
                    <div className="px-4 pb-2">
                        <input
                            ref={inputRef}
                            autoFocus
                            type="text"
                            placeholder={dialog.placeholder || ''}
                            onKeyDown={e => { if (e.key === 'Enter') onConfirm(inputRef.current?.value ?? ''); }}
                            className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                )}

                {isAction && (
                    <div className="flex gap-2 px-4 pb-4 pt-1">
                        <button
                            onClick={onCancel}
                            className="flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => dialog.type === 'prompt' ? onConfirm(inputRef.current?.value ?? '') : onConfirm(true)}
                            className="flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-blue-600 text-white hover:bg-blue-700 transition"
                        >
                            OK
                        </button>
                    </div>
                )}

                {/* Auto-dismiss progress bar for toasts */}
                {dialog.type === 'toast' && (
                    <div className="h-0.5 bg-gray-100 dark:bg-gray-700">
                        <div
                            key={dialog._id}
                            className="h-full bg-blue-500"
                            style={{ animation: 'dialogShrink 4s linear forwards' }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

export const DialogProvider = ({ children }) => {
    const [dialog, setDialog] = useState(null);
    const timerRef = useRef(null);
    const inputRef = useRef(null);
    const idRef = useRef(0);

    const clearTimer = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
    }, []);

    useEffect(() => () => clearTimer(), [clearTimer]);

    const showToast = useCallback((message, subtype = 'info') => {
        clearTimer();
        idRef.current += 1;
        setDialog({ type: 'toast', message, subtype, _id: idRef.current });
        timerRef.current = setTimeout(() => setDialog(null), 4000);
    }, [clearTimer]);

    const showConfirm = useCallback((message) => new Promise(resolve => {
        clearTimer();
        setDialog({ type: 'confirm', message, subtype: 'warning', resolve });
    }), [clearTimer]);

    const showPrompt = useCallback((message, placeholder = '') => new Promise(resolve => {
        clearTimer();
        setDialog({ type: 'prompt', message, subtype: 'info', placeholder, resolve });
    }), [clearTimer]);

    const handleConfirm = useCallback((value = true) => {
        setDialog(prev => { prev?.resolve?.(value); return null; });
    }, []);

    const handleCancel = useCallback(() => {
        setDialog(prev => {
            prev?.resolve?.(prev.type === 'prompt' ? null : false);
            return null;
        });
    }, []);

    return (
        <DialogContext.Provider value={{ showToast, showConfirm, showPrompt }}>
            {children}
            {dialog && (
                <DialogUI
                    dialog={dialog}
                    onConfirm={handleConfirm}
                    onCancel={handleCancel}
                    inputRef={inputRef}
                />
            )}
        </DialogContext.Provider>
    );
};
