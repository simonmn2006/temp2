
CREATE DATABASE IF NOT EXISTS gourmetta_haccp;
USE gourmetta_haccp;

-- 1. USERS
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    role ENUM('Admin', 'User', 'Manager', 'SuperAdmin') DEFAULT 'User',
    status ENUM('Active', 'Inactive') DEFAULT 'Active',
    facilityId VARCHAR(50),
    emailAlerts BOOLEAN DEFAULT FALSE,
    telegramAlerts BOOLEAN DEFAULT FALSE,
    telegramChatId VARCHAR(50),
    allFacilitiesAlerts BOOLEAN DEFAULT FALSE
);

-- 2. FACILITY TYPES
CREATE TABLE IF NOT EXISTS facility_types (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

-- 3. COOKING METHODS
CREATE TABLE IF NOT EXISTS cooking_methods (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    checkpoints JSON NOT NULL
);

-- 4. FRIDGE TYPES
CREATE TABLE IF NOT EXISTS fridge_types (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    checkpoints JSON NOT NULL
);

-- 5. FACILITIES
CREATE TABLE IF NOT EXISTS facilities (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    refrigeratorCount INT DEFAULT 0,
    typeId VARCHAR(50),
    cookingMethodId VARCHAR(50),
    supervisorId VARCHAR(50),
    FOREIGN KEY (supervisorId) REFERENCES users(id) ON DELETE SET NULL
);

-- 6. REFRIGERATORS
CREATE TABLE IF NOT EXISTS refrigerators (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    facilityId VARCHAR(50),
    currentTemp DECIMAL(5,2) DEFAULT 4.0,
    status VARCHAR(20) DEFAULT 'Optimal',
    typeName VARCHAR(100),
    FOREIGN KEY (facilityId) REFERENCES facilities(id) ON DELETE CASCADE
);

-- 7. MENUS
CREATE TABLE IF NOT EXISTS menus (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

-- 8. FORM TEMPLATES
CREATE TABLE IF NOT EXISTS form_templates (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    questions JSON NOT NULL,
    requiresSignature BOOLEAN DEFAULT TRUE,
    createdAt DATE
);

-- 9. ASSIGNMENTS
CREATE TABLE IF NOT EXISTS assignments (
    id VARCHAR(50) PRIMARY KEY,
    targetType VARCHAR(50) NOT NULL,
    targetId VARCHAR(50) NOT NULL,
    resourceType VARCHAR(50) NOT NULL,
    resourceId VARCHAR(50) NOT NULL,
    frequency VARCHAR(20) DEFAULT 'daily',
    frequencyDay INT DEFAULT 1,
    startDate DATE,
    endDate DATE,
    skipWeekend BOOLEAN DEFAULT TRUE,
    skipHolidays BOOLEAN DEFAULT TRUE
);

-- 10. READINGS
CREATE TABLE IF NOT EXISTS readings (
    id VARCHAR(50) PRIMARY KEY,
    targetId VARCHAR(50) NOT NULL,
    targetType VARCHAR(50) NOT NULL,
    checkpointName VARCHAR(100) NOT NULL,
    value DECIMAL(5,2) NOT NULL,
    timestamp DATETIME NOT NULL,
    userId VARCHAR(50),
    facilityId VARCHAR(50),
    reason TEXT,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (facilityId) REFERENCES facilities(id) ON DELETE CASCADE
);

-- 11. FORM RESPONSES
CREATE TABLE IF NOT EXISTS form_responses (
    id VARCHAR(50) PRIMARY KEY,
    formId VARCHAR(50) NOT NULL,
    facilityId VARCHAR(50),
    userId VARCHAR(50),
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    answers JSON,
    signature LONGTEXT,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (facilityId) REFERENCES facilities(id) ON DELETE CASCADE
);

-- 12. HOLIDAYS
CREATE TABLE IF NOT EXISTS holidays (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    startDate DATE NOT NULL,
    endDate DATE NOT NULL
);

-- 13. EXCLUDED FACILITIES
CREATE TABLE IF NOT EXISTS facility_exceptions (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    facilityIds JSON NOT NULL,
    reason TEXT,
    startDate DATE NOT NULL,
    endDate DATE NOT NULL
);

-- 14. REMINDERS
CREATE TABLE IF NOT EXISTS reminders (
    id VARCHAR(50) PRIMARY KEY,
    time VARCHAR(5) NOT NULL,
    label VARCHAR(255) NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    days JSON NOT NULL,
    targetRoles JSON NOT NULL
);

-- 15. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(50) PRIMARY KEY,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    userId VARCHAR(50),
    userName VARCHAR(100),
    action VARCHAR(50),
    entity VARCHAR(50),
    details TEXT
);

-- Default Content
INSERT IGNORE INTO users (id, name, username, password, role, status) 
VALUES ('U-SUPER', 'System SuperAdmin', 'super', 'super', 'SuperAdmin', 'Active');

INSERT IGNORE INTO form_templates (id, title, description, questions, requiresSignature, createdAt)
VALUES ('F-SUPERVISOR-AUDIT', '🛡️ Supervisor Audit (System)', 'Präsenzprüfung', '[{"id": "Q-SUPER-VISIT", "text": "Hat der Supervisor heute persönlich am Standort vorbeigeschaut?", "type": "yesno"}]', 1, '2024-01-01');
