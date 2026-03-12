export const SYSTEM_CONSTANTS = {
    // 認証関連
    AUTH: {
        MAX_LOGIN_ATTEMPTS: 5,
        LOCKOUT_SECONDS: 30,
        PASSWORD_MIN_LENGTH: 4,
    },
    // UI表示関連
    UI: {
        TOAST_DURATION_MS: 3000,
        PAGINATION_LIMIT: 50,
    },
    // アプリケーション全体
    APP: {
        NAME: "勤怠・有休管理システム",
        VERSION: "1.0.0",
        SUPPORT_EMAIL: "support@example.com", // 適宜変更
    }
} as const;
