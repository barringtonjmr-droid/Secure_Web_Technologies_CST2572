document.addEventListener("DOMContentLoaded", function () {
    //Get session adminIds and role
    const adminId = sessionStorage.getItem("loggedInAdminId");
    const role = sessionStorage.getItem("loggedInRole");

    //Checks if your and admin
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

    //Get data from tables
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
            fetch("/api/admin")
        ]);

        //Error handling for failing to get data
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

//Create doctor account function
async function createDoctorAccount() {
    const message = document.getElementById("accountMessage");

    const name = document.getElementById("doctorName").value.trim();
    const speciality = document.getElementById("doctorSpeciality").value.trim();
    const email = document.getElementById("doctorEmail").value.trim();
    const phone = document.getElementById("doctorPhone").value.trim();
    const password = document.getElementById("doctorPassword").value;

    //Required fields
    if (!name || !email || !password) {
        if (message) {
            message.textContent = "Please fill in all required fields.";
        }
        return;
    }

    try {
        // Use the existing PBKDF2 password hashing function
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

        //Error handling
        if (!response.ok) {
            throw new Error(result.error || "Could not create doctor account.");
        }

        if (message) {
            message.textContent = "Doctor account created successfully!";
        }
        //Resets form, clears data
        document.getElementById("accountForm").reset();

        await loadAdminDashboard();

    } catch (error) {
        console.error("Doctor account creation error:", error);

        if (message) {
            message.textContent = error.message;
        }
    }
}

// Displays all patient accounts in the admin dashboard
function displayPatientAccounts(patients) {

    // Get the table body where patient accounts will be displayed
    const tbody = document.getElementById("patientAccountsBody");
    if (!tbody) return;

    // Clear any existing patient rows before displaying updated data
    tbody.replaceChildren();

    // Display a message if there are no patient accounts
    if (patients.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4">No patients found.</td></tr>';
        return;
    }

    // Loop through each patient and create a table row
    patients.forEach(patient => {
        const row = document.createElement("tr");

        // Add the patient's ID and name to the table
        [patient.id, patient.name].forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });

        // Create a delete button for each patient
        const actionCell = document.createElement("td");
        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete";

        // Call deletePatients() with the selected patient's ID when clicked
        deleteButton.addEventListener("click", () => {
            deletePatients(patient.id);
        });

        actionCell.appendChild(deleteButton);
        row.appendChild(actionCell);

        // Create an edit button to allow the patient's details to be managed
        const manageCell = document.createElement("td");
        const editButton = document.createElement("button");
        editButton.textContent = "Edit";

        // Call editPatient() with the selected patient's details when clicked
        editButton.addEventListener("click", () => {
            editPatient(patient);
        });

        manageCell.appendChild(editButton);
        row.appendChild(manageCell);

        // Add the completed patient row to the table
        tbody.appendChild(row);
    });
}

// Opens the edit form for the selected patient and fills in their current details.
function editPatient(patient) {
    document.getElementById("editPatientId").value = patient.id;
    document.getElementById("editPatientName").value = patient.name;
    document.getElementById("editPatientContainer").hidden = false;
    document.getElementById("editPatientMessage").textContent = "";
}

// Opens the edit form for the selected doctor and fills in their current details.
function editDoctor(doctor) {
    document.getElementById("editDoctorId").value = doctor.id;
    document.getElementById("editDoctorName").value = doctor.name;
    // If no speciality is available, the field is left empty.
    document.getElementById("editDoctorSpeciality").value =
        doctor.speciality || "";
    document.getElementById("editDoctorEmail").value = doctor.email;
    document.getElementById("editDoctorContainer").hidden = false;
    document.getElementById("editDoctorMessage").textContent = "";
}

