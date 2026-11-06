document.addEventListener("DOMContentLoaded", () => {
    const doctorId = sessionStorage.getItem("loggedInDoctorId");
    const role = sessionStorage.getItem("loggedInRole");

    if (!doctorId || role !== "doctor") {
        alert("You must sign in as a doctor to access this page.");
        window.location.href = "../cst_project.html#login";
        return;
    }

    const welcome = document.getElementById("doctorWelcome");
    if (welcome) welcome.textContent = "You are successfully signed in as a doctor.";

    const searchInput = document.getElementById("searchPatient");
    const patientList = document.getElementById("doctorPatientlist");
    const recordPanel = document.getElementById("doctorRecord");
    const recordDetails = document.getElementById("doctorRecordDetails");
    const recordTitle = document.getElementById("selectedPatientTitle");

    let patients = [];
    let selectedPatient = null;

    const today = new Date().toISOString().slice(0, 10);
    ["historyDate", "noteDate", "prescriptionDate"].forEach(id => {
        const input = document.getElementById(id);
        if (input && !input.value) input.value = today;
    });

    function makeElement(tag, text, className) {
        const element = document.createElement(tag);
        if (text !== undefined && text !== null) element.textContent = String(text);
        if (className) element.className = className;
        return element;
    }

    async function requestJson(url, options = {}) {
        const response = await fetch(url, options);
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(result.error || `Request failed (${response.status}).`);
        }
        return result;
    }

    async function loadPatients() {
        patientList.replaceChildren(makeElement("p", "Loading patients...", "muted"));
        try {
            patients = await requestJson("/api/patients");
            if (!Array.isArray(patients)) throw new Error("Unexpected patient data received.");
            renderPatients(patients);
        } catch (error) {
            console.error("Could not load patients:", error);
            patientList.replaceChildren(makeElement("p", "Could not load patients. Please try again.", "message error"));
        }
    }

    function renderPatients(items) {
        patientList.replaceChildren();
        if (!items.length) {
            patientList.appendChild(makeElement("p", "No patients found.", "muted"));
            return;
        }

        items.forEach(patient => {
            const card = makeElement("button", undefined, "patient-card");
            card.type = "button";
            card.append(
                makeElement("span", patient.name || `Patient #${patient.id}`, "patient-name"),
                makeElement("span", patient.email || "Email not available", "patient-meta")
            );
            if (String(selectedPatient?.id) === String(patient.id)) {
                card.classList.add("selected");
            }
            card.addEventListener("click", () => selectPatient(patient));
            patientList.appendChild(card);
        });
    }

    function filterPatients() {
        const term = (searchInput?.value || "").trim().toLowerCase();
        const filtered = patients.filter(patient =>
            [patient.name, patient.email, patient.id, patient.phone]
                .some(value => String(value ?? "").toLowerCase().includes(term))
        );
        renderPatients(filtered);
    }

    async function selectPatient(patient) {
    selectedPatient = patient;

    renderPatients(patients.filter(item => {
        const term = (searchInput?.value || "").trim().toLowerCase();

        return [item.name, item.email, item.id, item.phone]
            .some(value =>
                String(value ?? "").toLowerCase().includes(term)
            );
    }));

    recordPanel.hidden = false;

    recordTitle.textContent =
        `Patient Record: ${patient.name || `#${patient.id}`}`;

    recordDetails.replaceChildren(
        makeElement("p", "Loading patient details...", "muted")
    );

    try {
        const details = await requestJson(
            `/api/patients/${encodeURIComponent(patient.id)}`
        );

        recordDetails.replaceChildren();

        const detailGrid = makeElement("div", undefined, "patient-details");

        [
            ["Patient ID", details.id],
            ["Name", details.name]
        ].forEach(([label, value]) => {
            const item = makeElement("div", undefined, "detail-item");

            item.append(
                makeElement("span", label, "detail-label"),
                makeElement("strong", value ?? "—", "detail-value")
            );

            detailGrid.appendChild(item);
        });

        recordDetails.appendChild(detailGrid);

    } catch (error) {
        console.error("Could not load patient details:", error);

        recordDetails.replaceChildren(
            makeElement(
                "p",
                "Patient details could not be loaded.",
                "message error"
            )
        );
    }
}

    function bindRecordForm(formId, messageId, endpointSuffix, getPayload, successText) {
        const form = document.getElementById(formId);
        const message = document.getElementById(messageId);
        if (!form) return;

        form.addEventListener("submit", async event => {
            event.preventDefault();
            if (!selectedPatient) {
                if (message) message.textContent = "Please select a patient first.";
                return;
            }
            if (message) {
                message.textContent = "";
                message.className = "message";
            }

            const submitButton = form.querySelector('button[type="submit"]');
            if (submitButton) submitButton.disabled = true;

            try {
                const payload = {
                    ...getPayload(),
                    patientId: selectedPatient.id,
                    doctorId
                };

                // Assumes POST /api/patients/:id/{history|notes|prescriptions}.
                const result = await requestJson(
                    `/api/patients/${encodeURIComponent(selectedPatient.id)}/${endpointSuffix}`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload)
                    }
                );

                if (message) {
                    message.textContent = result.message || successText;
                    message.className = "message success";
                }
                form.reset();
                const dateInput = form.querySelector('input[type="date"]');
                if (dateInput) dateInput.value = today;
            } catch (error) {
                console.error(`Could not save ${endpointSuffix}:`, error);
                if (message) {
                    message.textContent = error.message || "Could not save this record.";
                    message.className = "message error";
                }
            } finally {
                if (submitButton) submitButton.disabled = false;
            }
        });
    }

    bindRecordForm("historyForm", "historyMessage", "history", () => ({
        date: document.getElementById("historyDate").value,
        title: document.getElementById("historyTitle").value.trim(),
        details: document.getElementById("historyDetails").value.trim()
    }), "Medical history saved successfully.");

    bindRecordForm("noteForm", "noteMessage", "notes", () => ({
        date: document.getElementById("noteDate").value,
        note: document.getElementById("noteText").value.trim()
    }), "Clinical note saved successfully.");

    bindRecordForm("prescriptionForm", "prescriptionMessage", "prescriptions", () => ({
        date: document.getElementById("prescriptionDate").value,
        medicine: document.getElementById("medicineName").value.trim(),
        dosage: document.getElementById("medicineDosage").value.trim(),
        frequency: document.getElementById("medicineFrequency").value.trim(),
        duration: document.getElementById("medicineDuration").value.trim(),
        instructions: document.getElementById("medicineInstructions").value.trim()
    }), "Prescription saved successfully.");

    if (searchInput) searchInput.addEventListener("input", filterPatients);
    loadPatients();
});
