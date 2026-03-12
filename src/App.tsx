import { useState, useEffect } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
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
import { AdminLoginScreen } from './components/AdminLoginScreen'
import { PasswordModal } from './components/PasswordModal'
import { ResetPasswordScreen } from './components/ResetPasswordScreen'
import { useTodayAttendanceStates } from './hooks/useAttendance'
import { Employee } from './types'

// 管理者画面の保護
function AdminGuard({ children }: { children: React.ReactNode }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    if (!isAuthenticated) return <AdminLoginScreen onSuccess={() => setIsAuthenticated(true)} />;
    return <>{children}</>;
}

function App() {
    const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
    const [pendingEmployee, setPendingEmployee] = useState<Employee | null>(null);
    const navigate = useNavigate();

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // リアルタイム出退勤状態のフェッチ
    const { data: attendanceStates = {} } = useTodayAttendanceStates();

    useEffect(() => {
        initConsoleIntercept();

        const params = new URLSearchParams(window.location.search);
        if (params.get('token')) {
            navigate(`/reset-password?token=${params.get('token')}`, { replace: true });
        } else if (params.get('mode') === 'admin') {
            navigate('/admin', { replace: true });
        }

        const handleError = (event: ErrorEvent) => {
            reportError(event.error || event.message, 'Global Error');
        };
        window.addEventListener('error', handleError);
        return () => window.removeEventListener('error', handleError);
    }, [navigate]);

    const handleSelectEmployee = (emp: Employee) => {
        if (isMobile) {
            setPendingEmployee(emp);
        } else {
            setCurrentEmployee(emp);
            navigate(`/attendance/${emp.id}`);
        }
    };

    const handlePasswordSuccess = () => {
        if (pendingEmployee) {
            setCurrentEmployee(pendingEmployee);
            const targetId = pendingEmployee.id;
            setPendingEmployee(null);
            navigate(`/attendance/${targetId}`);
        }
    };

    return (
        <>
            <Routes>
                {/* 管理者ルート */}
                <Route
                    path="/admin"
                    element={
                        <AdminGuard>
                            <Layout isAdmin={true} />
                        </AdminGuard>
                    }
                >
                    <Route index element={<AdminDashboard />} />
                    <Route path="employees" element={<AdminEmployeeList />} />
                    <Route path="attendance" element={<AdminAttendance />} />
                    <Route path="rate-overview" element={<AdminRateOverview />} />
                    <Route path="error-logs" element={<AdminErrorLogs />} />
                    <Route path="settings" element={<AdminSettings />} />
                    <Route path="calendar" element={<AdminCalendar />} />
                </Route>

                {/* 従業員向けルート */}
                <Route path="/" element={<Layout isAdmin={false} />}>
                    <Route index element={
                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 text-center">
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">誰が操作しますか？</h2>
                            <p className="text-gray-500 mb-8">従業員を選択して、打刻または申請を行ってください。</p>
                            <EmployeeSelection
                                onSelect={handleSelectEmployee}
                                attendanceStates={attendanceStates}
                            />
                        </div>
                    } />
                    
                    <Route path="attendance/:empId" element={
                        currentEmployee ? (
                            <AttendanceScreen
                                employee={currentEmployee}
                                onBack={() => {
                                    setCurrentEmployee(null);
                                    navigate('/');
                                }}
                                onComplete={() => navigate('/')}
                                onGoApplication={() => navigate('/application')}
                            />
                        ) : (
                            <div className="text-center p-8">従業員情報がありません。<br/><button onClick={() => navigate('/')} className="text-primary mt-4 underline">ホームへ</button></div>
                        )
                    } />
                    
                    <Route path="application" element={
                        currentEmployee ? (
                            <ApplicationScreen
                                employee={currentEmployee}
                                onBack={() => navigate('/')}
                                onComplete={() => navigate('/')}
                            />
                        ) : (
                            <div className="bg-white p-12 rounded-3xl shadow-sm border border-gray-100 text-center">
                                <h2 className="text-2xl font-bold text-gray-800 mb-2">従業員が選択されていません</h2>
                                <p className="text-gray-500 mb-8">申請を行うには、まずホーム画面から従業員を選択してください。</p>
                                <button
                                    onClick={() => navigate('/')}
                                    className="bg-primary text-white px-8 py-3 rounded-xl font-bold"
                                >
                                    ホームへ戻る
                                </button>
                            </div>
                        )
                    } />
                </Route>

                {/* パスワードリセット */}
                <Route path="/reset-password" element={
                    <ResetPasswordScreen
                        token={new URLSearchParams(window.location.search).get('token') || ''}
                        onHome={() => {
                            navigate('/', { replace: true });
                        }}
                    />
                } />
            </Routes>

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

