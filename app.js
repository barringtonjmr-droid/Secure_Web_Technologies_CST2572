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
    const db_version = 2;
      function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(db_name, db_version);

        request.onupgradeneeded = () => {
            const db = request.result;

            if (!db.objectStoreNames.contains("users")) {
                const usersStore = db.createObjectStore("users", {
                    keyPath: "id",
                    autoIncrement: true
                });
                usersStore.createIndex("email", "email", { unique: true });
            }

            if (!db.objectStoreNames.contains("doctors")) {
                db.createObjectStore("doctors", {
                    keyPath: "id",
                    autoIncrement: true
                });
            }

            if (!db.objectStoreNames.contains("patients")) {
                db.createObjectStore("patients", {
                    keyPath: "id",
                    autoIncrement: true
                });
            }

            if (!db.objectStoreNames.contains("appointments")) {
                const appointmentStore = db.createObjectStore("appointments", {
                    keyPath: "id",
                    autoIncrement: true
                });
                appointmentStore.createIndex("doctorId", "doctorId");
                appointmentStore.createIndex("patientId", "patientId");
                appointmentStore.createIndex("date", "date");
            }

            if (!db.objectStoreNames.contains("availability")) {
                db.createObjectStore("availability", {
                    keyPath: "id",
                    autoIncrement: true
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
        const tx = db.transction(storeName,"readonly");
        const request = tx.objectStore(storeName).getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);

        tx.oncomplete = () => db.close();
        tx.onerror = () => db.close();c

    });

}
async function getRecord(storeName, id){
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const request = tx.objectStore(storeName).get(id);

        request.onsucess = () => resolve(request.result);
        request.onerror = () => reject(request.error);

        tx.oncomplete = () => db.close();
        tx.onerror = () => db.close();
    });
    
}
async function getALLRecords(storeName) {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
        const tx = db.transction(storeName,"readonly");
        const request = tx.objectStore(storeName).getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);

        tx.oncomplete = () => db.close();
        tx.onerror = () => db.close();c

    });

}
async function getRecord(storeName, id){
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const request = tx.objectStore(storeName).get(id);

        request.onsucess = () => resolve(request.result);
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
async function displayAppointments() {
    const list = document.getElementById("appointmentList");
    const message = document.getElementByUd("message");

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
                appointment.doctorId
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
    .getElementById("loadAppointments")
    .addEventListener("click", displayAppointments);

   // * Habbani's encryption work*.
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

    // Keep the values needed for decryption.
    return {
        encryptedData: encryptedData,
        salt: salt,
        iv: iv
    };
}