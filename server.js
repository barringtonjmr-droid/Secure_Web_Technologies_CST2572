require("dotenv").config();

const express = require("express");
const path = require("path");
const crypto = require("crypto");
const db = require("./database");

console.log("Database:", !!db);
console.log("Prepare type:", typeof db.prepare);

const app = express();

//Creating a consistent one-way hash of an email address, 
// to check for duplicates
function hashPatientEmail(email) {
    return crypto
        .createHmac("sha256", process.env.EMAIL_HASH_SECRET)
        .update(email.trim().toLowerCase())
        .digest("hex")
}

app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "cst_project.html"))
})

app.get("/api/doctors", (req,res) => {
    try{
        const doctors = db.prepare("SELECT id, name, email, speciality, phone FROM doctors").all();
        res.json(doctors);
    } catch (error) {
        console.error("Error fetching doctors:", error);
        res.status(500).json({ error: "Internal server error" });
    }
})
app.post("/api/doctors", (req, res) => {
    try {
        const {
            name,
            speciality,
            email,
            phone,
            passwordSalt,
            passwordHash
        } = req.body;

        if(
            !name || !speciality || !email || 
            !passwordSalt || !passwordHash
        ) {
            return res.status(400).json({
                 error: "Missing required fields" });
        }

        const insertDoctor = db.prepare(`
            INSERT INTO doctors (
            name, speciality, email, phone,
            passwordSalt, passwordHash
            )
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        const result = insertDoctor.run(
            name.trim(),
            speciality.trim(),
            email.trim().toLowerCase(),
            phone || null,
            Buffer.from(passwordSalt, "base64"),
            Buffer.from(passwordHash, "base64")
        );

        res.status(201).json({
            message: "Doctor registered successfully",
            doctorId: result.lastInsertRowid
        });
    } catch (error) {
        console.error("Error registering doctor:", error);

        res.status(500).json({ error: "Doctor account creation failed" });
}
});

app.put("/api/doctors/:id/password", (req, res) => {
    try {
        const doctorId = Number(req.params.id);
        const { passwordSalt, passwordHash } = req.body;

        if(
            !Number.isInteger(doctorId) || doctorId <= 0 ||
            !passwordSalt || !passwordHash
        ) {
            return res.status(400).json({
                error: "Invalid doctor ID or missing password data"
            });
        }

        const result = db.prepare(`
            UPDATE doctors
            SET passwordSalt = ?, passwordHash = ?
            WHERE id = ?
        `).run(
            Buffer.from(passwordSalt, "base64"),
            Buffer.from(passwordHash, "base64"),
            doctorId
        );

        if (result.changes === 0) {
            return res.status(404).json({
                error: "Doctor not found"
            });
        }

        res.json({
            message: "Password updated successfully"
        });
    } catch (error) {
        console.error("Error updating password:", error);
        res.status(500).json({ error: "Password update failed" });
    }
});

//Doctor login using SQLIte database
app.post("/api/doctors/login", (req, res) => {
    try {
        const { email, password } = req.body;

        if(!email || !password) {
            return res.status(400).json({
                error: "Email and password are required"
            });
        }

        const doctor = db.prepare(`
            SELECT id, name, email, speciality, phone, 
                    passwordSalt, passwordHash
            FROM doctors
            WHERE email = ?
        `).get(email.trim().toLowerCase());

        if (!doctor) {
            return res.status(401).json({
                error: "Invalid email or password"
            });
        }

        //Preserve the existing PBKDF2 algorithm
        const calculatedHash = crypto.pbkdf2Sync(
            password,
            doctor.passwordSalt,
            100000,
            32,
            "sha256"
        );
        console.log("Algorithm: sha256");
        console.log("Calculated hash:", calculatedHash.length);
        console.log("Stored hash:", doctor.passwordHash.length);

        if (calculatedHash.length !== doctor.passwordHash.length) {
            console.error("Hash length mismatch. Possible data corruption.");
            return res.status(500).json({
                error: "Invalid email or password"
            });
        }
        const valid = crypto.timingSafeEqual(
            calculatedHash,
            doctor.passwordHash
        );

        if (!valid) {
            return res.status(401).json({
                error: "Invalid email or password"
            });
        }

        res.json({
            id: doctor.id,
            name: doctor.name,
            email: doctor.email,
            speciality: doctor.speciality,
            phone: doctor.phone
        });
    
    } catch (error) {
        console.error("Error during doctor login:", error);
        res.status(500).json({ error: "Login failed" });
    }
});

// Update doctor details
app.put("/api/doctors/:id", (req, res) => {
    try {
        const doctorId = Number(req.params.id);
        const { name, speciality, email } = req.body;

        if (
            !Number.isInteger(doctorId) ||
            doctorId <= 0 ||
            !name?.trim() ||
            !speciality?.trim() ||
            !email?.trim()
        ) {
            return res.status(400).json({
                error: "Please provide valid doctor details."
            });
        }

        const doctor = db.prepare(`
            SELECT id FROM doctors WHERE id = ?
        `).get(doctorId);

        if (!doctor) {
            return res.status(404).json({
                error: "Doctor not found."
            });
        }

        db.prepare(`
            UPDATE doctors
            SET name = ?, speciality = ?, email = ?
            WHERE id = ?
        `).run(
            name.trim(),
            speciality.trim(),
            email.trim(),
            doctorId
        );

        res.json({
            message: "Doctor details updated successfully."
        });

    } catch (error) {
        console.error("Doctor update error:", error);

        if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
            return res.status(409).json({
                error: "That email address is already in use."
            });
        }

        res.status(500).json({
            error: "Could not update doctor details."
        });
    }
});

app.post("/api/patients", (req, res) => {
    try {
    const { name, email, encryptedData, salt, iv } = req.body;

    if(!name || !email || !encryptedData || !salt || !iv) {
        return res.status(400).json({
             error: "Missing required fields" });
    }

    if(!process.env.EMAIL_HASH_SECRET) {
        console.error("EMAIL_HASH_SECRET is missing");
        return res.status(500).json({
            error: "Server configuration error"
        });
    }

    const emailHash = hashPatientEmail(email);

    const existingPatient = db.prepare(`
        SELECT id FROM patients WHERE emailHash = ?
        `).get(emailHash);

    if(existingPatient) {
        return res.status(409).json({
            error: "An account with this email already exists."
        })
    }

    const insertPatient = db.prepare(`
        INSERT INTO patients (name, encryptedData, salt, iv, emailHash)
        VALUES (?, ?, ?, ?, ?)
    `);

    const result = insertPatient.run(
        name,
        Buffer.from(encryptedData, "base64"),
        Buffer.from(salt, "base64"),
        Buffer.from(iv, "base64"),
        emailHash
    );

    res.status(201).json({
        message: 'Patient registered successfully',
        patientId: result.lastInsertRowid
    })
    } catch (error) {
        console.error("Error registering patient:", error);
        res.status(500).json({ error: "Patient registration failed" });
    }
});
app.get("/api/patients", (req, res) => {
    try {
        const patients = db.prepare(`
            SELECT id, name, encryptedData, salt, iv
            FROM patients
        `).all();

        const formattedPatients = patients.map(patient => ({
            id: patient.id,
            name: patient.name,
            encryptedData: patient.encryptedData.toString("base64"),
            salt: patient.salt.toString("base64"),
            iv: patient.iv.toString("base64")
        }));

        res.json(formattedPatients);
    } catch (error) {
        console.error("Error fetching patients:", error);
        res.status(500).json({
            error: "Failed to retrieve patients"
        });
    }
});

app.get("/api/patients/:id", (req, res) => {
    try {
        const patientId = Number(req.params.id);

        if (!Number.isInteger(patientId)) {
            return res.status(400).json({
                error: "Invalid patient ID"
            });
        }

        const patient = db.prepare(`
            SELECT id, name, encryptedData, salt, iv
            FROM patients
            WHERE id = ?
        `).get(patientId);

        if (!patient) {
            return res.status(404).json({
                error: "Patient not found"
            });
        }

        res.json({
            id: patient.id,
            name: patient.name,
            encryptedData: patient.encryptedData?.toString("base64"),
            salt: patient.salt?.toString("base64"),
            iv: patient.iv?.toString("base64")
        });

    } catch (error) {
        console.error("Error loading patient:", error);

        res.status(500).json({
            error: "Could not load patient details"
        });
    }
});

// Update patient name only
app.put("/api/patients/:id", (req, res) => {
    try {
        const patientId = Number(req.params.id);
        const { name } = req.body;

        if (!Number.isInteger(patientId) || patientId <= 0 || !name || !name.trim()) {
            return res.status(400).json({
                error: "A valid patient ID and name are required."
            });
        }

        const patient = db.prepare(`
            SELECT id FROM patients WHERE id = ?
        `).get(patientId);

        if (!patient) {
            return res.status(404).json({
                error: "Patient not found."
            });
        }

        db.prepare(`
            UPDATE patients
            SET name = ?
            WHERE id = ?
        `).run(name.trim(), patientId);

        res.json({
            message: "Patient name updated successfully."
        });

    } catch (error) {
        console.error("Patient update error:", error);

        res.status(500).json({
            error: "Could not update patient details."
        });
    }
});

// Save medical history for a patient
app.post("/api/patients/:id/history", (req, res) => {
    const patientId = Number(req.params.id);
    const { doctorId, date, title, details } = req.body;

    if (!Number.isInteger(patientId) ||
        !Number.isInteger(Number(doctorId)) ||
        !date || !title || !details) {
        return res.status(400).json({
            error: "Please provide all required medical history details."
        });
    }

    try {
        const result = db.prepare(`
            INSERT INTO medical_history (
                patientId, doctorId, date, title, details
            )
            VALUES (?, ?, ?, ?, ?)
        `).run(
            patientId,
            Number(doctorId),
            date,
            title,
            details
        );

        res.status(201).json({
            message: "Medical history saved successfully.",
            historyId: result.lastInsertRowid
        });

    } catch (error) {
        console.error("Error saving medical history:", error);

        res.status(500).json({
            error: "Could not save medical history."
        });
    }
});

// Save clinical notes for a patient
app.post("/api/patients/:id/notes", (req, res) => {
    const patientId = Number(req.params.id);
    const { doctorId, date, note } = req.body;

    if (
        !Number.isInteger(patientId) ||
        !Number.isInteger(Number(doctorId)) ||
        !date || !note
    ) {
        return res.status(400).json({
            error: "Please provide all required clinical note details."
        });
    }

    try {
        const result = db.prepare(`
            INSERT INTO clinical_notes (
                patientId, doctorId, date, note
            )
            VALUES (?, ?, ?, ?)
        `).run(
            patientId,
            Number(doctorId),
            date,
            note
        );

        res.status(201).json({
            message: "Clinical note saved successfully.",
            noteId: result.lastInsertRowid
        });

    } catch (error) {
        console.error("Error saving clinical note:", error);

        res.status(500).json({
            error: "Could not save clinical note."
        });
    }
});

// Save prescriptions for a patient
app.post("/api/patients/:id/prescriptions", (req, res) => {
    const patientId = Number(req.params.id);

    const {
        doctorId,
        date,
        medicine,
        dosage,
        frequency,
        duration,
        instructions
    } = req.body;

    if (
        !Number.isInteger(patientId) ||
        !Number.isInteger(Number(doctorId)) ||
        !date ||
        !medicine ||
        !dosage ||
        !frequency ||
        !duration
    ) {
        return res.status(400).json({
            error: "Please provide all required prescription details."
        });
    }

    try {
        const result = db.prepare(`
            INSERT INTO prescriptions (
                patientId,
                doctorId,
                date,
                medicine,
                dosage,
                frequency,
                duration,
                instructions
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            patientId,
            Number(doctorId),
            date,
            medicine,
            dosage,
            frequency,
            duration,
            instructions || ""
        );

        res.status(201).json({
            message: "Prescription saved successfully.",
            prescriptionId: result.lastInsertRowid
        });

    } catch (error) {
        console.error("Error saving prescription:", error);

        res.status(500).json({
            error: "Could not save prescription."
        });
    }
});

// Get all medical records belonging to one patient
app.get("/api/patients/:id/records", (req, res) => {
    const patientId = Number(req.params.id);

    try {
        const medicalHistory = db.prepare(`
            SELECT id, doctorId, date, title, details
            FROM medical_history
            WHERE patientId = ?
            ORDER BY date DESC
        `).all(patientId);

        const clinicalNotes = db.prepare(`
            SELECT id, doctorId, date, note
            FROM clinical_notes
            WHERE patientId = ?
            ORDER BY date DESC
        `).all(patientId);

        const prescriptions = db.prepare(`
            SELECT id, doctorId, date, medicine, dosage,
                   frequency, duration, instructions
            FROM prescriptions
            WHERE patientId = ?
            ORDER BY date DESC
        `).all(patientId);

        res.json({
            medicalHistory,
            clinicalNotes,
            prescriptions
        });

    } catch (error) {
        console.error("Error retrieving patient records:", error);
        res.status(500).json({ error: "Failed to retrieve patient records." });
    }
});

app.post("/api/appointments", (req, res) => {
    try {
        console.log("Appointment request received:", req.body);
        const {
            patientId,
            doctorId,
            date,
            time,
            
        } = req.body;

        if (
            !Number.isInteger(patientId) ||
            !Number.isInteger(doctorId) ||
            !date || !time
        ) {
            return res.status(400).json({
                error: "Missing or invalid required fields"
            });
        }

        //Check that the patient exists
        const patient = db.prepare(`
            SELECT id FROM patients WHERE id = ?
        `).get(patientId);

        //check that the doctor exists
        const doctor = db.prepare(`
            SELECT id FROM doctors WHERE id = ?
        `).get(doctorId);

        if (!patient || !doctor) {
            return res.status(404).json({
                error: "Patient or doctor not found"
            });
        }

        //Save the appointment
        const result = db.prepare(`
            INSERT INTO appointments (
            patientId, doctorId, date, time, status, createdAt
            )
            VALUES (?, ?, ?, ?, ?, ?)`).run(
                patientId,
                doctorId,
                date,
                time,
                "pending",
                new Date().toISOString()
            );

            res.status(201).json({
                message: "Appointment created successfully",
                appointmentId: result.lastInsertRowid
            });
    } catch (error) {
        console.error("Error creating appointment:", error);
        res.status(500).json({
            error: "Failed to create appointment"
        });
    }
});
app.get("/api/appointments", (req, res) => {
    try {
        const appointments = db.prepare(`
            SELECT id, patientId, doctorId, date, time, status, createdAt
            FROM appointments
        `).all();

        res.json(appointments);
    } catch (error) {
        console.error("Error fetching appointments:", error);
        res.status(500).json({
            error: "Failed to retrieve appointments"
        });
    }
})
app.post("/api/admin/login", (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                error: "Email and password are required"
            });
        }

        const admin = db.prepare(`
            SELECT id, name, email, role, passwordSalt, passwordHash
            FROM users
            WHERE email = ? AND role = 'admin'
        `).get(email.trim().toLowerCase());

        if (!admin) {
            return res.status(401).json({
                error: "Invalid email or password"
            });
        }

        const calculatedHash = crypto.pbkdf2Sync(
            password,
            admin.passwordSalt,
            100000,
            32,
            "sha256"
        );

        if (calculatedHash.length !== admin.passwordHash.length) {
            return res.status(401).json({
                error: "Invalid email or password"
            });
        }

        const valid = crypto.timingSafeEqual(
            calculatedHash,
            admin.passwordHash
        );

        if (!valid) {
            return res.status(401).json({
                error: "Invalid email or password"
            });
        }

        res.json({
            id: admin.id,
            name: admin.name,
            email: admin.email,
            role: admin.role
        });

    } catch (error) {
        console.error("Admin login error:", error);

        res.status(500).json({
            error: "Admin login failed"
        });
    }
});

