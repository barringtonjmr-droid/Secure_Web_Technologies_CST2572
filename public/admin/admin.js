document.addEventListener("DOMContentLoaded", function () {
    const adminId = sessionStorage.getItem("loggedInAdminId");
    const role = sessionStorage.getItem("loggedInRole");

    if (!adminId || role !== "admin") {
        alert("You must log in as an admin in order to access this page.");
        window.location.href = "../cst_project.html#login";
        return;
    }

    document.getElementById("adminWelcome").textContent =
        "You are successfully signed in as an admin.";
    
    document.getElementById("adminContent").hidden = false;
});

async function loadAdminDashboard() {
    const message = document.getElementById("appointmentMessage");

    try {
        const [
            patientsResponse,
            doctorsResponse,
            appointmentsResponse,
            adminsResponse
        ] = await Promise.all([
            fetch("/api/patients"),
            fetch("/api/doctors"),
            fetch("/api/appointments"),
            fetch("/api/admins")
        ]);

        if (
            !patientsResponse.ok ||
            !doctorsResponse.ok ||
            !appointmentsResponse.ok ||
            !adminsResponse.ok
        ) {
            throw new Error("Failed to fetch dashboard data.");
        }

        const patients = await patientsResponse.json();
        const doctors = await doctorsResponse.json();
        const appointments = await appointmentsResponse.json();
        const admins = await adminsResponse.json();

        // Update summary cards
        document.getElementById("patientCount").textContent =
            patients.length;

        document.getElementById("doctorCount").textContent =
            doctors.length;

        document.getElementById("appointmentCount").textContent =
            appointments.length;

        document.getElementById("cancelledCount").textContent =
            appointments.filter(
                appointment => appointment.status === "cancelled"
            ).length;

        // Display account lists
        displayPatientAccounts(patients);
        displayDoctorAccounts(doctors);
        displayAdminAccounts(admins);

        // Display appointments
        displayAdminAppointments(appointments, patients, doctors);

        if (message) {
            message.textContent = "";
        }

    } catch (error) {
        console.error("Failed to load admin dashboard:", error);

        if (message) {
            message.textContent =
                "Could not load dashboard data. Check your database setup.";
        }
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await loadAdminDashboard();
});

function toBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";

    bytes.forEach(byte => {
        binary += String.fromCharCode(byte);
    });
    return btoa(binary);
}


async function createDoctorAccount() {
    const message = document.getElementById("accountMessage");

    const name = document.getElementById("doctorName").value.trim();
    const speciality = document.getElementById("doctorSpeciality").value.trim();
    const email = document.getElementById("doctorEmail").value.trim();
    const phone = document.getElementById("doctorPhone").value.trim();
    const password = document.getElementById("doctorPassword").value;

    if (!name || !email || !password) {
        if (message) {
            message.textContent = "Please fill in all required fields.";
        }
        return;
    }

    try {
        // Use your existing PBKDF2 password hashing function
        const passwordData = await hashPassword(password);

        const response = await fetch("/api/doctors", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name,
                speciality,
                email,
                phone,
                passwordSalt: Array.from(passwordData.salt),
                passwordHash: Array.from(passwordData.hash)
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Could not create doctor account.");
        }

        if (message) {
            message.textContent = "Doctor account created successfully!";
        }

        document.getElementById("accountForm").reset();

        await loadAdminDashboard();

    } catch (error) {
        console.error("Doctor account creation error:", error);

        if (message) {
            message.textContent = error.message;
        }
    }
}


function displayPatientAccounts(patients) {
    const tbody = document.getElementById("patientAccountsBody");
    if (!tbody) return;

    tbody.replaceChildren();

    if (patients.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3">No patients found.</td></tr>';
        return;
    }

    patients.forEach(patient => {
        const row = document.createElement("tr");

        [patient.id, patient.name].forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });

        const actionCell = document.createElement("td");
        const deleteButton = document.createElement("button");

        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", () => {
            deletePatient(patient.id);
        });

        actionCell.appendChild(deleteButton);
        row.appendChild(actionCell);
        tbody.appendChild(row);
    });
}

