
document.addEventListener("DOMContentLoaded", async function () {

    // Get the logged-in patient's information
    const patientId = sessionStorage.getItem("loggedInPatientId");
    const role = sessionStorage.getItem("loggedInRole");

    // Check that a patient is logged in
    if (!patientId || role !== "patient") {
        alert("You must sign in as a patient to access this page.");
        window.location.href = "../cst_project.html#login";
        return;
    }

// Patient dashboard navigation
const navLinks = document.querySelectorAll("nav a");
const pages = document.querySelectorAll(".page");

navLinks.forEach(link => {
    link.addEventListener("click", function (event) {
        event.preventDefault();

        const targetId = this.getAttribute("href").substring(1);

        pages.forEach(page => {
            page.hidden = page.id !== targetId;
        });
    });
});

async function loadDoctors() {
    const response = await fetch("/api/doctors");

    if (!response.ok) {
        throw new Error("Failed to load doctors.");
    }

    const doctors = await response.json();
    
    const doctorDropdowns = document.querySelectorAll(".doctor-dropdown");

    doctorDropdowns.forEach(doctorDropdown => {
        doctors.forEach(doctor => {
            const option = document.createElement("option");

            option.value = doctor.id;
            option.textContent = `${doctor.name} - ${doctor.speciality || "General"}`;

            doctorDropdown.appendChild(option);
        });
    });
    
    
    
}

    // Load patient information
    async function loadPatientDetails() {
        const response = await fetch(`/api/patients/${patientId}`);

        if (!response.ok) {
            throw new Error("Could not load patient details.");
        }

        const patient = await response.json();

        loginStatus.textContent = `Welcome, ${patient.name}`;

        document.getElementById("myDetails").innerHTML = `
            <p><strong>Patient ID:</strong> ${patient.id}</p>
            <p><strong>Name:</strong> ${escapeHTML(patient.name)}</p>
        `;
    }

    // Load the patient's appointments
async function loadAppointments() {
    const response = await fetch("/api/appointments");

    if (!response.ok) {
        throw new Error("Could not load appointments.");
    }

    const appointments = await response.json();

    const myAppointments = appointments.filter(
        appointment => String(appointment.patientId) === String(patientId)
    );

    const appointmentList = document.getElementById("myAppointments");
    const appointmentPageList = document.getElementById("appointmentList");

    if (myAppointments.length === 0) {
        appointmentList.textContent = "You have no appointments booked.";
        appointmentPageList.textContent = "You have no appointments booked.";
        return;
    }

    const appointmentHTML = myAppointments.map(appointment => `
        <div class="item">
            <p><strong>Date:</strong> ${escapeHTML(appointment.date)}</p>
            <p><strong>Time:</strong> ${escapeHTML(appointment.time)}</p>
            <p><strong>Status:</strong> ${escapeHTML(appointment.status || "Pending")}</p>
        </div>
    `).join("");

    appointmentList.innerHTML = appointmentHTML;
    appointmentPageList.innerHTML = appointmentHTML;
}

window.loadAppointments = loadAppointments;

    // Load medical history, clinical notes and prescriptions
    async function loadMedicalRecords() {
        const response = await fetch(`/api/patients/${patientId}/records`);

        if (!response.ok) {
            throw new Error("Could not load medical records.");
        }

        const records = await response.json();

        // Medical history
        const historyContainer = document.getElementById("myRecord");

        historyContainer.innerHTML = records.medicalHistory.length
            ? records.medicalHistory.map(record => `
                <div class="item">
                    <p><strong>${escapeHTML(record.title)}</strong></p>
                    <p>${escapeHTML(record.date)}</p>
                    <p>${escapeHTML(record.details)}</p>
                </div>
            `).join("")
            : "No medical history available.";

        // Clinical notes
        const notesContainer = document.getElementById("myClinicalNotes");

        notesContainer.innerHTML = records.clinicalNotes.length
            ? records.clinicalNotes.map(record => `
                <div class="item">
                    <p><strong>Date:</strong> ${escapeHTML(record.date)}</p>
                    <p>${escapeHTML(record.note)}</p>
                </div>
            `).join("")
            : "No clinical notes available.";

        // Prescriptions
        const prescriptionsContainer = document.getElementById("myMedications");

        prescriptionsContainer.innerHTML = records.prescriptions.length
            ? records.prescriptions.map(prescription => `
                <div class="item">
                    <p><strong>Medicine:</strong> ${escapeHTML(prescription.medicine)}</p>
                    <p><strong>Dosage:</strong> ${escapeHTML(prescription.dosage)}</p>
                    <p><strong>Frequency:</strong> ${escapeHTML(prescription.frequency)}</p>
                    <p><strong>Duration:</strong> ${escapeHTML(prescription.duration)}</p>
                    <p><strong>Instructions:</strong> ${escapeHTML(prescription.instructions || "None")}</p>
                    <p><strong>Date:</strong> ${escapeHTML(prescription.date)}</p>
                </div>
            `).join("")
            : "No prescriptions available.";
    }

    // Prevent HTML injection when displaying database information
    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[character]);
    }

    // Log out
    document.getElementById("logoutBtn").addEventListener("click", function () {
        sessionStorage.removeItem("loggedInPatientId");
        sessionStorage.removeItem("loggedInRole");

        window.location.href = "../cst_project.html#login";
    });

    // Load all patient dashboard information
    try {
        await loadPatientDetails();
        await loadAppointments();
        await loadMedicalRecords();
        await loadDoctors();

    } catch (error) {
        console.error("Patient dashboard error:", error);
        document.getElementById("globalMessage").textContent =
            "Unable to load your information. Please try again.";
    }

});
