
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

// Test Telegram Bot Endpoint
app.post('/api/test-telegram', async (req, res) => {
    const { token, chatId } = req.body;
    try {
        const botRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
        const botData = await botRes.json();
        
        if (!botData.ok) throw new Error(botData.description || 'Invalid Token');

        if (chatId) {
            const msgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: `🛡️ *Gourmetta HACCP Portal*\nTest-Nachricht: Der Bot ist erfolgreich verknüpft!`,
                    parse_mode: 'Markdown'
                })
            });
            const msgData = await msgRes.json();
            if (!msgData.ok) throw new Error(msgData.description || 'Message failed');
        }

        res.json({ success: true, bot: botData.result.username });
    } catch (err) {
        console.error("Telegram Test Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// Test Email Endpoint (Optimized for Strato/Gmail)
app.post('/api/test-email', async (req, res) => {
    const { host, port, user, pass, from, secure } = req.body;
    try {
        // Strato usually needs port 465 (secure: true) or 587 (secure: false)
        const transporter = nodemailer.createTransport({
            host, 
            port: parseInt(port), 
            secure: secure || port === '465', 
            auth: { user, pass },
            tls: {
                rejectUnauthorized: false // Helps with some server certificates
            }
        });

        await transporter.verify();

        const info = await transporter.sendMail({
            from: from || user, // Strato MUST have 'from' identical to 'user'
            to: user, // Send to self for testing
            subject: "🛡️ Gourmetta SMTP Test",
            html: `
                <div style="font-family: sans-serif; padding: 40px; background: #f8fafc; color: #1e293b; border-radius: 24px;">
                    <h1 style="color: #2563eb; margin-bottom: 20px;">✅ SMTP Verbindung Erfolgreich</h1>
                    <p>Ihre E-Mail Konfiguration für <b>${host}</b> ist korrekt eingestellt.</p>
                    <hr style="border: 1px solid #e2e8f0; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #94a3b8;">Gesendet am: ${new Date().toLocaleString('de-DE')}</p>
                </div>
            `
        });

        console.log("Email sent: %s", info.messageId);
        res.json({ success: true });
    } catch (err) {
        console.error("SMTP Test Error Details:", err);
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
        res.sendStatus(200);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 Gourmetta Backend running on http://localhost:${PORT}`);
});