// Displays all doctor accounts in the doctor accounts table.
function displayDoctorAccounts(doctors) {
    // Gets the table body where the doctor information will be displayed.
    const tbody = document.getElementById("doctorAccountsBody");
    if (!tbody) return;
    // Removes all existing rows so the table can be refreshed.
    tbody.replaceChildren();

    // Checks whether there are any doctors to display.
    if (doctors.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">No doctors found.</td></tr>';
        return; 
    }
    doctors.forEach(doctor => {
        // Creates a new table row for the current doctor.
        const row = document.createElement("tr");

        // Creates table cells for the doctor's ID, name, speciality and email.
        // If the doctor has no speciality, a dash is displayed instead.
        [doctor.id, doctor.name, doctor.speciality || "—", doctor.email]
            .forEach(value => {
                //Adds doctor data to table
                const cell = document.createElement("td");

                cell.textContent = value;

                row.appendChild(cell);
            });

        // Creates a separate table cell for the Delete button.
        const actionCell = document.createElement("td");

        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete";

        // Calls deleteDoctor() with this doctor's ID when the button is clicked.
        deleteButton.addEventListener("click", () => {
            deleteDoctor(doctor.id);
        });

        // Adds the Delete button to its table cell.
        actionCell.appendChild(deleteButton);

        // Adds the Delete button cell to the current table row.
        row.appendChild(actionCell);

        // Creates another table cell for the Edit button.
        const manageCell = document.createElement("td");

        const editButton = document.createElement("button");
        editButton.textContent = "Edit";

        // Calls editDoctor() with this doctor's details when the button is clicked.
        editButton.addEventListener("click", () => {
            editDoctor(doctor);
        });

        manageCell.appendChild(editButton);
        row.appendChild(manageCell);

        // Adds the completed doctor row to the table.
        tbody.appendChild(row);
    });
}


// Displays all admin accounts in the admin table.
function displayAdminAccounts(admins) {
    const tbody = document.getElementById("adminAccountsBody");
    if (!tbody) return;

    // Clears the table before displaying the latest admin accounts.
    tbody.replaceChildren();

    // Displays a message if there are no admin accounts.
    if (admins.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4">No admins found.</td></tr>';
        return;
    }

    // Creates a table row for each admin, including their details and Delete button.
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

// Deletes a patient account after asking the admin for confirmation.
async function deletePatients(patientId) {
    if (!confirm("Are you sure you want to delete this patient")) {
        return;
    }

    try {
        // Sends a DELETE request to the server for the selected patient.
        const response = await fetch(`/api/patients/${patientId}`, {
            method: "DELETE"
        });

        const result = await response.json();

        // Displays an error if the server could not delete the patient.
        if (!response.ok) {
            alert(result.error || "Could not delete patient.");
            return;
        }

        // Confirms deletion and refreshes the admin dashboard.
        alert(result.message);
        await loadAdminDashboard();
    } catch (error) {
        console.error("Patient deletion error:", error);
        alert("Could not delete patient.")
    }
}

// Deletes a doctor account after asking the admin for confirmation.
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

        // Confirms deletion and refreshes the dashboard.
        alert(result.message);
        await loadAdminDashboard();

    } catch (error) {
        console.error("Doctor deletion error:", error);
        alert("Could not delete doctor.");
    }
}

// Deletes an admin account after asking for confirmation.
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

        // Confirms deletion and refreshes the dashboard.
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


// Waits until the HTML page has loaded before setting up the account form.
document.addEventListener("DOMContentLoaded", () => {
    const showButton = document.getElementById("showAccountForm");
    const cancelButton = document.getElementById("cancelAccountForm");
    const formContainer = document.getElementById("accountFormContainer");
    const form = document.getElementById("createAccountForm");
    const roleSelect = document.getElementById("accountRole");
    const doctorFields = document.getElementById("doctorFields");
    const specialityInput = document.getElementById("doctorSpeciality");
    const message = document.getElementById("accountMessage");

    // Checks that the required account form elements exist.
    if (!showButton || !cancelButton || !formContainer || !form) {
        console.error("Account form elements are missing from admin.html");
        return;
    }

    // Shows the account creation form when the Show button is clicked.
    showButton.addEventListener("click", () => {
        formContainer.hidden = false;
        message.textContent = "";
    });

    // Resets and hides the form when the Cancel button is clicked.
    cancelButton.addEventListener("click", () => {
        form.reset();
        formContainer.hidden = true;
        message.textContent = "";
        updateRoleFields();
    });

    // Shows the speciality field only when the Doctor role is selected.
    function updateRoleFields() {
        const isDoctor = roleSelect.value === "doctor";
        doctorFields.hidden = !isDoctor;
        specialityInput.required = isDoctor;
    }

    roleSelect.addEventListener("change", updateRoleFields);
    updateRoleFields();

    // Handles account creation when the form is submitted.
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        message.textContent = "";

        // Gets the account details entered into the form.
        const role = roleSelect.value;
        const name = document.getElementById("accountName").value.trim();
        const email = document.getElementById("accountEmail").value.trim().toLowerCase();
        const phone = document.getElementById("accountPhone").value.trim();
        const password = document.getElementById("accountPassword").value;
        const speciality = specialityInput.value.trim();

        // Checks that the name contains at least two characters.
        if (name.length < 2) {
            message.textContent = "Enter a valid full name.";
            return;
        }

        // Checks that the password meets the required security rules.
        if (password.length < 8 ||
            !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
            message.textContent =
                "Password must have at least 8 characters, one uppercase letter and  one number.";
            return;
        }

        // Makes sure a speciality is entered when creating a doctor account.
        if (role === "doctor" && !speciality) {
            message.textContent = "Enter the doctor's speciality.";
            return;
        }

        try {
            // Calls the appropriate function depending on the selected account role.
            if (role === "patient") {
                await addPatientWithEncryptedContact(
                    name, email, phone, password
                );
            } else if (role === "doctor") {
                await createDoctorAccount(
                    name, speciality, email, phone, password
                );
            }

            // Displays a success message, resets the form and refreshes the dashboard.
            message.textContent =
                `${role === "patient" ? "Patient" : "Doctor"} account created successfully.`;

            form.reset();
            updateRoleFields();

            await loadAdminDashboard();

        } catch (error) {
            // Displays an error if account creation fails.
            console.error("Account creation failed:", error);
            message.textContent =
                error.message || "Could not create the account. Please try again.";
        }
    });
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


