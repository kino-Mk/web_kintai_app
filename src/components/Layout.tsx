import React from 'react';
import { LogOut, User, Calendar, ClipboardList, AlertCircle, Settings, Users, LayoutDashboard } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';

interface LayoutProps {
    isAdmin?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ isAdmin = false }) => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    const navItems = isAdmin ? [
        { path: '/admin', label: 'ダッシュボード', icon: LayoutDashboard, end: true },
        { path: '/admin/employees', label: '従業員', icon: User },
        { path: '/admin/attendance', label: '勤怠/申請', icon: ClipboardList },
        { path: '/admin/rate-overview', label: '出勤率', icon: Users },
        { path: '/admin/calendar', label: 'カレンダー', icon: Calendar },
        { path: '/admin/error-logs', label: 'エラーログ', icon: AlertCircle },
        { path: '/admin/settings', label: '設定', icon: Settings },
    ] : [
        { path: '/', label: 'ホーム', icon: User, end: true },
        ...(isMobile ? [{ path: '/application', label: '申請申告', icon: ClipboardList }] : []),
    ];

    return (
        <div className="min-h-screen bg-gray-50 pb-20 md:pb-0 md:pl-64 transition-all">
            {/* Sidebar (Desktop) */}
            <aside className="fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-gray-100 hidden md:flex flex-col z-50">
                <div className="p-6">
                    <h1 className="text-xl font-bold text-primary flex items-center gap-2">
                        <span className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white text-sm">勤</span>
                        勤怠管理システム
                    </h1>
                </div>

                <nav className="flex-1 px-4 space-y-1">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        return (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                end={item.end}
                                className={({ isActive }) =>
                                    `w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive
                                        ? 'bg-primary text-white shadow-md'
                                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                                    }`
                                }
                            >
                                <Icon size={18} />
                                {item.label}
                            </NavLink>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-gray-50">
                    <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-danger hover:bg-danger-bg transition-colors">
                        <LogOut size={18} />
                        ログアウト
                    </button>
                </div>
            </aside>

            {/* Bottom Nav (Mobile) */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around p-2 md:hidden z-50 shadow-lg">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    return (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            end={item.end}
                            className={({ isActive }) =>
                                `flex flex-col items-center gap-1 p-2 min-w-[64px] rounded-lg transition-colors ${isActive ? 'text-primary' : 'text-gray-400'}`
                            }
                        >
                            <Icon size={20} />
                            <span className="text-[10px] font-medium">{item.label}</span>
                        </NavLink>
                    );
                })}
            </nav>

            {/* Main Content */}
            <main className="max-w-6xl mx-auto p-4 md:p-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <Outlet />
            </main>
        </div>
    );
};
