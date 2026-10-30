const pages = document.querySelectorAll(".page");

function route() {
    const requestedPage = window.location.hash.slice(1) || "home";

    const pageExists = Array.from(pages).some(function(page) {
        return page.id === requestedPage;
    });

    const targetPage = pageExists ? requestedPage : "home";

    const protectedPages = ["appointment", "health"];

    if (
        protectedPages.includes(targetPage) &&
        !sessionStorage.getItem("loggedInPatientId")
    ) {
        window.location.hash = "#login";
        return;
    }

    pages.forEach(function(page) {
        page.hidden = page.id !== targetPage;
    });
}

window.addEventListener("hashchange", route);
route();


const db_name = "MedicalAppointments";
const db_version = 1;

    function openDatabase(){
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(db_name, db_version)

            request.onupgradeneeded = () => {
                const db = request.result;
                
            if (!db.objectStoreNames.contains("users")){
                const store = db.createObjectStore("users", {
                    keyPath : "id",
                    autoIncrement: true
                });
                store.createIndex("email", "email", {
                    unique : true

                });

            }
            if(!db.objectStoreNames.contains("doctors")) {
                db.createObjectStore("doctors", {
                    keyPath : "id",
                    autoIncrement : true
                });
            
            }
             if(!db.objectStoreNames.contains("patients")) {
                db.createObjectStore("patients", {
                    keyPath : "id",
                    autoIncrement : true
                });

        }
         if(!db.objectStoreNames.contains("appointments")) {
                const appointmentStore = db.createObjectStore("appointments", {
                    keyPath : "id",
                    autoIncrement : true
                });
                appointmentStore.createIndex("doctorId", "doctorId");
                appointmentStore.createIndex("patientId", "patientId");
                appointmentStore.createIndex("date", "date");
        
        }
        if(!db.objectStoreNames.contains("availability")) {
                db.createObjectStore("availability", {
                    keyPath : "id",
                    autoIncrement : true
                });
        }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    });
} 

async function addRecord(storeName, record) {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const request = tx.objectStore(storeName).add(record);

        let id;

        request.onsuccess = () => {
            id = request.result;

        };
        
        tx.oncomplete = () => {
            db.close();
            resolve(id);
        };
        tx.onerror = () => {
            db.close();
            reject(tx.error);
        };
        tx.onabort = () => {
            db.close();
            reject(tx.error);
        };
    });
}
async function getALLRecords(storeName) {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName,"readonly");
        const request = tx.objectStore(storeName).getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);

        tx.oncomplete = () => db.close();
        tx.onerror = () => db.close();

    });

}
async function getRecord(storeName, id){
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const request = tx.objectStore(storeName).get(id);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);

        tx.oncomplete = () => db.close();
        tx.onerror = () => db.close();
    });
    
}

async function addDoctor(name, speciality, email, phone, password) {
    const passwordData = await hashPassowrd(password);

    return addRecord("doctors", {
        name: name,
        speciality: speciality,
        email: email.toLowerCase(),
        phone: phone,
        passwordSalt: passwordData.salt,
        passwordHash: passwordData.hash
    });
}
async function addPatient(name, email, phone) {
    return addRecord("patients", {
        name,
        phone,
        email,
    });
}

async function createInitialAdmin(name, email, password) {
    const users = await getALLRecords("users");

    if (users.some(user => user.role === "admin")) {
        throw new Error("An admin account already exists.");
    }

    const passwordData = await hashPassowrd(password);

    return addRecord("users", {
        name,
        email: email.toLowerCase(),
        role: "admin",
        passwordSalt: passwordData.salt,
        passwordHash: passwordData.hash
    });
}   
        
async function createAppointment(
    patientId,
    doctorId,
    date,
    time
) {
    // Check that both records exist
    const patient = await getRecord("patients", patientId);
    const doctor = await getRecord("doctors", doctorId);

    if(!patient || !doctor){
        return "Patient or doctor not found";
    }
    return addRecord("appointments", {
        patientId,
        doctorId,
        date,
        time,
        status: "pending",
        createdAt: new Date().toISOString()
    });

}

