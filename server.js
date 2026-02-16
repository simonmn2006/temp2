
import express from 'express';
import mariadb from 'mariadb';
import cors from 'cors';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

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
        console.error("❌ Database Error:", err.message);
        throw err;
    } finally {
        if (conn) conn.release();
    }
}

async function sendAlertEmail(config, alert, recipients) {
    if (!config || !recipients.length) return;
    const transporter = nodemailer.createTransport({
        host: config.host, port: parseInt(config.port), secure: config.secure || config.port === '465',
        auth: { user: config.user, pass: config.pass },
        tls: { rejectUnauthorized: false }
    });
    try {
        await transporter.sendMail({
            from: config.user, to: recipients.join(', '),
            subject: `🚨 ALARM: ${alert.targetName} @ ${alert.facilityName}`,
            html: `<div style="font-family:sans-serif;border:1px solid #eee;padding:20px;border-radius:15px;">
                   <h1 style="color:#e11d48;">HACCP ALARM</h1>
                   <p><b>Standort:</b> ${alert.facilityName}</p>
                   <p><b>Objekt:</b> ${alert.targetName}</p>
                   <p style="font-size:24px;font-weight:bold;color:#e11d48;">${alert.value.toFixed(1)}°C</p>
                   <p>Limit: ${alert.min} bis ${alert.max}°C</p>
                   <p style="font-size:12px;color:#999;">Mitarbeiter: ${alert.userName}</p>
                   </div>`
        });
        console.log(`✅ Alert email sent to ${recipients.length} users`);
    } catch (err) { console.error("❌ Email Error:", err.message); }
}

async function sendAlertTelegram(config, alert) {
    if (!config?.botToken || !config?.chatId) return;
    const msg = `🚨 *ALARM: ${alert.facilityName}*\n${alert.targetName}: *${alert.value.toFixed(1)}°C*\n(Soll: ${alert.min}-${alert.max})\n👤 ${alert.userName}`;
    try {
        await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: config.chatId, text: msg, parse_mode: 'Markdown' })
        });
        console.log("✅ Telegram alert dispatched");
    } catch (err) { console.error("❌ Telegram Error:", err.message); }
}

app.get('/api/users', async (req, res) => {
    try { res.json(await query('SELECT * FROM users')); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/users', async (req, res) => {
    const { id, name, username, password, email, role, status, facilityId, emailAlerts, telegramAlerts, allFacilitiesAlerts } = req.body;
    try {
        await query(`INSERT INTO users (id, name, username, password, email, role, status, facilityId, emailAlerts, telegramAlerts, allFacilitiesAlerts) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
                     ON DUPLICATE KEY UPDATE name=VALUES(name), password=VALUES(password), email=VALUES(email), status=VALUES(status), facilityId=VALUES(facilityId), 
                     emailAlerts=VALUES(emailAlerts), telegramAlerts=VALUES(telegramAlerts), allFacilitiesAlerts=VALUES(allFacilitiesAlerts)`, 
        [id, name, username, password, email, role, status, facilityId, !!emailAlerts, !!telegramAlerts, !!allFacilitiesAlerts]);
        res.sendStatus(200);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/facilities', async (req, res) => {
    try { res.json(await query('SELECT * FROM facilities')); } catch (err) { res.status(500).json({ error: err.message }); }
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
    try { res.json(await query('SELECT * FROM readings ORDER BY timestamp DESC LIMIT 1000')); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/readings', async (req, res) => {
    const { id, targetId, targetType, checkpointName, value, timestamp, userId, facilityId, reason, alertData, smtpConfig, telegramConfig } = req.body;
    try {
        await query('INSERT INTO readings (id, targetId, targetType, checkpointName, value, timestamp, userId, facilityId, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', 
        [id, targetId, targetType, checkpointName, value, timestamp, userId, facilityId, reason]);

        if (alertData) {
            console.log(`🔔 Alert Triggered for facility ${facilityId}. Searching recipients...`);
            const alertUsers = await query(`
                SELECT email, telegramAlerts, emailAlerts FROM users 
                WHERE (emailAlerts = 1 OR telegramAlerts = 1) 
                AND (allFacilitiesAlerts = 1 OR facilityId = ?)
                AND status = 'Active'`, 
            [facilityId]);

            console.log(`Found ${alertUsers.length} potential alert recipients.`);

            const emailRecipients = alertUsers
                .filter(u => u.emailAlerts === 1 && u.email && u.email.includes('@'))
                .map(u => u.email);

            const hasTelegramRecipient = alertUsers.some(u => u.telegramAlerts === 1);

            if (emailRecipients.length > 0 && smtpConfig) {
                sendAlertEmail(smtpConfig, alertData, emailRecipients);
            }
            if (hasTelegramRecipient && telegramConfig) {
                sendAlertTelegram(telegramConfig, alertData);
            }
        }
        res.sendStatus(200);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/forms', async (req, res) => {
    try { res.json(await query('SELECT * FROM form_responses ORDER BY timestamp DESC')); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/forms', async (req, res) => {
    const { id, formId, facilityId, userId, timestamp, answers, signature } = req.body;
    try {
        await query('INSERT INTO form_responses (id, formId, facilityId, userId, timestamp, answers, signature) VALUES (?, ?, ?, ?, ?, ?, ?)', 
        [id, formId, facilityId, userId, timestamp, JSON.stringify(answers), signature]);
        res.sendStatus(200);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => { console.log(`🚀 Gourmetta Backend running on port ${PORT}`); });