// Get all admin accounts
app.get("/api/admin", (req, res) => {
    try {
        const admins = db.prepare(`
            SELECT id, name, email, role
            FROM users
            WHERE role = 'admin'
        `).all();

        res.json(admins);

    } catch (error) {
        console.error("Error fetching admins:", error);
        res.status(500).json({
            error: "Failed to retrieve admin accounts."
        });
    }
});

app.delete("/api/patients/:id", (req, res) => {
    try {
        const patientId = Number(req.params.id);

        if (!Number.isInteger(patientId) || patientId <= 0) {
            return res.status(400).json({
                error: "Invalid patient ID"
            });
        }

        //Check wheteher the patient exists
        const patient = db.prepare(`
            SELECT id FROM patients WHERE id = ?
        `).get(patientId);

        if (!patient) {
            return res.status(404).json({
                error: "Patient not found"
            });
        }


        //Check exisitng appointments with the patient
          const appointments = db.prepare(`
            SELECT COUNT(*) AS count
            FROM appointments
            WHERE patientId = ?
        `).get(patientId);


        if (appointments.count > 0) {
            return res.status(400).json({
                error: "Cannot delete patient with existing appointments"
            });
        }

        //Delete the patient
        db.prepare(`
            DELETE FROM patients WHERE id = ?
        `).run(patientId);

        res.json({
            message: "Patient deleted successfully"
        });
    } catch (error) {
        console.error("Error deleting patient:", error);
        res.status(500).json({
            error: "Failed to delete patient"
        });
    }
});

