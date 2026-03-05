// === 設定 ===
var RESET_PAGE_BASE_URL = 'https://kino-mk.github.io/web_kintai_app/reset-password.html';
var ADMIN_EMAIL = 'daichi-tamai@soltec-jsc.co.jp';

// === メイン処理 ===

// WebApp の POST エンドポイント
function doPost(e) {
    try {
        var data = JSON.parse(e.postData.contents);

        // action パラメータで処理を分岐
        if (data.action === 'notifyApplication') {
            return handleApplicationNotification(data);
        } else if (data.action === 'notifyStampCorrection') {
            return handleStampCorrectionNotification(data);
        }

        // action未指定 = 既存のパスワードリセット処理（後方互換）
        var email = data.email;
        var token = data.token;
        var empName = data.empName || '従業員';

        if (!email || !token) {
            return jsonResponse({ success: false, message: 'パラメータが不足しています。' });
        }

        var resetLink = RESET_PAGE_BASE_URL + '?token=' + token;
        sendResetEmail(email, empName, resetLink);

        return jsonResponse({ success: true, message: 'メールを送信しました。' });

    } catch (error) {
        console.error('doPost error:', error);
        return jsonResponse({ success: false, message: 'メール送信エラー: ' + error.message });
    }
}

// テスト用: GETリクエストで動作確認
function doGet(e) {
    return jsonResponse({ status: 'ok', message: 'GAS WebApp is running.' });
}

// === パスワードリセットメール（既存） ===

function sendResetEmail(toEmail, empName, resetLink) {
    var subject = '【勤怠管理】パスワードリセットのご案内';
    var body = empName + ' さん\n\n'
        + 'パスワードリセットのリクエストを受け付けました。\n'
        + '以下のリンクからパスワードを再設定してください。\n\n'
        + '━━━━━━━━━━━━━━━━━━━━\n'
        + resetLink + '\n'
        + '━━━━━━━━━━━━━━━━━━━━\n\n'
        + '※ このリンクの有効期限は1時間です。\n'
        + '※ 心当たりのない場合は、このメールを無視してください。\n\n'
        + '--\n'
        + '勤怠管理システム (自動送信)';

    GmailApp.sendEmail(toEmail, subject, body, { name: '勤怠管理システム' });
    console.log('Reset email sent to:', toEmail);
}

// === 勤怠申請通知メール（新規） ===

function handleApplicationNotification(data) {
    var subject = '【勤怠管理】' + data.empName + ' さんから' + data.type + 'の申請';
    var body = data.empName + ' さん（ID: ' + data.empId + '）から新しい申請が届きました。\n\n'
        + '種別: ' + data.type + '\n'
        + '対象日: ' + data.date + '\n'
        + (data.reason ? '理由: ' + data.reason + '\n' : '')
        + '\n管理者画面から確認・処理してください。\n'
        + 'https://kintai-f2c7f.web.app/?mode=admin\n\n'
        + '--\n'
        + '勤怠管理システム (自動送信)';

    GmailApp.sendEmail(ADMIN_EMAIL, subject, body, { name: '勤怠管理システム' });
    console.log('Application notification sent to:', ADMIN_EMAIL);

    return jsonResponse({ success: true });
}

// === 打刻修正申請通知メール（新規） ===

function handleStampCorrectionNotification(data) {
    var subject = '【勤怠管理】打刻修正申請 (' + data.count + '件)';
    var lines = [];
    lines.push('打刻修正申請が届きました。');
    lines.push('');
    lines.push('申請件数: ' + data.count + ' 件');

    // 各申請の詳細
    if (data.details && data.details.length > 0) {
        lines.push('');
        for (var i = 0; i < data.details.length; i++) {
            var d = data.details[i];
            var typeLabel = d.type === 'in' ? '出勤' : '退勤';
            lines.push((i + 1) + '. ' + d.empName + '（' + d.empId + '）- ' + typeLabel + ' ' + d.time);
        }
    }

    if (data.reason) {
        lines.push('');
        lines.push('理由: ' + data.reason);
    }

    lines.push('');
    lines.push('管理者画面から確認・処理してください。');
    lines.push('https://kintai-f2c7f.web.app/?mode=admin');
    lines.push('');
    lines.push('--');
    lines.push('勤怠管理システム (自動送信)');

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