async function updateRecord(storeName, id, changes) {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const request = store.get(id);

        let updatedRecord;

        request.onsuccess = () => {
            const existing = request.result;

            if (!existing) {
                tx.abort();
                return;
            }

            updatedRecord = {
                ...existing,
                ...changes,
                id
            };

            store.put(updatedRecord);
        };

        tx.oncomplete = () => {
            db.close();
            resolve(updatedRecord);
        };

        tx.onerror = () => {
            db.close();
            reject(tx.error);
        };

        tx.onabort = () => {
            db.close();
            reject(tx.error || new Error("Record not found."));
        };
    });
}

async function deleteRecord(storeName, id) {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const request = store.get(id);

        request.onsuccess = () => {
            if (!request.result) {
                tx.abort();
                return;
            }

            store.delete(id);
        };

        request.onerror = () => reject(request.error);
        tx.oncomplete = () => {
            db.close();
            resolve(true);
        };

        tx.onabort = () => {
            const error = tx.error || new Error("Record not found.");
            db.close();
            reject(error);
        };
    });
}

const patientForm = document.getElementById("patientForm");

if (patientForm) {
    patientForm
    .addEventListener("submit", async function(event){
        event.preventDefault();

        const name = 
            document.getElementById("patientName").value.trim();
        const email = 
            document.getElementById("patientEmail").value.trim();
        const phone = 
            document.getElementById("patientPhone").value.trim();
        const message = 
            document.getElementById("registerMessage");
        const password =
            document.getElementById("patientPassword").value;
        
        const confirmPassword =
            document.getElementById("confirmPatientPassword").value;

        if (password !== confirmPassword) {
            message.textContent = "The passwords do not match.";
            return;
        }
        const hasUpperCase = /[A-Z]/.test(password);
        const hasNumber = /[0-9]/.test(password);

        if (password.length < 8 || !hasUpperCase || !hasNumber) {
            message.textContent =
                "Password needs 8 characters, one capital letter and one number.";
            return;
        }
                    document.getElementById("registerMessage");
                // Habbani: basic validation and input cleaning.
        const safeName = name.replace(/[<>]/g, "").trim();
        const safeEmail = email.replace(/[<>]/g, "").trim().toLowerCase();
        const safePhone = phone.replace(/[^0-9+\s()-]/g, "").trim();

        if (safeName.length < 2) {
            message.textContent = "Please enter a valid full name.";
            return;
        }

        // Habbani: proper email format check using regex
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(safeEmail)) {
            message.textContent = "Please enter a valid email address.";
            return;
        }

        if (safePhone.length < 7) {
            message.textContent = "Please enter a valid phone number.";
            return;
        }
          try {
            // Habbani: hash the password with PBKDF2 for storage (criterion 30)
            const hashSalt = crypto.getRandomValues(new Uint8Array(16));
            const hashKey = await crypto.subtle.importKey(
                "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]
            );
            const hashBits = await crypto.subtle.deriveBits(
                { name: "PBKDF2", salt: hashSalt, iterations: 100000, hash: "SHA-256" },
                hashKey, 256
            );
            const passwordHash = { hash: new Uint8Array(hashBits), salt: hashSalt };

            await addPatientWithEncryptedContact(safeName, safeEmail, safePhone, password, passwordHash);
            await loadAppointmentOptions();
            message.textContent = "Patient registered successfully!";
            this.reset();

        } catch (error) {
            console.error(error);
            message.textContent = "Registration failed. Please try again.";
        }
                    
    });
}

const appointmentForm = document.getElementById("appointmentForm");
if (appointmentForm) {
    appointmentForm
    .addEventListener("submit", async function(event) {
        event.preventDefault();

        const appointment = {
            patientId: Number(
                document.getElementById("appointmentPatient").value
            ),

            doctorId: Number(
                document.getElementById("appointmentDoctor").value
            ),
            date: document.getElementById("appointmentDate").value,
            time: document.getElementById("appointmentTime").value,
            status: "pending"
        };

        const message = document.getElementById("qppointmentMessage");

        try {
            const patient = await getRecord(
                "patients", appointment.patientId
            );

            const doctor = await getRecord(
                "doctors", appointment.doctorId
            );

            if (!patient || !doctor) {
                throw new Error("Pateint or doctor not found.");
            }

            await addRecord("appointments", appointment);

            message.textContent = "Appointment created!";
            this.reset();

        } catch (error) {
            console.error(error);
            message.textContent = "Could not create appointment.";
        }
    });
}

