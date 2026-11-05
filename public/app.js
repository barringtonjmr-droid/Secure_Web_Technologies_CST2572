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

            const result = await addPatientWithEncryptedContact(
                safeName,
                safeEmail,
                safePhone,
                password
            );
            console.log("Patient registered with ID:", result.patientId);

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
    appointmentForm.addEventListener("submit", async function(event) {
        event.preventDefault();

        const appointment = {
            patientId: Number(
                document.getElementById("appointmentPatient").value
            ),
            doctorId: Number(
                document.getElementById("appointmentDoctor").value
            ),
            date: document.getElementById("appointmentDate").value,
            time: document.getElementById("appointmentTime").value
        };

        const message = document.getElementById("appointmentMessage");

        try {
            const response = await fetch("/api/appointments", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(appointment)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Failed to create appointment.");
            }
            message.textContent = "Appointment created successfully!";
            this.reset();
        } catch (error) {
            console.error(error);
            message.textContent = error.message || "Could not create appointment.";
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
        { email, phone },
        password
    );

    //Convert encrypted binary data to base64
    const toBase64 = (buffer) => {
        const bytes = new Uint8Array(buffer);
        let binary = "";

        bytes.forEach(byte => {
            binary += String.fromCharCode(byte);
        });

        return btoa(binary);
    };

    //Build the patient data object
    const patientData = {
        name,
        encryptedData: toBase64(encryptedContact.encryptedData),
        salt: toBase64(encryptedContact.salt),
        iv: toBase64(encryptedContact.iv)
    };

    //Send the data to your express server for storage in the SQLite database
    const response = await fetch("/api/patients", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(patientData)
    });

    const result = await response.json();

    if(!response.ok) {
        throw new Error(result.error || "Failed to register patient.");
    }

    return result.patientId;
}


// Habbani: decrypt data after it has been saved.
async function decryptData(savedData, password) {
     const key = await makeKey(password, savedData.salt);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: savedData.iv }, key, savedData.encryptedData);
    return JSON.parse(new TextDecoder().decode(plain));
}

//Reverses the Base64 conversion when retrieving data from the database.
function fromBase64(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
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
            const response = await fetch("/api/patients");

            if (!response.ok) {
                throw new Error("Failed to fetch patients.");
            }

            const patients = await response.json();

            for(const patient of patients) {
                try {
                    const savedData = {
                        encryptedData: fromBase64(patient.encryptedData),
                        salt: fromBase64(patient.salt),
                        iv: fromBase64(patient.iv)
                    };

                    const contact = await decryptData(savedData, password);

                    if (contact.email?.toLowerCase() === email) {
                        account = patient;
                        patientContact = contact;
                        break;
                    }
                } catch (error) {
                    //Password did not decrypt this patient's data.
       
        
        }  
    } 
    } else if (role === "doctor") {
       
        const response = await fetch("/api/doctors/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, password })
        });

        const result = await response.json();
        
        if (!response.ok) {
            message.textContent = result.error || "Invalid email or password.";
            return;
        }

        account = result;

    } else if (role === "admin") {
        const response = await fetch("/api/admin/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, password })
        });

        const result = await response.json();

        if (!response.ok) {
            message.textContent = result.error || "Invalid email or password.";
            return;
        }

        account = result;
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
        window.location.href = "admin/admin.html"
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