import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

import { ModalProvider } from './contexts/ModalContext'
import { ErrorBoundary } from 'react-error-boundary'
import { GlobalErrorFallback } from './components/GlobalErrorFallback'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HashRouter } from 'react-router-dom'

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            staleTime: 1000 * 60 * 5, // 5分キャッシュ
        },
    },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ErrorBoundary FallbackComponent={GlobalErrorFallback}>
            <QueryClientProvider client={queryClient}>
                <HashRouter>
                    <ModalProvider>
                        <App />
                    </ModalProvider>
                </HashRouter>
            </QueryClientProvider>
        </ErrorBoundary>
    </React.StrictMode>,
)
