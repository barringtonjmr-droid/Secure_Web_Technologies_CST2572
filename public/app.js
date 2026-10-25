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
        
            try {
                await addPatient(name, email, phone);
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

document  
    .getElementById("loadAppointments")
    .addEventListener("click", displayAppointments);