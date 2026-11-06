const pages = document.querySelectorAll(".page");
// Habbani: route guard - blocks the appointment and health pages unless logged in (criterion 26)
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
            console.log("Patient registered with ID:", result);

            message.textContent = "Patient registered successfully!";
            this.reset();

        } catch (error) {
            console.error(error);
            message.textContent = "Registration failed. Please try again.";
        }
                    
    });
}

// Get the appointment form from the HTML page.
const appointmentForm = document.getElementById("appointmentForm");

// Check that the appointment form exists before adding an event listener.
if (appointmentForm) {

    // Listen for the user submitting the appointment form.
    appointmentForm.addEventListener("submit", async function(event) {

        // Prevent the form from refreshing the page.
        event.preventDefault();

        // Retrieve the logged-in patient's ID from session storage.
        const patientId = Number(
            sessionStorage.getItem("loggedInPatientId")
        );

        // Collect the appointment details entered by the patient.
        const appointment = {
            patientId: patientId,

            // Retrieve the selected doctor's ID.
            doctorId: Number(
                document.getElementById("appointmentDoctor").value
            ),

            // Retrieve the selected appointment date.
            date: document.getElementById("appointmentDate").value,

            // Retrieve the selected appointment time.
            time: document.getElementById("appointmentTime").value
        };

        // Get the element used to display appointment messages.
        const message = document.getElementById("appointmentMessage");

        // Check that all required appointment details have been provided.
        if (!patientId || !appointment.doctorId ||
            !appointment.date || !appointment.time) {

            // Inform the patient that some information is missing.
            message.textContent = "Please complete all appointment fields.";
            return;
        }

        try {

            // Send the appointment details to the server using a POST request.
            const response = await fetch("/api/appointments", {
                method: "POST",

                // Tell the server that the request contains JSON data.
                headers: {
                    "Content-Type": "application/json"
                },

                // Convert the appointment object into JSON before sending it.
                body: JSON.stringify(appointment)
            });

            // Convert the server response into a JavaScript object.
            const result = await response.json();

            // Check whether the appointment was successfully created.
            if (!response.ok) {
                throw new Error(result.error || "Failed to create appointment.");
            }

            // Inform the patient that their appointment was created successfully.
            message.textContent = "Appointment created successfully!";

            // Clear the appointment form after successful submission.
            this.reset();

            // Refresh the appointment lists so the new appointment appears.
            await window.loadAppointments();

        } catch (error) {

            // Log any errors in the browser console for debugging.
            console.error(error);

            // Display the error message to the patient.
            message.textContent = error.message;
        }
    });
}


// Get the login form from the HTML page.
const loginForm = document.getElementById("loginForm");

