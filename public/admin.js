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
        displayAppointments(appointments, patients, doctors);

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



function displayAppointments(appointments, patients, doctors) {
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
})
