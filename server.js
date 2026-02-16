
import express from 'express';
import mariadb from 'mariadb';
import cors from 'cors';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const pool = mariadb.createPool({
     host: process.env.DB_HOST || 'localhost', 
     user: process.env.DB_USER || 'root', 
     password: process.env.DB_PASSWORD || '',
     database: process.env.DB_NAME || 'gourmetta_haccp',
     connectionLimit: 10,
     acquireTimeout: 10000
});

async function query(sql, params) {
    let conn;
    try {
        conn = await pool.getConnection();
        return await conn.query(sql, params);
    } catch (err) {
        console.error("❌ Database Query Error:", err.message);
        throw err;
    } finally {
        if (conn) conn.release();
    }
}

// Internal function to send Alert Email
async function sendAlertEmail(config, alert, recipients) {
    if (!config || !recipients.length) return;
    
    const transporter = nodemailer.createTransport({
        host: config.host,
        port: parseInt(config.port),
        secure: config.secure || config.port === '465',
        auth: { user: config.user, pass: config.pass },
        tls: { rejectUnauthorized: false }
    });

    const htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 24px; overflow: hidden;">
            <div style="background: #e11d48; padding: 30px; text-align: center; color: white;">
                <h1 style="margin: 0; font-size: 24px; text-transform: uppercase;">⚠️ Temperatur Alarm</h1>
                <p style="margin: 5px 0 0 0; opacity: 0.8;">Kritische Abweichung festgestellt</p>
            </div>
            <div style="padding: 40px; background: white; color: #1e293b;">
                <p style="font-size: 16px; margin-bottom: 20px;">Hallo,</p>
                <p style="line-height: 1.6;">Am Standort <b>${alert.facilityName}</b> wurde ein Grenzwert überschritten:</p>
                
                <div style="background: #fff1f2; border: 1px solid #fecdd3; padding: 20px; border-radius: 16px; margin: 20px 0;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="color: #64748b; font-size: 12px; text-transform: uppercase;">Gerät/Menü</td><td style="font-weight: bold;">${alert.targetName}</td></tr>
                        <tr><td style="color: #64748b; font-size: 12px; text-transform: uppercase;">Prüfpunkt</td><td style="font-weight: bold;">${alert.checkpointName}</td></tr>
                        <tr><td style="color: #64748b; font-size: 12px; text-transform: uppercase;">Gemessen</td><td style="color: #e11d48; font-weight: 900; font-size: 20px;">${alert.value.toFixed(1)}°C</td></tr>
                        <tr><td style="color: #64748b; font-size: 12px; text-transform: uppercase;">Limit</td><td style="font-weight: bold;">${alert.min}°C bis ${alert.max}°C</td></tr>
                    </table>
                </div>

                <p style="font-size: 12px; color: #94a3b8; margin-top: 30px;">
                    Erfasst von: ${alert.userName}<br>
                    Zeitpunkt: ${new Date(alert.timestamp).toLocaleString('de-DE')}
                </p>
            </div>
            <div style="background: #f8fafc; padding: 20px; text-align: center; font-size: 11px; color: #94a3b8;">
                Dies ist eine automatische Benachrichtigung vom Gourmetta HACCP Portal.
            </div>
        </div>
    `;

    try {
        await transporter.sendMail({
            from: config.user, // Strato compatibility: from must match authenticated user
            to: recipients.join(', '),
            subject: `🚨 ALARM: ${alert.targetName} @ ${alert.facilityName}`,
            html: htmlContent
        });
        console.log("✅ Alert emails sent successfully.");
    } catch (err) {
        console.error("❌ Failed to send alert emails:", err.message);
    }
}

// Internal function to send Alert Telegram
async function sendAlertTelegram(config, alert) {
    if (!config?.botToken || !config?.chatId) return;

    const message = `🚨 *TEMPERATUR ALARM*\n\n` +
                    `📍 *Standort:* ${alert.facilityName}\n` +
                    `❄️ *Gerät:* ${alert.targetName}\n` +
                    `🔍 *Punkt:* ${alert.checkpointName}\n\n` +
                    `🔥 *Wert:* ${alert.value.toFixed(1)}°C\n` +
                    `📏 *Soll:* ${alert.min}° bis ${alert.max}°C\n\n` +
                    `👤 *Mitarbeiter:* ${alert.userName}\n` +
                    `⏰ *Zeit:* ${new Date(alert.timestamp).toLocaleTimeString('de-DE')}`;

    try {
        await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: config.chatId,
                text: message,
                parse_mode: 'Markdown'
            })
        });
        console.log("✅ Telegram alert sent.");
    } catch (err) {
        console.error("❌ Failed to send Telegram alert:", err.message);
    }
}

// Test Telegram Bot Endpoint
app.post('/api/test-telegram', async (req, res) => {
    const { token, chatId } = req.body;
    try {
        const botRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
        const botData = await botRes.json();
        if (!botData.ok) throw new Error(botData.description || 'Invalid Token');

        if (chatId) {
            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: `🛡️ *Gourmetta HACCP Portal*\nTest-Nachricht: Der Bot ist bereit für Alarme!`,
                    parse_mode: 'Markdown'
                })
            });
        }
        res.json({ success: true, bot: botData.result.username });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Test Email Endpoint
app.post('/api/test-email', async (req, res) => {
    const { host, port, user, pass, secure } = req.body;
    try {
        const transporter = nodemailer.createTransport({
            host, port: parseInt(port), secure: secure || port === '465',
            auth: { user, pass },
            tls: { rejectUnauthorized: false }
        });
        await transporter.verify();
        await transporter.sendMail({
            from: user,
            to: user,
            subject: "🛡️ Gourmetta SMTP Test",
            html: `<h1 style="color: #2563eb;">✅ SMTP OK</h1><p>Ihre Konfiguration für <b>${host}</b> funktioniert.</p>`
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/users', async (req, res) => {
    try {
        const rows = await query('SELECT * FROM users');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/users', async (req, res) => {
    const { id, name, username, password, email, role, status, facilityId, emailAlerts, telegramAlerts, allFacilitiesAlerts } = req.body;
    try {
        await query(`
            INSERT INTO users (id, name, username, password, email, role, status, facilityId, emailAlerts, telegramAlerts, allFacilitiesAlerts) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
            ON DUPLICATE KEY UPDATE 
                name=VALUES(name), password=VALUES(password), email=VALUES(email), 
                status=VALUES(status), facilityId=VALUES(facilityId), 
                emailAlerts=VALUES(emailAlerts), telegramAlerts=VALUES(telegramAlerts), 
                allFacilitiesAlerts=VALUES(allFacilitiesAlerts)`, 
        [id, name, username, password, email, role, status, facilityId, emailAlerts, telegramAlerts, allFacilitiesAlerts]);
        res.sendStatus(200);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/facilities', async (req, res) => {
    try {
        const rows = await query('SELECT * FROM facilities');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/facilities', async (req, res) => {
    const { id, name, refrigeratorCount, typeId, cookingMethodId, supervisorId } = req.body;
    try {
        await query('INSERT INTO facilities (id, name, refrigeratorCount, typeId, cookingMethodId, supervisorId) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), supervisorId=VALUES(supervisorId)', 
        [id, name, refrigeratorCount, typeId, cookingMethodId, supervisorId]);
        res.sendStatus(200);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/readings', async (req, res) => {
    try {
        const rows = await query('SELECT * FROM readings ORDER BY timestamp DESC LIMIT 1000');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/readings', async (req, res) => {
    const { id, targetId, targetType, checkpointName, value, timestamp, userId, facilityId, reason, alertData, smtpConfig, telegramConfig } = req.body;
    try {
        // 1. Save Reading to Database
        await query('INSERT INTO readings (id, targetId, targetType, checkpointName, value, timestamp, userId, facilityId, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', 
        [id, targetId, targetType, checkpointName, value, timestamp, userId, facilityId, reason]);

        // 2. Handle Automatic Alarms if reading is out of range
        if (alertData) {
            // Find all eligible alert recipients for this facility
            const alertUsers = await query(`
                SELECT email, telegramAlerts FROM users 
                WHERE (emailAlerts = 1 OR telegramAlerts = 1) 
                AND (allFacilitiesAlerts = 1 OR facilityId = ?)
                AND status = 'Active'`, 
            [facilityId]);

            // Filter for Email recipients
            const emailRecipients = alertUsers
                .filter(u => u.email && u.email.includes('@'))
                .map(u => u.email);

            // Filter for Telegram activation check
            const hasTelegramRecipient = alertUsers.some(u => u.telegramAlerts === 1);

            // Send via SMTP
            if (emailRecipients.length > 0 && smtpConfig) {
                sendAlertEmail(smtpConfig, alertData, emailRecipients);
            }

            // Send via Telegram (Global ID)
            if (hasTelegramRecipient && telegramConfig) {
                sendAlertTelegram(telegramConfig, alertData);
            }
        }

        res.sendStatus(200);
    } catch (err) { 
        console.error("Readings POST Error:", err.message);
        res.status(500).json({ error: err.message }); 
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 Gourmetta Backend running on http://localhost:${PORT}`);
});
