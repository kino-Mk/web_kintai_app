export const COLLECTIONS = {
    EMPLOYEES: 'employees',
    ATTENDANCE: 'attendance',
    APPLICATIONS: 'applications',
    HOLIDAYS: 'holidays',
    LEAVE_GRANTS: 'leaveGrants',
    SYSTEM: 'system',
    SETTINGS: 'settings',
    PASSWORD_RESETS: 'passwordResetTokens',
    STAMP_CORRECTIONS: 'stampCorrections',
    ERROR_LOGS: 'errorLogs'
} as const;

export type AttendanceType = 'in' | 'out';
export type ApplicationStatus = 'pending' | 'approved' | 'rejected' | 'completed';

export interface Employee {
    id: string;
    name: string;
    password?: string;
    email?: string;
    paidLeave?: number;
    docId?: string;
    isHidden?: boolean;
}

export interface AttendanceRecord {
    id?: string;
    empId: string;
    empName: string;
    type: AttendanceType;
    timestamp: any; // Firestore Timestamp
    remark?: string;
    createdAt?: any;
}

export interface Application {
    id?: string;
    empId: string;
    empName: string;
    type: string;
    date: string;
    startTime?: string;
    endTime?: string;
    reason: string;
    status: ApplicationStatus;
    createdAt: any;
    updatedAt?: any;
}

export interface StampCorrection {
    id?: string;
    empId: string;
    empName: string;
    attendanceDocId: string;
    attendanceType: AttendanceType;
    attendanceTime: any;
    reason: string;
    status: ApplicationStatus;
    createdAt: any;
    updatedAt?: any;
}

export interface ErrorLog {
    id?: string;
    message: string;
    stack?: string;
    context?: string;
    screen?: string;
    empId?: string;
    url?: string;
    userAgent?: string;
    timestamp: any;
    resolved: boolean;
    resolvedAt?: any;
    consoleLogs?: string[];
}
