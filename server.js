
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

// Helper to send email
async function sendAlertEmail(config, recipient, alertDetails) {
    const transporter = nodemailer.createTransport({
        host: config.host,
        port: parseInt(config.port),
        secure: config.secure, 
        auth: { user: config.user, pass: config.pass }
    });

    const html = `
        <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
            <h2 style="color: #e11d48;">⚠️ HACCP Temperatur Alarm</h2>
            <div style="background: #fff1f2; padding: 15px; border-radius: 10px; border: 1px solid #fecdd3;">
                <p><b>Standort:</b> ${alertDetails.facilityName}</p>
                <p><b>Gerät:</b> ${alertDetails.targetName}</p>
                <p><b>Messwert:</b> <span style="color: #e11d48; font-size: 1.2em;">${alertDetails.value}°C</span></p>
                <p><b>Zeit:</b> ${new Date(alertDetails.timestamp).toLocaleString('de-DE')}</p>
            </div>
        </div>
    `;

    return await transporter.sendMail({
        from: config.from || config.user,
        to: recipient,
        subject: `⚠️ Alarm: ${alertDetails.facilityName}`,
        html: html
    });
}

// Test Telegram Bot Endpoint
app.post('/api/test-telegram', async (req, res) => {
    const { token } = req.body;
    try {
        const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
        const data = await response.json();
        if (data.ok) {
            res.json({ success: true, bot: data.result.username });
        } else {
            throw new Error(data.description);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Test Email Endpoint
app.post('/api/test-email', async (req, res) => {
    const { host, port, user, pass, from, secure } = req.body;
    try {
        const transporter = nodemailer.createTransport({
            host, port: parseInt(port), secure,
            auth: { user, pass }
        });
        await transporter.verify();
        await transporter.sendMail({
            from: from || user,
            to: user,
            subject: "Gourmetta SMTP Test",
            text: "Verbindung erfolgreich."
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
    const { id, name, username, password, email, role, status, facilityId, emailAlerts, telegramAlerts, telegramChatId, allFacilitiesAlerts } = req.body;
    try {
        await query(`
            INSERT INTO users (id, name, username, password, email, role, status, facilityId, emailAlerts, telegramAlerts, telegramChatId, allFacilitiesAlerts) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
            ON DUPLICATE KEY UPDATE 
                name=VALUES(name), password=VALUES(password), email=VALUES(email), 
                status=VALUES(status), facilityId=VALUES(facilityId), 
                emailAlerts=VALUES(emailAlerts), telegramAlerts=VALUES(telegramAlerts), 
                telegramChatId=VALUES(telegramChatId), allFacilitiesAlerts=VALUES(allFacilitiesAlerts)`, 
        [id, name, username, password, email, role, status, facilityId, emailAlerts, telegramAlerts, telegramChatId, allFacilitiesAlerts]);
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
    const { id, targetId, targetType, checkpointName, value, timestamp, userId, facilityId, reason, alertData, smtpConfig } = req.body;
    try {
        await query('INSERT INTO readings (id, targetId, targetType, checkpointName, value, timestamp, userId, facilityId, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', 
        [id, targetId, targetType, checkpointName, value, timestamp, userId, facilityId, reason]);
        
        // Handle Alarms (SMTP already implemented, Telegram logic follows pattern)
        // ...
        
        res.sendStatus(200);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 Gourmetta Backend running on http://localhost:${PORT}`);
});
