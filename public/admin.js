document.addEventListener("DOMContentLoaded", async () => {
    await loadAdminDashboard();
});

async function loadAdminDashboard() {
    const message = document.getElementById("appointmentMessage");

    try {
        //Load records from the existing IndexedDB stores
        const patients = await getALLRecords("patients");
        const doctors = await getALLRecords("doctors");
        const appointments = await getALLRecords("appointments");

        //Update the summary cards
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
        
        //Display all appointments
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
            const patients = await getALLRecords("patients");
            const doctors = await getALLRecords("doctors");

            //Check existing contact emails in both stores.
            for (const patient of patients) {
                if (!patient.encryptedContact) continue;

                try {
                    const contact = await decryptData(
                        patient.encryptedContact, 
                        password
                    );

                    if (contact.email === email) {
                        message.textContent = "An account with this email already exists.";
                        return;
                    }
                } catch (error) {
                    // This password may not decypt this patient's contact details.
                }
            }

            for (const doctor of doctors) {
                if (doctor.email?.toLowerCase() === email) {
                    message.textContent = "An account with this email already exists.";
                    return;
                }
            }

            if (role === "patient") {
                await addPatientWithEncryptedContact(
                    name,
                    email,
                    phone,
                    password
                );
            } else {
                await addDoctor(
                    name,
                    speciality,
                    email,
                    phone,
                    password
                );
            }

            message.textContent = 
                `${role === "patient" ? "Patient" : "Doctor"} account created successfully.`;
            
            form.reset();
            updateRoleFields();
            await loadAdminDashboard();

    } catch (error) {
        console.error("Account creation failed:", error);
        message.textContent = "Could not create the acccount. Please check the database and try again.";
    }
});
//Load existing doctors into the dropdown
async function loadDoctorsForPasswordReset() {
    const doctorSelect = document.getElementById("resetDoctorSelect");
    
    const doctors = await getALLRecords("doctors");

    doctorSelect.innerHTML =
        `<option value"">Choose a doctor</option>`;
    
    doctors.forEach((doctor) => {
        const option = document.createElement("option");

        option.value = doctor.id;
        option.textContent = `${doctor.name} (${doctor.email})`;

        doctorSelect.appendChild(option);
    })
}
//Handle password reset
const resetForm = document.getElementById("resetDoctorPasswordForm");

resetForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const doctorId = document.getElementById("resetDoctorSelect").value;
    const newPassword = document.getElementById("newDoctorPassword").value;
    const resetMessage = document.getElementById("resetPasswordMessage");

    resetMessage.textContent = "";

    if (
        newPassword.length < 8 || 
        !/[A-Z]/.test(newPassword) ||
        !/[0-9]/.test(newPassword)
    ) {
        resetMessage.textContent =
            "Password must have at least 8 characters, one uppercase letter and one number";
        return;
    }

    try {
        const doctors = await getALLRecords("doctors");
        const doctor = doctors.find(
            (item) => String(item.id) === String(doctorId)
        );

        if (!doctor) {
            resetMessage.textContent = "Please select a valid doctor.";
            return;
        }

        const passwordData = await hashPassowrd(newPassword);

        await updateRecord("doctors", doctor.id, {
            passwordSalt: passwordData.salt,
            passwordHash: passwordData.hash
        });

        resetMessage.textContent =
        `Password reset successfully for ${doctor.name}.`;

        resetForm.reset();
    } catch (error) {
        console.error("Password reset failed:", error);
        resetMessage.textContent =
            "Could not reset the password. Please try again.";
    }
    
});
//Load doctors when the admin page opens
loadDoctorsForPasswordReset().catch((error) => {
    console.error("Could not load doctors:", error)
})
});