function displayDoctorAccounts(doctors) {
    const tbody = document.getElementById("doctorAccountsBody");
    if (!tbody) return;

    tbody.replaceChildren();

    if (doctors.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">No doctors found.</td></tr>';
        return;
    }

    doctors.forEach(doctor => {
        const row = document.createElement("tr");

        [
            doctor.id,
            doctor.name,
            doctor.speciality || "—",
            doctor.email
        ].forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });

        const actionCell = document.createElement("td");
        const deleteButton = document.createElement("button");

        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", () => {
            deleteDoctor(doctor.id);
        });

        actionCell.appendChild(deleteButton);
        row.appendChild(actionCell);
        tbody.appendChild(row);
    });
}


function displayAdminAccounts(admins) {
    const tbody = document.getElementById("adminAccountsBody");
    if (!tbody) return;

    tbody.replaceChildren();

    if (admins.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4">No admins found.</td></tr>';
        return;
    }

    admins.forEach(admin => {
        const row = document.createElement("tr");

        [admin.id, admin.name, admin.email].forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });

        const actionCell = document.createElement("td");
        const deleteButton = document.createElement("button");

        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", () => {
            deleteAdmin(admin.id);
        });

        actionCell.appendChild(deleteButton);
        row.appendChild(actionCell);
        tbody.appendChild(row);
    });
}

async function deletePatients(patientId) {
    if (!confirm("Are you sure you want to delete this patient")) {
        return;
    }

    try {
        const response = await fetch(`/api/patients/${patientId}`, {
            method: "DELETE"
        });

        const result = await response.json();

        if (!response.ok) {
            alert(result.error || "Could not delete patient.");
            return;
        }
        alert(result.message);
        await loadAdminDashboard();
    } catch (error) {
        console.error("Patient deletion error:", error);
        alert("Could not delete patient.")
    }
}

async function deleteDoctor(doctorId) {
    if (!confirm("Are you sure you want to delete this doctor?")) {
        return;
    }

    try {
        const response = await fetch(`/api/doctors/${doctorId}`, {
            method: "DELETE"
        });

        const result = await response.json();

        if (!response.ok) {
            alert(result.error || "Could not delete doctor.");
            return;
        }

        alert(result.message);
        await loadAdminDashboard();

    } catch (error) {
        console.error("Doctor deletion error:", error);
        alert("Could not delete doctor.");
    }
}

async function deleteAdmin(adminId) {
    if (!confirm("Are you sure you want to delete this admin account?")) {
        return;
    }

    try {
        const response = await fetch(`/api/admins/${adminId}`, {
            method: "DELETE"
        });

        const result = await response.json();

        if (!response.ok) {
            alert(result.error || "Could not delete admin.");
            return;
        }

        alert(result.message);
        await loadAdminDashboard();

    } catch (error) {
        console.error("Admin deletion error:", error);
        alert("Could not delete admin.");
    }
}

function displayAdminAppointments(appointments, patients, doctors) {
    const tbody = document.getElementById("appointmentTableBody");

    if (!tbody) {
        console.error(
            'Missing <tbody id="appointmentTableBody"> in admin.html'
        );
        return;
    }

    tbody.replaceChildren();

    // Show a message if there are no appointments.
    if (!appointments || appointments.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 7;
        cell.textContent = "No appointments found.";

        row.appendChild(cell);
        tbody.appendChild(row);
        return;
    }

    // Display each appointment.
    appointments.forEach((appointment) => {
        const patient = patients.find(
            item => String(item.id) === String(appointment.patientId)
        );

        const doctor = doctors.find(
            item => String(item.id) === String(appointment.doctorId)
        );

        const row = document.createElement("tr");

        const values = [
            appointment.id ?? "—",
            patient?.name ?? `Patient #${appointment.patientId ?? "?"}`,
            doctor?.name ?? `Doctor #${appointment.doctorId ?? "?"}`,
            appointment.date ?? "—",
            appointment.time ?? "—",
            appointment.status ?? "scheduled"
        ];

        values.forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = String(value);
            row.appendChild(cell);
        });

        const actionCell = document.createElement("td");
        actionCell.textContent = "—";
        row.appendChild(actionCell);

        tbody.appendChild(row);
    });
}