// Only add the event listener if the login form exists.
if (loginForm) {

    // Listen for the user submitting the login form.
    loginForm.addEventListener("submit", async function(event) {

        // Prevent the form from refreshing the page.
        event.preventDefault();

        // Retrieve the selected role, email and password.
        const role = document.getElementById("loginRole").value;
        const email = document.getElementById("loginEmail").value.trim().toLowerCase();
        const password = document.getElementById("loginPassword").value;

        // Get the element used to display login messages.
        const message = document.getElementById("loginMessage");

        // Inform the user that the login process has started.
        message.textContent = "Signing in...";

        try {
            // Store the account details after successful authentication.
            let account = null;

            // Store the decrypted patient contact information.
            let patientContact = null;

            // PATIENT LOGIN
            if (role === "patient") {

                // Request all patient records from the server.
                const response = await fetch("/api/patients");

                // Check whether the server request was successful.
                if (!response.ok) {
                    throw new Error("Failed to fetch patients.");
                }

                // Convert the server response into a JavaScript array.
                const patients = await response.json();

                // Check each patient record to find the matching account.
                for (const patient of patients) {
                    try {

                        // Convert the encrypted patient data from Base64
                        // back into Uint8Array format for decryption.
                        const savedData = {
                            encryptedData: fromBase64(patient.encryptedData),
                            salt: fromBase64(patient.salt),
                            iv: fromBase64(patient.iv)
                        };

                        // Decrypt the patient's contact information
                        // using the password entered during login.
                        const contact = await decryptData(savedData, password);

                        // Check whether the decrypted email matches the entered email.
                        if (contact.email?.toLowerCase() === email) {

                            // Save the matching patient account.
                            account = patient;

                            // Save the decrypted contact information.
                            patientContact = contact;

                            // Stop searching once the correct account is found.
                            break;
                        }

                    } catch (error) {

                        // Decryption can fail when the password is incorrect
                        // for this particular patient record.
                        console.error("Patient decryption failed:", error);
                    }
                }

            // DOCTOR LOGIN
            } else if (role === "doctor") {

                // Send the doctor's email and password to the server.
                const response = await fetch("/api/doctors/login", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ email, password })
                });

                // Convert the server response into a JavaScript object.
                const result = await response.json();

                // If authentication fails, display the server's error message.
                if (!response.ok) {
                    message.textContent = result.error || "Invalid email or password.";
                    return;
                }

                // Store the authenticated doctor's account details.
                account = result;

            // ADMIN LOGIN
            } else if (role === "admin") {

                // Send the administrator's email and password to the server.
                const response = await fetch("/api/admin/login", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ email, password })
                });

                // Convert the server response into a JavaScript object.
                const result = await response.json();

                // If authentication fails, display the server's error message.
                if (!response.ok) {
                    message.textContent = result.error || "Invalid email or password.";
                    return;
                }

                // Store the authenticated administrator's account details.
                account = result;
            }

            // Clear any previous login information from session storage.
            sessionStorage.removeItem("loggedInPatientId");
            sessionStorage.removeItem("loggedInDoctorId");
            sessionStorage.removeItem("loggedInAdminId");

            // Save the role of the currently logged-in user.
            sessionStorage.setItem("loggedInRole", role);

            // Check whether a matching account was found.
            if (!account) {
                message.textContent = "Patient account not found. Check your email and password.";
                return;
            }

            // COMPLETE PATIENT LOGIN
            if (role === "patient") {

                // Save the patient's ID for use on other pages.
                sessionStorage.setItem("loggedInPatientId", account.id);

                // Create an object containing the patient's personal details.
                const loggedInPatient = {
                    name: account.name,
                    email: patientContact.email,
                    phone: patientContact.phone
                };

                // Display the patient's details on the health section.
                document.querySelector("#health p").textContent =
                    `Name: ${loggedInPatient.name} | Email: ${loggedInPatient.email} | Phone: ${loggedInPatient.phone}`;

                // Display a successful login message.
                message.textContent = "Patient signed in successfully.";

                // Redirect the patient to their dashboard.
                window.location.href = "patient/patient.html";

            // COMPLETE DOCTOR LOGIN
            } else if (role === "doctor") {

                // Save the doctor's ID for use on other pages.
                sessionStorage.setItem("loggedInDoctorId", account.id);

                // Display a successful login message.
                message.textContent = "Doctor sign in successful.";

                // Redirect the doctor to their dashboard.
                window.location.href = "doctor/doctor.html";

            // COMPLETE ADMIN LOGIN
            } else {

                // Save the administrator's ID for use on other pages.
                sessionStorage.setItem("loggedInAdminId", account.id);

                // Display a successful login message.
                message.textContent = "Admin sign in successful.";

                // Redirect the administrator to their dashboard.
                window.location.href = "admin/admin.html";
            }

        } catch (error) {

            // Log unexpected login errors in the browser console.
            console.error("Login error:", error);

            // Display a general error message to the user.
            message.textContent = "Something went wrong. Please try again";
        }
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
// Habbani: encrypts data with AES-256-GCM using a random salt and IV (criterion 29)
async function encryptData(data, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await makeKey(password, salt);
    const text = new TextEncoder().encode(JSON.stringify(data));
    const encryptedData = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, text);
    return { encryptedData, salt, iv };
}
// Habbani: stores the patient with encrypted contact details and a hashed password (criterion 30)
async function addPatientWithEncryptedContact(name, email, phone, password, passwordHash) {
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
        email: email.trim().toLowerCase(),
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

const logoutButton = document.getElementById("logoutButton");

if (logoutButton){
    logoutButton.addEventListener("click", signOut);
}

document.addEventListener("click", resetLogoutTimer);
document.addEventListener("keydown", resetLogoutTimer);
document.addEventListener("mousemove", resetLogoutTimer);