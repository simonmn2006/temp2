
import express from 'express';
import mariadb from 'mariadb';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Database connection pool configuration
const pool = mariadb.createPool({
     host: process.env.DB_HOST || 'localhost', 
     user: process.env.DB_USER || 'root', 
     password: process.env.DB_PASSWORD || '',
     database: process.env.DB_NAME || 'gourmetta_haccp',
     connectionLimit: 10,
     acquireTimeout: 10000
});

// Helper to handle queries with improved error logging
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

// --- NEW: Root Route for Status Check ---
app.get('/', (req, res) => {
    res.send(`
        <div style="font-family: sans-serif; padding: 50px; text-align: center; background: #f8fafc; min-height: 100vh;">
            <h1 style="color: #2563eb;">🚀 Gourmetta API Server is RUNNING</h1>
            <p style="color: #64748b; font-size: 1.1rem;">This is the <b>Backend (Port 3001)</b>. It handles your MariaDB database.</p>
            <div style="margin-top: 30px; padding: 20px; background: white; border-radius: 20px; display: inline-block; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
                <p style="font-weight: bold; margin-bottom: 10px;">To use the application:</p>
                <a href="http://localhost:3000" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 12px; font-weight: bold; display: inline-block;">Open http://localhost:3000</a>
            </div>
            <p style="margin-top: 30px; font-size: 0.8rem; color: #94a3b8;">Database: ${process.env.DB_NAME || 'gourmetta_haccp'} | Host: ${process.env.DB_HOST || 'localhost'}</p>
        </div>
    `);
});

// --- API ENDPOINTS ---

// Sync Users
app.get('/api/users', async (req, res) => {
    try {
        const rows = await query('SELECT * FROM users');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/users', async (req, res) => {
    const { id, name, username, password, role, status, facilityId } = req.body;
    try {
        await query('INSERT INTO users (id, name, username, password, role, status, facilityId) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), password=VALUES(password), status=VALUES(status), facilityId=VALUES(facilityId)', 
        [id, name, username, password, role, status, facilityId]);
        res.sendStatus(200);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Sync Facilities
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

// Sync Readings
app.get('/api/readings', async (req, res) => {
    try {
        const rows = await query('SELECT * FROM readings ORDER BY timestamp DESC LIMIT 1000');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/readings', async (req, res) => {
    const { id, targetId, targetType, checkpointName, value, timestamp, userId, facilityId, reason } = req.body;
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
