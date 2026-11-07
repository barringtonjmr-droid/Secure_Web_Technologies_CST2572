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

//Get doctor data from table function
app.get("/api/doctors", (req,res) => {
    //Tries to fetch doctor data, with error handling.
    try{
        const doctors = db.prepare("SELECT id, name, email, speciality, phone FROM doctors").all();
        //Get doctor data
        res.json(doctors);
    } catch (error) {
        console.error("Error fetching doctors:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

//Runs this function once the endpoint is accessed
app.post("/api/doctors", (req, res) => {
    try {
        //Desturcture the values into there own variables
        const {
            name,
            speciality,
            email,
            phone,
            passwordSalt,
            passwordHash
        } = req.body;

        //Checks if any required data is missing from the variables
        if(
            !name || !speciality || !email || 
            !passwordSalt || !passwordHash
        ) {
            return res.status(400).json({
                 error: "Missing required fields" });
        }

        //Prepare/create an insert data into doctor tables functions
        const insertDoctor = db.prepare(`
            INSERT INTO doctors (
            name, speciality, email, phone,
            passwordSalt, passwordHash
            )
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        //If data is there insert it into the doctors table
        const result = insertDoctor.run(
            name.trim(),
            speciality.trim(),
            email.trim().toLowerCase(),
            phone || null,
            Buffer.from(passwordSalt, "base64"),
            Buffer.from(passwordHash, "base64")
        );

        //Success message
        res.status(201).json({
            message: "Doctor registered successfully",
            doctorId: result.lastInsertRowid
        });
    
    //Catches any potential wrong errors anywhere in the catch
    } catch (error) {
        console.error("Error registering doctor:", error);

        res.status(500).json({ error: "Doctor account creation failed" });
}
});

//Password reset function
app.put("/api/doctors/:id/password", (req, res) => {
    try {
        //Converts value into number, and destructures data
        const doctorId = Number(req.params.id);
        const { passwordSalt, passwordHash } = req.body;
        
        //Checks if id is valid or if password was entered
        if(
            !Number.isInteger(doctorId) || doctorId <= 0 ||
            !passwordSalt || !passwordHash
        ) {
            return res.status(400).json({
                error: "Invalid doctor ID or missing password data"
            });
        }

        //Prepares sqlite update function and runs it adding new password to doctors table
        const result = db.prepare(`
            UPDATE doctors
            SET passwordSalt = ?, passwordHash = ?
            WHERE id = ?
        `).run(
            Buffer.from(passwordSalt, "base64"),
            Buffer.from(passwordHash, "base64"),
            doctorId
        );
        
        //If there is no change, error message

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
        //Destructures data
        const { email, password } = req.body;

        //Checks for relevant fields
        if(!email || !password) {
            return res.status(400).json({
                error: "Email and password are required"
            });
        }

        //Prepare db function to get doctor data
        const doctor = db.prepare(`
            SELECT id, name, email, speciality, phone, 
                    passwordSalt, passwordHash
            FROM doctors
            WHERE email = ?
        `).get(email.trim().toLowerCase());
        
        //Error handling if data doesnt match what's in the database
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

        //Checks if the hashes have the same length
        if (calculatedHash.length !== doctor.passwordHash.length) {
            console.error("Hash length mismatch. Possible data corruption.");
            return res.status(500).json({
                error: "Invalid email or password"
            });
        }

        //Safely compares the hashes
        const valid = crypto.timingSafeEqual(
            calculatedHash,
            doctor.passwordHash
        );

        //Checks if valid
        if (!valid) {
            return res.status(401).json({
                error: "Invalid email or password"
            });
        }

        //Sends data to front end for use
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

        //Converts id into number and destructures data
        const doctorId = Number(req.params.id);
        const { name, speciality, email } = req.body;

        //Checks for required fields
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

        //Prepares function to check if that doctor is in the db
        const doctor = db.prepare(`
            SELECT id FROM doctors WHERE id = ?
        `).get(doctorId);

        if (!doctor) {
            return res.status(404).json({
                error: "Doctor not found."
            });
        }

        //Preapre and run update function
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

        //Server response if successfull
        res.json({
            message: "Doctor details updated successfully."
        });

    } catch (error) {
        console.error("Doctor update error:", error);

        //Checks for duplicate email
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

// Route for registering a new patient
app.post("/api/patients", (req, res) => {
    try {
        // Destructures the patient's details from the request body
        const { name, email, encryptedData, salt, iv } = req.body;

        // Check that all required registration fields have been provided
        if(!name || !email || !encryptedData || !salt || !iv) {
            return res.status(400).json({
                error: "Missing required fields"
            });
        }

        // Check that the email hashing secret is configured on the server
        if(!process.env.EMAIL_HASH_SECRET) {
            console.error("EMAIL_HASH_SECRET is missing");
            return res.status(500).json({
                error: "Server configuration error"
            });
        }

        // Generate a secure hash of the patient's email for duplicate checking
        const emailHash = hashPatientEmail(email);

        // Check whether an account with the same email hash already exists
        const existingPatient = db.prepare(`
            SELECT id FROM patients WHERE emailHash = ?
        `).get(emailHash);

        // Return an error if the email is already registered
        if(existingPatient) {
            return res.status(409).json({
                error: "An account with this email already exists."
            });
        }

        // Prepare an SQL statement to insert the new patient into the database
        const insertPatient = db.prepare(`
            INSERT INTO patients (name, encryptedData, salt, iv, emailHash)
            VALUES (?, ?, ?, ?, ?)
        `);

        // Insert the patient's details, converting encrypted values from Base64 into binary data
        const result = insertPatient.run(
            name,
            Buffer.from(encryptedData, "base64"),
            Buffer.from(salt, "base64"),
            Buffer.from(iv, "base64"),
            emailHash
        );

        // Send a success response with the ID of the newly registered patient
        res.status(201).json({
            message: 'Patient registered successfully',
            patientId: result.lastInsertRowid
        });

    } catch (error) {
        // Log any unexpected errors and send a server error response
        console.error("Error registering patient:", error);
        res.status(500).json({ error: "Patient registration failed" });
    }
});

//Get patient data for use/display
app.get("/api/patients", (req, res) => {
    try {
        //Prepare statement to select the data
        const patients = db.prepare(`
            SELECT id, name, encryptedData, salt, iv
            FROM patients
        `).all();
        
        //Loops through all patients and creates a formatted array for each
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

// Retrieving a specific patient's details using their ID
app.get("/api/patients/:id", (req, res) => {
    try {
        // Get the patient ID from the URL and convert it into a number
        const patientId = Number(req.params.id);

        // Check that the patient ID is a valid integer
        if (!Number.isInteger(patientId)) {
            return res.status(400).json({
                error: "Invalid patient ID"
            });
        }

        // Retrieve the patient's details from the database using their ID
        const patient = db.prepare(`
            SELECT id, name, encryptedData, salt, iv
            FROM patients
            WHERE id = ?
        `).get(patientId);

        // Return an error if no patient with that ID exists
        if (!patient) {
            return res.status(404).json({
                error: "Patient not found"
            });
        }

        // Send the patient's details back to the frontend in JSON format
        // Convert encrypted binary data back into Base64 strings for transmission
        res.json({
            id: patient.id,
            name: patient.name,
            encryptedData: patient.encryptedData?.toString("base64"),
            salt: patient.salt?.toString("base64"),
            iv: patient.iv?.toString("base64")
        });

    } catch (error) {
        // Log unexpected errors and return a server error response
        console.error("Error loading patient:", error);

        res.status(500).json({
            error: "Could not load patient details"
        });
    }
});

// Update patient name only
app.put("/api/patients/:id", (req, res) => {
    try {
        //Get patient id from URL
        const patientId = Number(req.params.id);
        //Destuctures data from request body
        const { name } = req.body;

        //Checks validity of data
        if (!Number.isInteger(patientId) || patientId <= 0 || !name || !name.trim()) {
            return res.status(400).json({
                error: "A valid patient ID and name are required."
            });
        }

        //Select statement of patient by id
        const patient = db.prepare(`
            SELECT id FROM patients WHERE id = ?
        `).get(patientId);
        
        //If no patient with that Id error
        if (!patient) {
            return res.status(404).json({
                error: "Patient not found."
            });
        }

        //Prepare and run update statement to update patients name
        db.prepare(`
            UPDATE patients
            SET name = ?
            WHERE id = ?
        `).run(name.trim(), patientId);
        
        //Success message
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
    //Gets patientd id, and destructers/extracts data from request body
    const patientId = Number(req.params.id);
    const { doctorId, date, title, details } = req.body;

    //Data checks
    if (!Number.isInteger(patientId) ||
        !Number.isInteger(Number(doctorId)) ||
        !date || !title || !details) {
        return res.status(400).json({
            error: "Please provide all required medical history details."
        });
    }

    try {
        //Prepare and run insert statement to insert the data into the db 
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

        //Success message
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

    //Gets patiend id, and destructures data from req body
    const patientId = Number(req.params.id);
    const { doctorId, date, note } = req.body;


    //Data checks, is and integer, valid doctor id
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

        //Prepare and run insert statement to insert the data into the db 
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

        //Success message
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
    //Gets patient id
    const patientId = Number(req.params.id);

    //Extracts all the data from the req body
    const {
        doctorId,
        date,
        medicine,
        dosage,
        frequency,
        duration,
        instructions
    } = req.body;

    //Checks for the required fields
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

        //Prepare and run insert statement to insert the data into the db 
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

        //Success message
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
        //Prepare and run statements to get all the patient info from their
        //respective tables
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
        
        //sends data to frontend for use
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
        //Extracts data
        const {
            patientId,
            doctorId,
            date,
            time,
            
        } = req.body;

        //Checks required fields
        if (
            !Number.isInteger(patientId) ||
            !Number.isInteger(doctorId) ||
            !date || !time
        ) {
            return res.status(400).json({
                error: "Missing or invalid required fields"
            });
        }

        //Statements to get patient and doctor by their id
        const patient = db.prepare(`
            SELECT id FROM patients WHERE id = ?
        `).get(patientId);

       
        const doctor = db.prepare(`
            SELECT id FROM doctors WHERE id = ?
        `).get(doctorId);

        //Checks if the patient or doctor exists
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

            //Success message
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

//Gets appointment data for use
app.get("/api/appointments", (req, res) => {
    try {
        //Gets all appointment data from db
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

//Admin login functionality
app.post("/api/admin/login", (req, res) => {
    try {
        //Extracts data
        const { email, password } = req.body;

        //Checks for email and password
        if (!email || !password) {
            return res.status(400).json({
                error: "Email and password are required"
            });
        }

        //Statement to check if the enetred data matches that of the db
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

        //Keeps the exisiting PBKDF2Sync
        const calculatedHash = crypto.pbkdf2Sync(
            password,
            admin.passwordSalt,
            100000,
            32,
            "sha256"
        );

        //Checks if the hashed passwords have the same length
        if (calculatedHash.length !== admin.passwordHash.length) {
            return res.status(401).json({
                error: "Invalid email or password"
            });
        }

        //Safely compares the hashes
        const valid = crypto.timingSafeEqual(
            calculatedHash,
            admin.passwordHash
        );

        //Checks if passwords match
        if (!valid) {
            return res.status(401).json({
                error: "Invalid email or password"
            });
        }

        //Sends data to frontend
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

        //Statement gets all admin accounts and the specified data
        const admins = db.prepare(`
            SELECT id, name, email, role
            FROM users
            WHERE role = 'admin'
        `).all();
        
        //Sends admin data to frontend for use
        res.json(admins);

    } catch (error) {
        console.error("Error fetching admins:", error);
        res.status(500).json({
            error: "Failed to retrieve admin accounts."
        });
    }
});

//Delete admin functionality for patients
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

//Delete admin functionality to delete other admins
//Prevents admin deletion if there is only one admin
app.delete("/api/admin/:id", (req, res) =>{
    try {
        //Gets admin Id
        const adminId = Number(req.params.id);

        //Validates admin Id
        if(!Number.isInteger(adminId) || adminId <= 0) {
            return res.status(400).json({
                error: "Invalid admin ID"
            });
        }

        //Gets admin id from users table
        const admin = db.prepare(`
            SELECT id FROM users
            WHERE id = ? AND role = 'admin'
            `).get(adminId);
            
            //Validates if there is an admin
            if(!admin) {
                return res.status(404).json({
                    error: "Admin account not found"
                });
            }

            //Allows grouping of multiple functions
            const result = db.transaction(() => {

                //Checks for the amount of admins
                const adminCount = db.prepare(`
                    SELECT COUNT (*) AS count
                    FROM users
                    WHERE role = 'admin'
                    `).get();
                
               
                //Checks admin count if less than or equal to one
                //if so prevent from running
                if (adminCount.count <= 1) {
                    return false;
                }

                db.prepare(`
                    DELETE FROM users
                    WHERE id = ? AND role = 'admin'
                    `).run(adminId);
                
                return true;
            })();

             //Prevents admin deletion function from running if there is only 1, 
             //thus returning false
            if (!result) {
                return res.status(409).json({
                    error: "You cannot delete the last admin account."
                })
            }
            //Success message
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

//Doctor deletion which prevents doctor with appointments from being deleted
app.delete("/api/doctors/:id", (req, res) => {
    try {
        //Get doctor Id
        const doctorId = Number(req.params.id);

        //Validates doctor id
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
        
        //Raises error if the doctor has an appointment
        if (appointments.count > 0) {
            return res.status(400).json({
                error: "Cannot delete doctor with existing appointments"
            });
        }

        //Delete the doctor
        db.prepare(`
            DELETE FROM doctors WHERE id = ?
        `).run(doctorId);
        
        //Success message
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

//Get admin specified data for use
app.get("/api/admin", (req, res) => {
    try{
        //Gets all specified admin data
        const admins = db.prepare(`
            SELECT id, name, email, role
            FROM users
            WHERE role = 'admin'
            `).all();
        //Sends data to front end "/api/admin"
            res.json(admins);
    } catch (error) {
        console.error("Error fetching admins", error);

        res.status(500).json({
            error: "Could not retrieve admin accounts"
        });
    }
});

//Runs server on localhost at port 3000 and displays message once
//It hass successfully started
app.listen(3000, () => {
    console.log("Server running at http://localhost:3000")
})