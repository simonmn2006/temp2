
CREATE DATABASE IF NOT EXISTS gourmetta_haccp;
USE gourmetta_haccp;

-- Table for user management including alert settings and roles
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

-- Table for facilities (locations)
CREATE TABLE IF NOT EXISTS facilities (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    refrigeratorCount INT DEFAULT 0,
    typeId VARCHAR(50),
    cookingMethodId VARCHAR(50),
    supervisorId VARCHAR(50),
    FOREIGN KEY (supervisorId) REFERENCES users(id) ON DELETE SET NULL
);

-- Table for temperature readings and HACCP logs
CREATE TABLE IF NOT EXISTS readings (
    id VARCHAR(50) PRIMARY KEY,
    targetId VARCHAR(50) NOT NULL, -- Refrigerator ID or Menu ID
    targetType VARCHAR(50) NOT NULL, -- 'refrigerator' or 'menu'
    checkpointName VARCHAR(100) NOT NULL, -- e.g., 'Luft', 'Kern'
    value DECIMAL(5,2) NOT NULL,
    timestamp DATETIME NOT NULL,
    userId VARCHAR(50),
    facilityId VARCHAR(50),
    reason TEXT, -- Reason for out-of-range values
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (facilityId) REFERENCES facilities(id) ON DELETE CASCADE
);

-- Table for form responses (Checklists)
CREATE TABLE IF NOT EXISTS form_responses (
    id VARCHAR(50) PRIMARY KEY,
    formId VARCHAR(50) NOT NULL,
    facilityId VARCHAR(50),
    userId VARCHAR(50),
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    answers JSON, -- Stores questions and answers as a JSON object
    signature LONGTEXT, -- Base64 encoded signature data
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (facilityId) REFERENCES facilities(id) ON DELETE CASCADE
);

-- Table for audit logs (System changes)
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(50) PRIMARY KEY,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    userId VARCHAR(50),
    userName VARCHAR(100),
    action VARCHAR(50),
    entity VARCHAR(50),
    details TEXT
);

-- Insert initial SuperAdmin if not exists
-- Username: super | Password: super
INSERT IGNORE INTO users (id, name, username, password, role, status) 
VALUES ('U-SUPER', 'System SuperAdmin', 'super', 'super', 'SuperAdmin', 'Active');
