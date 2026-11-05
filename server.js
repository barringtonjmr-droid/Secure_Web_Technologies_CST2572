const express = require("express");
const path = require("path");
const crypto = require("crypto");
const db = require("./database");
console.log("Database:", !!db);
console.log("Prepare type:", typeof db.prepare);

const app = express();

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

app.post("/api/patients", (req, res) => {
    try {
    const { name, encryptedData, salt, iv } = req.body;

    if(!name || !encryptedData || !salt || !iv) {
        return res.status(400).json({
             error: "Missing required fields" });
    }

    const insertPatient = db.prepare(`
        INSERT INTO patients (name, encryptedData, salt, iv)
        VALUES (?, ?, ?, ?)
    `);

    const result = insertPatient.run(
        name,
        Buffer.from(encryptedData, "base64"),
        Buffer.from(salt, "base64"),
        Buffer.from(iv, "base64")
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
app.post("/api/appointments", (req, res) => {
    try {
        const {
            patientId,
            doctorId,
            date,
            time,
            
        } = req.body;

        if (
            !Number.isInteger(patientId) ||
            !Numver.isInteger(doctorId) ||
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
            patientId, doctorId, date, time, createdAt
            )
            VALUES (?, ?, ?, ?, ?)`).run(
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

app.delete("/api/admins/:id", (req, res) =>{
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

app.get("/api/admins", (req, res) => {
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