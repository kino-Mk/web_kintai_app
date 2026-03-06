// === 設定 ===
const RESET_PAGE_BASE_URL = 'https://kino-mk.github.io/web_kintai_app/reset-password.html';
const ADMIN_EMAIL = 'daichi-tamai@soltec-jsc.co.jp';

// === メイン処理 ===

// WebApp の POST エンドポイント
function doPost(e) {
    try {
        const data = JSON.parse(e.postData.contents);

        // action パラメータで処理を分岐
        if (data.action === 'notifyApplication') {
            return handleApplicationNotification(data);
        } else if (data.action === 'notifyStampCorrection') {
            return handleStampCorrectionNotification(data);
        }

        // action未指定 = 既存のパスワードリセット処理（後方互換）
        const email = data.email;
        const token = data.token;
        const empName = data.empName || '従業員';

        if (!email || !token) {
            return jsonResponse({ success: false, message: 'パラメータが不足しています。' });
        }

        const resetLink = `${RESET_PAGE_BASE_URL}?token=${token}`;
        sendResetEmail(email, empName, resetLink);

        return jsonResponse({ success: true, message: 'メールを送信しました。' });

    } catch (error) {
        console.error('doPost error:', error);
        return jsonResponse({ success: false, message: `メール送信エラー: ${error.message}` });
    }
}

// テスト用: GETリクエストで動作確認
function doGet(e) {
    return jsonResponse({ status: 'ok', message: 'GAS WebApp is running.' });
}

// === パスワードリセットメール（既存） ===

function sendResetEmail(toEmail, empName, resetLink) {
    const subject = '【勤怠管理】パスワードリセットのご案内';
    const body = `${empName} さん

パスワードリセットのリクエストを受け付けました。
以下のリンクからパスワードを再設定してください。

━━━━━━━━━━━━━━━━━━━━
${resetLink}
━━━━━━━━━━━━━━━━━━━━

※ このリンクの有効期限は1時間です。
※ 心当たりのない場合は、このメールを無視してください。

--
勤怠管理システム (自動送信)`;

    GmailApp.sendEmail(toEmail, subject, body, { name: '勤怠管理システム' });
    console.log('Reset email sent to:', toEmail);
}

// === 勤怠申請通知メール（新規） ===

function handleApplicationNotification(data) {
    const subject = `【勤怠管理】${data.empName} さんから${data.type}の申請`;
    const reasonText = data.reason ? `理由: ${data.reason}\n` : '';
    const body = `${data.empName} さん（ID: ${data.empId}）から新しい申請が届きました。

種別: ${data.type}
対象日: ${data.date}
${reasonText}
管理者画面から確認・処理してください。
https://kintai-f2c7f.web.app/?mode=admin

--
勤怠管理システム (自動送信)`;

    GmailApp.sendEmail(ADMIN_EMAIL, subject, body, { name: '勤怠管理システム' });
    console.log('Application notification sent to:', ADMIN_EMAIL);

    return jsonResponse({ success: true });
}

// === 打刻修正申請通知メール（新規） ===

function handleStampCorrectionNotification(data) {
    const subject = `【勤怠管理】打刻修正申請 (${data.count}件)`;
    const lines = [
        '打刻修正申請が届きました。\n',
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
        lines.push(`\n理由: ${data.reason}`);
    }

    lines.push(
        '',
        '管理者画面から確認・処理してください。',
        'https://kintai-f2c7f.web.app/?mode=admin',
        '',
        '--',
        '勤怠管理システム (自動送信)'
    );

    GmailApp.sendEmail(ADMIN_EMAIL, subject, lines.join('\n'), { name: '勤怠管理システム' });
    console.log('Stamp correction notification sent to:', ADMIN_EMAIL);

    return jsonResponse({ success: true });
}

// === ユーティリティ ===

function jsonResponse(data) {
    return ContentService
        .createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
}
