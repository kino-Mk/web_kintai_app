import { useState, useEffect } from 'react'

import { Layout } from './components/Layout'
import { initConsoleIntercept, reportError } from './utils'
import { EmployeeSelection } from './components/EmployeeSelection'
import { AttendanceScreen } from './components/AttendanceScreen'
import { ApplicationScreen } from './components/ApplicationScreen'
import { AdminEmployeeList } from './components/AdminEmployeeList'
import { AdminAttendance } from './components/AdminAttendance'
import { AdminErrorLogs } from './components/AdminErrorLogs'
import { AdminSettings } from './components/AdminSettings'
import { AdminCalendar } from './components/AdminCalendar'
import { AdminDashboard } from './components/AdminDashboard'
import { AdminRateOverview } from './components/AdminRateOverview'
import { PasswordModal } from './components/PasswordModal'
import { ResetPasswordScreen } from './components/ResetPasswordScreen'
import { Settings } from 'lucide-react';
import { Employee, COLLECTIONS, AttendanceRecord } from './types'
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore'
import { db } from './firebase'
import { getStartOfToday } from './utils'

function App() {
    const [activeScreen, setActiveScreen] = useState('selection');
    const [isAdmin, setIsAdmin] = useState(false);
    const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
    const [pendingEmployee, setPendingEmployee] = useState<Employee | null>(null);
    const [attendanceStates, setAttendanceStates] = useState<Record<string, 'in' | 'out'>>({});
    const [resetToken, setResetToken] = useState<string | null>(null);

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    useEffect(() => {
        initConsoleIntercept();

        // URLパラメータで判定
        const params = new URLSearchParams(window.location.search);
        if (params.get('mode') === 'admin') {
            setIsAdmin(true);
            setActiveScreen('admin-dashboard');
        } else if (params.get('token')) {
            setResetToken(params.get('token'));
            setActiveScreen('reset-password');
        }

        // 本日の出勤状態をリアルタイム追跡
        const today = getStartOfToday();
        const q = query(
            collection(db, COLLECTIONS.ATTENDANCE),
            where('timestamp', '>=', today),
            orderBy('timestamp', 'asc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const states: Record<string, 'in' | 'out'> = {};
            snapshot.forEach(doc => {
                const data = doc.data() as AttendanceRecord;
                states[data.empId] = data.type;
            });
            setAttendanceStates(states);
        });

        // グローバルエラー捕捉
        const handleError = (event: ErrorEvent) => {
            reportError(event.error || event.message, 'Global Error');
        };
        window.addEventListener('error', handleError);
        return () => {
            unsubscribe();
            window.removeEventListener('error', handleError);
        };
    }, []);

    const handleNavigate = (screen: string) => {
        setActiveScreen(screen);
    };

    const handleSelectEmployee = async (emp: Employee) => {
        if (isMobile) {
            setPendingEmployee(emp);
        } else {
            setCurrentEmployee(emp);
            setActiveScreen('timeStamp');
        }
    };

    const handlePasswordSuccess = () => {
        if (pendingEmployee) {
            setCurrentEmployee(pendingEmployee);
            setPendingEmployee(null);
            setActiveScreen('timeStamp');
        }
    };

    const handleBackToSelection = () => {
        setCurrentEmployee(null);
        setActiveScreen('selection');
    };

    if (activeScreen === 'reset-password' && resetToken) {
        return (
            <ResetPasswordScreen
                token={resetToken}
                onHome={() => {
                    const url = new URL(window.location.href);
                    url.searchParams.delete('token');
                    window.history.replaceState({}, '', url);
                    setResetToken(null);
                    setActiveScreen('selection');
                }}
            />
        );
    }

    return (
        <>
            <Layout activeScreen={activeScreen} onNavigate={handleNavigate} isAdmin={isAdmin}>
                <div className="space-y-6">
                    {activeScreen === 'selection' && (
                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 text-center">
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">誰が操作しますか？</h2>
                            <p className="text-gray-500 mb-8">従業員を選択して、打刻または申請を行ってください。</p>
                            <EmployeeSelection
                                onSelect={handleSelectEmployee}
                                attendanceStates={attendanceStates}
                            />
                        </div>
                    )}

                    {activeScreen === 'timeStamp' && currentEmployee && (
                        <AttendanceScreen
                            employee={currentEmployee}
                            onBack={handleBackToSelection}
                            onComplete={() => setActiveScreen('selection')}
                            onGoApplication={() => setActiveScreen('application')}
                        />
                    )}

                    {activeScreen === 'application' && currentEmployee && (
                        <ApplicationScreen
                            employee={currentEmployee}
                            onBack={() => setActiveScreen('selection')}
                            onComplete={() => setActiveScreen('selection')}
                        />
                    )}

                    {activeScreen === 'application' && !currentEmployee && (
                        <div className="bg-white p-12 rounded-3xl shadow-sm border border-gray-100 text-center">
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">従業員が選択されていません</h2>
                            <p className="text-gray-500 mb-8">
                                申請を行うには、まずホーム画面から従業員を選択してください。
                            </p>
                            <button
                                onClick={() => setActiveScreen('selection')}
                                className="bg-primary text-white px-8 py-3 rounded-xl font-bold"
                            >
                                ホームへ戻る
                            </button>
                        </div>
                    )}

                    {activeScreen === 'admin-dashboard' && (
                        <AdminDashboard />
                    )}

                    {activeScreen === 'admin-employees' && (
                        <AdminEmployeeList />
                    )}

                    {activeScreen === 'admin-attendance' && (
                        <AdminAttendance />
                    )}

                    {activeScreen === 'admin-rate-overview' && (
                        <AdminRateOverview />
                    )}

                    {activeScreen === 'admin-error-logs' && (
                        <AdminErrorLogs />
                    )}

                    {activeScreen === 'admin-settings' && (
                        <AdminSettings />
                    )}

                    {activeScreen === 'admin-calendar' && (
                        <AdminCalendar />
                    )}

                    {/* Fallback for other admin screens */}
                    {activeScreen.startsWith('admin-') && !['admin-employees', 'admin-attendance', 'admin-error-logs'].includes(activeScreen) && (
                        <div className="bg-white p-12 rounded-3xl shadow-sm border border-gray-100 text-center">
                            <div className="w-16 h-16 bg-primary-light text-primary rounded-full flex items-center justify-center mx-auto mb-6">
                                <Settings className="animate-spin-slow" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">管理者メニュー準備中</h2>
                            <p className="text-gray-500">
                                このセクションは現在 React コンポーネントへ移植中です。<br />
                                しばらくお待ちください。
                            </p>
                        </div>
                    )}
                </div>
            </Layout>

            {pendingEmployee && (
                <PasswordModal
                    employee={pendingEmployee}
                    onSuccess={handlePasswordSuccess}
                    onClose={() => setPendingEmployee(null)}
                />
            )}
        </>
    )
}

export default App
