"use strict";

const express = require("express");
const { handshake, pushAttendance, getRequest, deviceCmd } = require("../controllers/adms.controller");

const router = express.Router();

// Devices send plain text, not JSON — parse the raw body as text for this router only.
router.use(express.text({ type: "*/*", limit: "5mb" }));

router.get("/cdata", handshake);
router.post("/cdata", pushAttendance);
router.get("/getrequest", getRequest);
router.post("/devicecmd", deviceCmd);

module.exports = router;
