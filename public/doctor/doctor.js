document.addEventListener("DOMContentLoaded", function() {

    const doctorId = sessionStorage.getItem("loggedInDoctorId");
    const role = sessionStorage.getItem("loggedInRole");

    if(!doctorId || role !== "doctor") {
        alert("You must sign in as as doctor to access this page.");
        window.location.href = "../cst_project.html#login";
        return;
    }

    document.getElementById("doctorWelcome").textContent =
        "You are successfully signed in as a doctor.";
})