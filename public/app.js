    const page = document.querySelectorAll(".page");

    function route(){
        const requestedPage = window.location.hash.slice(1) || "home";

        page.forEach(function(page) {
            page.hidden = page.id !== requestedPage;
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
                db.createObjectStore("appointments", {
                    keyPath : "id",
                    autoIncrement : true
                });
                store.createIndex("doctorId", "doctorId");
                store.createIndex("patientId", "patientId");
                store.createIndex("date", "date");
        
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

async function addDoctor(name, speciality, email) {
    return addRecord("doctors", {
        name,
        speciality,
        email
    });
}
async function addPatient(name, email, phone) {
    return addRecord("patients", {
        name,
        phone,
        email,
    });
}
document
    .getElementById("patientForm")
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

        if (!safeEmail.includes("@") || !safeEmail.includes(".")) {
            message.textContent = "Please enter a valid email address.";
            return;
        }

        if (safePhone.length < 7) {
            message.textContent = "Please enter a valid phone number.";
            return;
        }
                    try {
                    await addPatientWithEncryptedContact(
            safeName,
            safeEmail,
            safePhone,
            password
        ); 
                        await loadAppointmentOptions();
                        message.textContent = "Patient registered successfully!";

                        this.reset();

                    } catch (error) {
                        console.error(error);
                        message.textContent = "Registration failed. Please try again.";
                    }
    });
        
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

        let updateRecord;

        request.onsuccess = () => {
            const existing = request.result;

            if (!existing) {
                tx.abort();
                return;
            }

            //Keep existing fields unless updated
            updateRecord = {...existing, ...changes, id};
            store.put(updateRecord)
        };

        request.onerror = () => reject(request.onerror);
        tx.oncomplete = () => {
            db.close();
            reject(error);
        };

        tx.onerror = () =>{
            // The transaction's abort handler handles failure.
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
document
    .getElementById("appointmentForm")
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


async function encryptData(data, password) {
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(JSON.stringify(data));
    const keyMaterial = await window.crypto.subtle.importKey(
        "raw",

        encoder.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );
    // create a random value that need for secure incryption
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const key = await window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000,
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt"]
    );
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encryptedData = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        key,
        encodedData
    ); 

    // to Keep the values needed for decryption.
    return {
        encryptedData: encryptedData,
        salt: salt,
        iv: iv
    };
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
    const encoder = new TextEncoder();

    const keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );

    const key = await window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: savedData.salt,
            iterations: 100000,
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
    );

    const decryptedData = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: savedData.iv },
        key,
        savedData.encryptedData
    );

    const decodedData = new TextDecoder().decode(decryptedData);
    return JSON.parse(decodedData);
}

document.getElementById("loginForm").addEventListener("submit", async function(event) {
    event.preventDefault();

    const email = document.getElementById("loginEmail").value.trim().toLowerCase();
    const password = document.getElementById("loginPassword").value;
    const message = document.getElementById("loginMessage");
    const patients = await getALLRecords("patients");

    let loggedInPatient = null;

    for (const patient of patients) {
        try {
            const contact = await decryptData(patient.encryptedContact, password);

            if (contact.email === email) {
                loggedInPatient = patient;
                break;
            }
        } catch (error) {
            // This password did not unlock this patient's contact.
        }
    }

    if (!loggedInPatient) {
        message.textContent = "Email or password is incorrect.";
        return;
    }

    sessionStorage.setItem("loggedInPatientId", loggedInPatient.id);
    message.textContent = "Sign in successful.";
    window.location.hash = "#home";
});

let logoutTimer;

function signOut() {
    sessionStorage.removeItem("loggedInPatientId");
    clearTimeout(logoutTimer);
    document.getElementById("logoutButton").hidden = true;
    window.location.hash = "#login";
}

function resetLogoutTimer() {
    if (!sessionStorage.getItem("loggedInPatientId")) {
        return;
    }

    clearTimeout(logoutTimer);
    logoutTimer = setTimeout(signOut, 30 * 60 * 1000);
}

document  
    .getElementById("loadAppointments")
    .addEventListener("click", displayAppointments);
document.getElementById("logoutButton").addEventListener("click", signOut);

document.addEventListener("click", resetLogoutTimer);
document.addEventListener("keydown", resetLogoutTimer);
document.addEventListener("mousemove", resetLogoutTimer);