async function loadAppointmentOptions() {
    const patients = await getALLRecords("patients");
    const doctors = await getALLRecords("doctors");

    const patientSelect = document.getElementById("appointmentPatient");
    const doctorSelect = document.getElementById("appointmentDoctor");

    patientSelect.replaceChildren();
    doctorSelect.replaceChildren();

    patientSelect.add(new Option("Choose a patient", ""));
    doctorSelect.add(new Option("Choose a doctor", ""));

    patients.forEach(patient => {
        patientSelect.add(
            new Option(patient.name, patient.id)
        );
    });
   
    doctors.forEach(doctor => {
        doctorSelect.add(
            new Option(`${doctor.name} - ${doctor.speciality}`,
                doctor.id
            )
        );
    });

}
async function displayAppointments() {
    const list = document.getElementById("appointmentList");
    const message = document.getElementById("message");

    list.replaceChildren();
    message.textContent = "Loading...";

    try {
        const appointments = 
            await getALLRecords("appointments");
            
        if(appointments.length === 0) {
            message.textContent = "No appointments yet.";
            return;
        }

        for(const appointment of appointments) {
            const doctor = await getRecord(
                "doctors",
                appointment.doctorId
            );
            const patient = await getRecord(
                "patients",
                appointment.patientId
            );
            
            const item = document.createElement("article");
            const heading = document.createElement("h3");
            const details = document.createElement("p")
            const status = document.createElement("p")

            heading.textContent =
            `${doctor?.name ?? "Unkown doctor"} - ` +
            `${patient?.name ?? "Unkown Patient"}`;

            details.textContent =  
            `${appointment.date} at ${appointment.time}`;

            status.textContent = 
            `Status: ${appointment.status}`;

            item.append(heading, details, status);
            list.append(item);
        }
        message.textContent = "";
    } catch (error) {
        console.error(error);
        message.textContent = "Could not load appointments.";
    }
}

async function makeKey(password, salt) {
    const keyMaterial = await crypto.subtle.importKey(
        "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" },
        keyMaterial, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
    );
}

async function encryptData(data, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await makeKey(password, salt);
    const text = new TextEncoder().encode(JSON.stringify(data));
    const encryptedData = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, text);
    return { encryptedData, salt, iv };
}


async function addPatientWithEncryptedContact(name, email, phone, password) {
    const encryptedContact = await encryptData(
        { email: email, phone: phone },
        password
    );

    return addRecord("patients", {
        name: name,
        encryptedContact: encryptedContact
    });
}

// Habbani: decrypt data after it has been saved.
async function decryptData(savedData, password) {
     const key = await makeKey(password, savedData.salt);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: savedData.iv }, key, savedData.encryptedData);
    return JSON.parse(new TextDecoder().decode(plain));
}

async function hashPassword(password, salt = null) {
    const actualSalt = salt || crypto.getRandomValues(new Uint8Array(16)
    );

    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(password),
        "PBKDF2",
        false,
        ["deriveBits"]
    );

    const hash = await crypto.subtle.deriveBits(
        {
            name: "PBKDF2",
            salt: actualSalt,
            iterations: 100000,
            hash: "SHA-256"
        },
        keyMaterial,
        256
    );

    return {
        salt: actualSalt,
        hash: new Uint8Array(hash)
    };
}