app.delete("/api/admin/:id", (req, res) =>{
    try {
        const adminId = Number(req.params.id);

        if(!Number.isInteger(adminId) || adminId <= 0) {
            return res.status(400).json({
                error: "Invalid admin ID"
            });
        }

        const admin = db.prepare(`
            SELECT id FROM users
            WHERE id = ? AND role = 'admin'
            `).get(adminId);
        
            if(!admin) {
                return res.status(404).json({
                    error: "Admin account not found"
                });
            }

            const result = db.transaction(() => {

                const adminCount = db.prepare(`
                    SELECT COUNT (*) AS count
                    FROM users
                    WHERE role = 'admin'
                    `).get();
            
                if (adminCount.count <= 1) {
                    return false;
                }

                db.prepare(`
                    DELETE FROM users
                    WHERE id = ? AND role = 'admin'
                    `).run(adminId);
                
                return true;
            })();

            if (!result) {
                return res.status(409).json({
                    error: "You cannot delete the last admin account."
                })
            }

            res.json({
                message: "Admin account deleted successfully"
            })
    } catch (error) {
        console.error("Admin deletion error:", error);

        res.status(500).json({
            error: "Could not delete admin account"
        });
    }
});

app.delete("/api/doctors/:id", (req, res) => {
    try {
        const doctorId = Number(req.params.id);

        if (!Number.isInteger(doctorId) || doctorId <= 0) {
            return res.status(400).json({
                error: "Invalid doctor ID"
            });
        }

        //Check wheteher the doctor exists
        const doctor = db.prepare(`
            SELECT id FROM doctors WHERE id = ?
        `).get(doctorId);

        if (!doctor) {
            return res.status(404).json({
                error: "Doctor not found"
            });
        }

        //Check exisitng appointments with the doctor
        const appointments = db.prepare(`
            SELECT COUNT(*) AS count
            FROM appointments
            WHERE doctorId = ?
        `).get(doctorId);

        if (appointments.count > 0) {
            return res.status(400).json({
                error: "Cannot delete doctor with existing appointments"
            });
        }

        //Delete the doctor
        db.prepare(`
            DELETE FROM doctors WHERE id = ?
        `).run(doctorId);

        res.json({
            message: "Doctor deleted successfully"
        });
    } catch (error) {
        console.error("Error deleting doctor:", error);
        res.status(500).json({
            error: "Failed to delete doctor"
        });
    }
});

app.get("/api/admin", (req, res) => {
    try{
        const admins = db.prepare(`
            SELECT id, name, email, role
            FROM users
            WHERE role = 'admin'
            `).all();

            res.json(admins);
    } catch (error) {
        console.error("Error fetching admins", error);

        res.status(500).json({
            error: "Could not retrieve admin accounts"
        });
    }
});
app.listen(3000, () => {
    console.log("Server running at http://localhost:3000")
})