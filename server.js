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
        secure: config.secure, // true for 465, false for other ports
        auth: {
            user: config.user,
            pass: config.pass
        }
    });

    const html = `
        <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
            <h2 style="color: #e11d48;">⚠️ HACCP Temperatur Alarm</h2>
            <p>Es wurde eine Grenzwertüberschreitung festgestellt:</p>
            <div style="background: #fff1f2; padding: 15px; border-radius: 10px; border: 1px solid #fecdd3;">
                <p><b>Standort:</b> ${alertDetails.facilityName}</p>
                <p><b>Gerät/Menü:</b> ${alertDetails.targetName} (${alertDetails.checkpointName})</p>
                <p><b>Messwert:</b> <span style="color: #e11d48; font-size: 1.2em;">${alertDetails.value}°C</span></p>
                <p><b>Limit:</b> ${alertDetails.min}°C bis ${alertDetails.max}°C</p>
                <p><b>Zeitpunkt:</b> ${new Date(alertDetails.timestamp).toLocaleString('de-DE')}</p>
                <p><b>Erfasst von:</b> ${alertDetails.userName}</p>
                <p><b>Grund:</b> ${alertDetails.reason || 'Keine Angabe'}</p>
            </div>
            <p style="margin-top: 20px; font-size: 0.8em; color: #64748b;">Gourmetta HACCP Zentrale - Automatisches Benachrichtigungssystem</p>
        </div>
    `;

    return await transporter.sendMail({
        from: config.from || config.user,
        to: recipient,
        subject: `⚠️ Alarm: ${alertDetails.facilityName} - ${alertDetails.targetName}`,
        html: html
    });
}

app.get('/', (req, res) => {
    res.send(`
        <div style="font-family: sans-serif; padding: 50px; text-align: center; background: #f8fafc; min-height: 100vh;">
            <h1 style="color: #2563eb;">🚀 Gourmetta API Server is RUNNING</h1>
            <p style="color: #64748b; font-size: 1.1rem;">Backend is Active with SMTP Support.</p>
        </div>
    `);
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
            text: "SMTP Verbindung erfolgreich hergestellt."
        });
        res.json({ success: true });
    } catch (err) {
        console.error("SMTP Test Failed:", err);
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
    const { id, targetId, targetType, checkpointName, value, timestamp, userId, facilityId, reason, alertData, smtpConfig } = req.body;
    try {
        await query('INSERT INTO readings (id, targetId, targetType, checkpointName, value, timestamp, userId, facilityId, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', 
        [id, targetId, targetType, checkpointName, value, timestamp, userId, facilityId, reason]);
        
        // If it's a violation (reason exists) AND smtp is configured, find recipients
        if (reason && smtpConfig && alertData) {
            const recipients = await query(`
                SELECT email FROM users 
                WHERE emailAlerts = 1 
                AND email IS NOT NULL 
                AND (allFacilitiesAlerts = 1 OR facilityId = ?)
            `, [facilityId]);

            for (const r of recipients) {
                try {
                    await sendAlertEmail(smtpConfig, r.email, { ...alertData, reason });
                } catch (e) {
                    console.error(`Failed to send alert to ${r.email}:`, e.message);
                }
            }
        }
        
        res.sendStatus(200);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 Gourmetta Backend running on http://localhost:${PORT}`);
});