async function verifyPassword(password, savedSalt, savedHash) {
    const result = await hashPassword(password, savedSalt);
    
    if (result.hash.length !== savedHash.length) {
        return false;
    }

    return result.hash.every(
        (byte, index) => byte === savedHash[index]);
}
const loginForm = document.getElementById("loginForm");
if (loginForm) {
    loginForm
    .addEventListener("submit", async function(event) {
    event.preventDefault();

    const role = document.getElementById("loginRole").value;
    const email = document.getElementById("loginEmail").value.trim().toLowerCase();
    const password = document.getElementById("loginPassword").value;
    const message = document.getElementById("loginMessage");
    
    message.textContent = "Signing in...";

    try {
        let account = null;
        let patientContact = null;

        if (role === "patient") {
            const patients = await getALLRecords("patients");
       
        for (const patient of patients) {
        try {
            const contact = await decryptData(patient.encryptedContact, password);
            console.log("Decrypted patient contact:", contact);


            if (contact.email?.toLowerCase() === email) {
                account = patient;
                patientContact = contact;
                break;
            }
            
            } catch (error) {
            // This password did not decrypt this patient's data.
            }
        }   
    } else if (role === "doctor") {
        const doctors = await getALLRecords("doctors");

        const doctor = doctors.find(
            item => item.email?.toLowerCase() === email
        );

        if (doctor?.passwordHash && doctor?.passwordSalt) {
            const valid =  await verifyPassword(
                password,
                doctor.passwordSalt,
                doctor.passwordHash
            );

            if (valid) account = doctor;
        }
    } else if (role === "admin") {
        const users = await getALLRecords("users");

        const admin = users.find(
            item => item.role === "admin" && 
                item.email?.toLowerCase() === email
        );

        if (admin?.passwordHash && admin?.passwordSalt) {
            const valid = await verifyPassword(
                password,
                admin.passwordSalt,
                admin.passwordHash
            );
            if (valid) account = admin;
        }
    }

    if (!account) {
        message.textContent = "Invalid email or password.";
        return;
    }

    //Clear any previous login information.
    sessionStorage.removeItem("loggedInPatientId");
    sessionStorage.removeItem("loggedInDoctorId");
    sessionStorage.removeItem("loggedInAdminId");

    sessionStorage.setItem("loggedInRole", role);

    if (role === "patient") {
        sessionStorage.setItem("loggedInPatientId", account.id);
        
        const loggedInPatient = { 
            name: account.name,
            email: patientContact.email,
            phone: patientContact.phone
        };

        document.querySelector("#health p").textContent =
            `Name: ${loggedInPatient.name} | Email: ${loggedInPatient.email} | Phone: ${loggedInPatient.phone}`;

        message.textContent = "Patient signed in successfully.";
        window.location.hash = "#health";
    
    } else if (role === "doctor") {
        sessionStorage.setItem("loggedInDoctorId", account.id);
        message.textContent = "Doctor sign in successful.";
        window.location.href = "doctor/doctor.html";
    
    } else {
        sessionStorage.setItem("loggedInAdminId", account.id);
        message.textContent = "Admin sign in successful.";
        window.location.href = "admin.html"
    }
    } catch (error) {
        console.error("Login error:", error);
        message.textContent = "Something went wrong. Please try again";
    }
});
}

let logoutTimer;

function signOut() {
    sessionStorage.removeItem("loggedInPatientId");
    sessionStorage.removeItem("loggedInDoctorId");
    sessionStorage.removeItem("loggedInAdminId");
    sessionStorage.removeItem("loggedInRole");

    clearTimeout(logoutTimer);

    const logoutButton = document.getElementById("logoutButton");

    if (logoutButton) {
        logoutButton.hidden = true;
    }

    window.location.href = "/#login";
}

function resetLogoutTimer() {
    if (!sessionStorage.getItem("loggedInPatientId")) {
        return;
    }

    clearTimeout(logoutTimer);
    logoutTimer = setTimeout(signOut, 30 * 60 * 1000);
}
const loadAppointmentsButton = document.getElementById("loadAppointments");
if (loadAppointmentsButton) {
    loadAppointmentsButton.addEventListener("click", displayAppointments);
}

const logoutButton = document.getElementById("logoutButton");

if (logoutButton){
    logoutButton.addEventListener("click", signOut);
}

document.addEventListener("click", resetLogoutTimer);
document.addEventListener("keydown", resetLogoutTimer);
document.addEventListener("mousemove", resetLogoutTimer);