document.addEventListener("DOMContentLoaded", () => {
    const showButton = document.getElementById("showAccountForm");
    const cancelButton = document.getElementById("cancelAccountForm");
    const formContainer = document.getElementById("accountFormContainer");
    const form = document.getElementById("createAccountForm");
    const roleSelect = document.getElementById("accountRole");
    const doctorFields = document.getElementById("doctorFields");
    const specialityInput = document.getElementById("doctorSpeciality");
    const message = document.getElementById("accountMessage");

    if (!showButton || !cancelButton || !formContainer || !form) {
        console.error("Account form elements are missing from admin.html");
        return;
    }

    showButton.addEventListener("click", () => {
        formContainer.hidden = false;
        message.textContent = "";
    });

    cancelButton.addEventListener("click", () => {
        form.reset();
        formContainer.hidden = true;
        message,textContent = "";
        updateRoleFields();
    });

    function updateRoleFields() {
        const isDoctor = roleSelect.value === "doctor";
        doctorFields.hidden = !isDoctor;
        specialityInput.required = isDoctor;
    }

    roleSelect.addEventListener("change", updateRoleFields);
    updateRoleFields();

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        message.textContent = "";

        const role = roleSelect.value;
        const name = document.getElementById("accountName").value.trim();
        const email = document.getElementById("accountEmail").value.trim().toLowerCase();
        const phone = document.getElementById("accountPhone").value.trim();
        const password = document.getElementById("accountPassword").value;
        const speciality = specialityInput.value.trim();

        if (name.length < 2) {
            message.textContent = "Enter a valid full name.";
            return;
        }

        if (password.length < 8 ||
            !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
            message.textContent =
                "Password must have at least 8 characters, one uppercase letter and  one number.";
            return;
        }

        if (role === "doctor" && !speciality) {
            message.textContent = "Enter the doctor's speciality.";
            return;
        }

        try {
            if (role === "patient") {
                await addPatientWithEncryptedContact(
                    name, email, phone, password
                );
            } else if (role === "doctor") {
                await createDoctorAccount(
                    name, speciality, email, phone, password
                );
            }

            message.textContent = 
                `${role === "patient" ? "Patient" : "Doctor"} account created
                successfully.`;
            
                form.reset();
                updateRoleFields();

                await loadAdminDashboard();

        } catch (error) {
            console.error("Account creation failed:", error);
            message.textContent =
                error.message || "Could not create the account. Please try again.";
                
        }
});
//Load existing doctors into the dropdown
async function loadDoctorsForPasswordReset() {
    console.log("Loading doctors for password reset...");

    const doctorSelect = document.getElementById("resetDoctorSelect");
    
    if (!doctorSelect) return;

    const response = await fetch("/api/doctors");

    if (!response.ok) {
        throw new Error("Failed to fetch doctors from the server.");
    }

    const doctors = await response.json();
    console.log("Doctors loaded:", doctors);

    doctorSelect.innerHTML =
        '<option value="">Select a doctor</option>';
    
    doctors.forEach(doctor => {
        const option = document.createElement("option");

        option.value = String(doctor.id);
        option.textContent = `${doctor.name} (${doctor.email})`;
        doctorSelect.appendChild(option);
    });
    
}
//Handle doctor password reset
const resetForm = document.getElementById("resetDoctorPasswordForm");

if (resetForm) {
    resetForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        console.log("Resetting doctor password...");

        const doctorId = document.getElementById("resetDoctorSelect").value;
        const newPassword = document.getElementById("newDoctorPassword").value;
        const message = document.getElementById("resetPasswordMessage");

        message.textContent = "";
        
        if (!doctorId) {
            message.textContent = "Select a doctor to reset the password.";
            return;
        }

        if (
            newPassword.length < 8 ||
            !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)
        ) {
            message.textContent =
                "Password must have at least 8 characters, one uppercase letter and one number.";
            return;
        }
        try {
            //Generate a new PBKDF2 salt and hash for the new password
            const passwordData = await hashPassword(newPassword);

            const response = await fetch(
                `/api/doctors/${encodeURIComponent(doctorId)}/password`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        passwordSalt: toBase64(passwordData.salt),
                        passwordHash: toBase64(passwordData.hash)
                    })
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Password reset failed.");
            }

            message.textContent = "Password reset successfully.";

            resetForm.reset();

        } catch (error) {
            console.error("Password reset failed:", error);
            message.textContent =
                error.message || "Could not reset the password. Please try again.";
        }
});
}
//Load doctors when the admin page opens
loadDoctorsForPasswordReset().catch((error) => {
    console.error("Could not load doctors:", error)
})
});
