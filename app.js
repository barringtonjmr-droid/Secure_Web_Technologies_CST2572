    const db_name = "MedicalAppointments";
    const db_version = 1;

    function openDatabase(){
        return new Promise((resolve, result) => {
            const request = indexedDB.open(db_name, db_version)

            request.onupgradeneeded = () => {
                const db = request.result;
                
            if (!db.objectStoresNames.contains(users)){
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
        const tx = db.transaction(storeName, readwrite);
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