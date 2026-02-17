
import express from 'express';
import mariadb from 'mariadb';
import cors from 'cors';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));

const pool = mariadb.createPool({
     host: process.env.DB_HOST || 'localhost', 
     user: process.env.DB_USER || 'root', 
     password: process.env.DB_PASSWORD || '',
     database: process.env.DB_NAME || 'gourmetta_haccp',
     connectionLimit: 15,
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

const formatSqlDate = (isoString) => {
    if (!isoString) return null;
    return isoString.includes('T') ? isoString.slice(0, 19).replace('T', ' ') : isoString;
};

// Generic CRUD helper (Post only for simplicity in sync logic)
async function handleUpsert(table, data, res) {
    const keys = Object.keys(data);
    const placeholders = keys.map(() => '?').join(',');
    const updates = keys.map(k => `${k}=VALUES(${k})`).join(',');
    const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updates}`;
    try {
        await query(sql, Object.values(data).map(v => typeof v === 'object' && v !== null ? JSON.stringify(v) : v));
        res.sendStatus(200);
    } catch (err) { res.status(500).json({ error: err.message }); }
}

// 1. Core Entities
app.get('/api/users', async (req, res) => { try { res.json(await query('SELECT * FROM users')); } catch (e) { res.status(500).send(e); } });
app.post('/api/users', (req, res) => handleUpsert('users', req.body, res));

app.get('/api/facilities', async (req, res) => { try { res.json(await query('SELECT * FROM facilities')); } catch (e) { res.status(500).send(e); } });
app.post('/api/facilities', (req, res) => handleUpsert('facilities', req.body, res));
app.delete('/api/facilities/:id', async (req, res) => { try { await query('DELETE FROM facilities WHERE id=?', [req.params.id]); res.sendStatus(200); } catch (e) { res.status(500).send(e); } });

app.get('/api/refrigerators', async (req, res) => { try { res.json(await query('SELECT * FROM refrigerators')); } catch (e) { res.status(500).send(e); } });
app.post('/api/refrigerators', (req, res) => handleUpsert('refrigerators', req.body, res));
app.delete('/api/refrigerators/:id', async (req, res) => { try { await query('DELETE FROM refrigerators WHERE id=?', [req.params.id]); res.sendStatus(200); } catch (e) { res.status(500).send(e); } });

app.get('/api/menus', async (req, res) => { try { res.json(await query('SELECT * FROM menus')); } catch (e) { res.status(500).send(e); } });
app.post('/api/menus', (req, res) => handleUpsert('menus', req.body, res));
app.delete('/api/menus/:id', async (req, res) => { try { await query('DELETE FROM menus WHERE id=?', [req.params.id]); res.sendStatus(200); } catch (e) { res.status(500).send(e); } });

// 2. Settings & Config
app.get('/api/facility_types', async (req, res) => { try { res.json(await query('SELECT * FROM facility_types')); } catch (e) { res.status(500).send(e); } });
app.post('/api/facility_types', (req, res) => handleUpsert('facility_types', req.body, res));
app.delete('/api/facility_types/:id', async (req, res) => { try { await query('DELETE FROM facility_types WHERE id=?', [req.params.id]); res.sendStatus(200); } catch (e) { res.status(500).send(e); } });

app.get('/api/cooking_methods', async (req, res) => { try { res.json(await query('SELECT * FROM cooking_methods')); } catch (e) { res.status(500).send(e); } });
app.post('/api/cooking_methods', (req, res) => handleUpsert('cooking_methods', req.body, res));
app.delete('/api/cooking_methods/:id', async (req, res) => { try { await query('DELETE FROM cooking_methods WHERE id=?', [req.params.id]); res.sendStatus(200); } catch (e) { res.status(500).send(e); } });

app.get('/api/fridge_types', async (req, res) => { try { res.json(await query('SELECT * FROM fridge_types')); } catch (e) { res.status(500).send(e); } });
app.post('/api/fridge_types', (req, res) => handleUpsert('fridge_types', req.body, res));
app.delete('/api/fridge_types/:id', async (req, res) => { try { await query('DELETE FROM fridge_types WHERE id=?', [req.params.id]); res.sendStatus(200); } catch (e) { res.status(500).send(e); } });

app.get('/api/holidays', async (req, res) => { try { res.json(await query('SELECT * FROM holidays')); } catch (e) { res.status(500).send(e); } });
app.post('/api/holidays', (req, res) => handleUpsert('holidays', req.body, res));
app.delete('/api/holidays/:id', async (req, res) => { try { await query('DELETE FROM holidays WHERE id=?', [req.params.id]); res.sendStatus(200); } catch (e) { res.status(500).send(e); } });

app.get('/api/facility_exceptions', async (req, res) => { try { res.json(await query('SELECT * FROM facility_exceptions')); } catch (e) { res.status(500).send(e); } });
app.post('/api/facility_exceptions', (req, res) => handleUpsert('facility_exceptions', req.body, res));
app.delete('/api/facility_exceptions/:id', async (req, res) => { try { await query('DELETE FROM facility_exceptions WHERE id=?', [req.params.id]); res.sendStatus(200); } catch (e) { res.status(500).send(e); } });

app.get('/api/reminders', async (req, res) => { try { res.json(await query('SELECT * FROM reminders')); } catch (e) { res.status(500).send(e); } });
app.post('/api/reminders', (req, res) => handleUpsert('reminders', req.body, res));
app.delete('/api/reminders/:id', async (req, res) => { try { await query('DELETE FROM reminders WHERE id=?', [req.params.id]); res.sendStatus(200); } catch (e) { res.status(500).send(e); } });

// 3. Operational Data
app.get('/api/form_templates', async (req, res) => { try { res.json(await query('SELECT * FROM form_templates')); } catch (e) { res.status(500).send(e); } });
app.post('/api/form_templates', (req, res) => handleUpsert('form_templates', req.body, res));
app.delete('/api/form_templates/:id', async (req, res) => { try { await query('DELETE FROM form_templates WHERE id=?', [req.params.id]); res.sendStatus(200); } catch (e) { res.status(500).send(e); } });

app.get('/api/assignments', async (req, res) => { try { res.json(await query('SELECT * FROM assignments')); } catch (e) { res.status(500).send(e); } });
app.post('/api/assignments', (req, res) => handleUpsert('assignments', req.body, res));
app.delete('/api/assignments/:id', async (req, res) => { try { await query('DELETE FROM assignments WHERE id=?', [req.params.id]); res.sendStatus(200); } catch (e) { res.status(500).send(e); } });

app.get('/api/readings', async (req, res) => { try { res.json(await query('SELECT * FROM readings ORDER BY timestamp DESC LIMIT 1000')); } catch (e) { res.status(500).send(e); } });
app.post('/api/readings', async (req, res) => {
    const data = { ...req.body, timestamp: formatSqlDate(req.body.timestamp) };
    const { alertData, smtpConfig, telegramConfig, ...dbData } = data;
    try {
        await handleUpsert('readings', dbData, { sendStatus: () => {} });
        if (alertData) {
            const alertUsers = await query(`SELECT email, telegramAlerts, emailAlerts FROM users WHERE (emailAlerts=1 OR telegramAlerts=1) AND (allFacilitiesAlerts=1 OR facilityId=?) AND status='Active'`, [dbData.facilityId]);
            const emails = alertUsers.filter(u => u.emailAlerts && u.email).map(u => u.email);
            if (emails.length && smtpConfig) {
                const transporter = nodemailer.createTransport({ host: smtpConfig.host, port: smtpConfig.port, secure: smtpConfig.port==='465', auth: { user: smtpConfig.user, pass: smtpConfig.pass }});
                await transporter.sendMail({ from: smtpConfig.user, to: emails.join(','), subject: `🚨 ALARM: ${alertData.targetName}`, html: `<p>${alertData.targetName} @ ${alertData.facilityName}: <b>${alertData.value}°C</b></p>` });
            }
        }
        res.sendStatus(200);
    } catch (e) { res.status(500).send(e); }
});

app.get('/api/form_responses', async (req, res) => { try { res.json(await query('SELECT * FROM form_responses ORDER BY timestamp DESC')); } catch (e) { res.status(500).send(e); } });
app.post('/api/form_responses', (req, res) => {
    const data = { ...req.body, timestamp: formatSqlDate(req.body.timestamp) };
    handleUpsert('form_responses', data, res);
});

app.get('/api/audit_logs', async (req, res) => { try { res.json(await query('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 500')); } catch (e) { res.status(500).send(e); } });
app.post('/api/audit_logs', (req, res) => handleUpsert('audit_logs', req.body, res));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => { console.log(`🚀 Gourmetta Backend running on port ${PORT}`); });
