const express = require("express");
const path = require("path");

const app = express();

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "cst_project.html"))
})

const doctors = [
    {
        id: 1,
        name: "Dr. Sarah Ahmed",
        email: "sarah@example.com",
        speciality: "Cardiology"
    },
    {
    id: 2,
    name: "Dr. James Smith",
    email: "james@example.com",
    specialty: "Dermatology"
  }
];
app.get("/api/doctors", (req,res) => {
    res.json(doctors);
})
app.listen(3000, () => {
    console.log("Server running at http://localhost:3000")
})