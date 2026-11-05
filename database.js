const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "primehealth.db");
const db = new Database(dbPath);

db.pragma("foreign_keys = ON");

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL,
        passwordSalt BLOB NOT NULL,
        passwordHash BLOB NOT NULL);
        
    CREATE TABLE IF NOT EXISTS doctors (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        speciality TEXT,
        email TEXT NOT NULL UNIQUE,
        phone TEXT,
        passwordSalt BLOB NOT NULL,
        passwordHash BLOB NOT NULL);
        
    CREATE TABLE IF NOT EXISTS patients (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        encryptedData BLOB,
        salt BLOB,
        iv BLOB
        );
    
    CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY,
        patientId INTEGER NOT NULL,
        doctorId INTEGER NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        createdAt TEXT,
        FOREIGN KEY (patientId) REFERENCES patients(id),
        FOREIGN KEY (doctorId) REFERENCES doctors(id)
        );  
`);

module.exports = db;