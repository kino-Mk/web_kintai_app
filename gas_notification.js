// =============================================
// GAS (Google Apps Script) - 勤怠管理システム通知
// =============================================
// このコードを既存のGASプロジェクトに追加してください。
// 既存の doPost 関数を以下の内容に置き換えてください。

// 管理者通知先メールアドレス
const ADMIN_EMAIL = 'daichi-tamai@soltec-jsc.co.jp';

function doPost(e) {
    try {
        const data = JSON.parse(e.postData.contents);

        // リクエストのタイプに応じて処理を分岐
        if (data.action === 'passwordReset') {
            // 既存のパスワードリセット処理
            return handlePasswordReset(data);
        } else if (data.action === 'notifyApplication') {
            // 勤怠申請通知
            return handleApplicationNotification(data);
        } else if (data.action === 'notifyStampCorrection') {
            // 打刻修正申請通知
            return handleStampCorrectionNotification(data);
        }

        // 後方互換: actionが未指定の場合はパスワードリセットとして処理
        if (data.token) {
            return handlePasswordReset(data);
        }

        return ContentService.createTextOutput(
            JSON.stringify({ success: false, message: '不明なアクションです' })
        ).setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        return ContentService.createTextOutput(
            JSON.stringify({ success: false, message: error.message })
        ).setMimeType(ContentService.MimeType.JSON);
    }
}

// パスワードリセット処理（既存ロジック）
function handlePasswordReset(data) {
    // ※ 既存のパスワードリセット処理をここに移動してください
    // 以下はテンプレートです
    const resetUrl = 'https://kintai-f2c7f.web.app/reset-password.html?token=' + data.token;

    const subject = '【勤怠管理】パスワードリセット';
    const body = `${data.empName} さん\n\nパスワードリセットのリクエストを受け付けました。\n以下のリンクからパスワードを再設定してください（1時間以内に有効）:\n\n${resetUrl}\n\nこのリクエストに心当たりがない場合は、このメールを無視してください。`;

    GmailApp.sendEmail(data.email, subject, body);

    return ContentService.createTextOutput(
        JSON.stringify({ success: true })
    ).setMimeType(ContentService.MimeType.JSON);
}

// 勤怠申請通知
function handleApplicationNotification(data) {
    const subject = `【勤怠管理】${data.empName} さんから${data.type}の申請`;
    const body = [
        `${data.empName} さん（ID: ${data.empId}）から新しい申請が届きました。`,
        '',
        `種別: ${data.type}`,
        `対象日: ${data.date}`,
        data.reason ? `理由: ${data.reason}` : '',
        '',
        '管理者画面から確認・処理してください。',
        'https://kintai-f2c7f.web.app/?mode=admin'
    ].filter(Boolean).join('\n');

    GmailApp.sendEmail(ADMIN_EMAIL, subject, body);

    return ContentService.createTextOutput(
        JSON.stringify({ success: true })
    ).setMimeType(ContentService.MimeType.JSON);
}

// 打刻修正申請通知
function handleStampCorrectionNotification(data) {
    const subject = `【勤怠管理】打刻修正申請 (${data.count}件)`;

    const lines = [
        '打刻修正申請が届きました。',
        '',
        `申請件数: ${data.count} 件`
    ];

    // 各申請の詳細
    if (data.details && data.details.length > 0) {
        lines.push('');
        data.details.forEach((d, i) => {
            const typeLabel = d.type === 'in' ? '出勤' : '退勤';
            lines.push(`${i + 1}. ${d.empName}（${d.empId}）- ${typeLabel} ${d.time}`);
        });
    }

    if (data.reason) {
        lines.push('', `理由: ${data.reason}`);
    }

    lines.push('', '管理者画面から確認・処理してください。');
    lines.push('https://kintai-f2c7f.web.app/?mode=admin');

    GmailApp.sendEmail(ADMIN_EMAIL, subject, lines.join('\n'));

    return ContentService.createTextOutput(
        JSON.stringify({ success: true })
    ).setMimeType(ContentService.MimeType.JSON);
}
