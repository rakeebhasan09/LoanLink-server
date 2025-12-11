require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
	res.send("LoanLink server always running!");
});

app.listen(port, () => {
	console.log(`Example app listening on port ${port}`);
});