// Waits until the HTML page has loaded before setting up the edit forms.
document.addEventListener("DOMContentLoaded", () => {
    const editPatientForm = document.getElementById("editPatientForm");
    const cancelPatientEdit = document.getElementById("cancelPatientEdit");

    if (!editPatientForm) return;

    // Handles updating a patient's details when the form is submitted.
    editPatientForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const patientId = document.getElementById("editPatientId").value;
        const name = document.getElementById("editPatientName").value.trim();
        const message = document.getElementById("editPatientMessage");

        // Checks that a patient name has been entered.
        if (!name) {
            message.textContent = "Please enter a patient name.";
            return;
        }

        try {
            // Sends the updated patient name to the server using a PUT request.
            const response = await fetch(`/api/patients/${patientId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ name })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Could not update patient.");
            }

            // Displays a success message, closes the form and refreshes the dashboard.
            message.textContent = "Patient updated successfully!";

            editPatientForm.reset();
            document.getElementById("editPatientContainer").hidden = true;

            await loadAdminDashboard();

        } catch (error) {
            // Displays an error if the patient update fails.
            console.error("Patient update error:", error);
            message.textContent = error.message;
        }
    });

    // Resets and closes the patient edit form when Cancel is clicked.
    cancelPatientEdit?.addEventListener("click", () => {
        editPatientForm.reset();
        document.getElementById("editPatientContainer").hidden = true;
    });
});

// Sets up the doctor edit form after the HTML page has loaded.
document.addEventListener("DOMContentLoaded", () => {
    const editDoctorForm = document.getElementById("editDoctorForm");
    const cancelDoctorEdit = document.getElementById("cancelDoctorEdit");

    if (!editDoctorForm) return;

    // Handles updating a doctor's details when the form is submitted.
    editDoctorForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const doctorId = document.getElementById("editDoctorId").value;
        const name = document.getElementById("editDoctorName").value.trim();
        const speciality = document.getElementById("editDoctorSpeciality").value.trim();
        const email = document.getElementById("editDoctorEmail").value.trim();
        const message = document.getElementById("editDoctorMessage");

        try {
            // Sends the updated doctor details to the server using a PUT request.
            const response = await fetch(`/api/doctors/${doctorId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ name, speciality, email })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Could not update doctor.");
            }

            // Displays a success message, closes the form and refreshes the dashboard.
            message.textContent = "Doctor updated successfully!";

            editDoctorForm.reset();
            document.getElementById("editDoctorContainer").hidden = true;

            await loadAdminDashboard();

        } catch (error) {
            // Displays an error if the doctor update fails.
            console.error("Doctor update error:", error);
            message.textContent = error.message;
        }
    });

    // Resets and closes the doctor edit form when Cancel is clicked.
    cancelDoctorEdit?.addEventListener("click", () => {
        editDoctorForm.reset();
        document.getElementById("editDoctorContainer").hidden = true;
    });
});
