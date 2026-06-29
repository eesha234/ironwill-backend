"use strict";
const express = require("express");
const router = express.Router();
const { handshake, receiveData, getRequest, deviceCmd } = require("../controllers/adms.controller");

router.get("/cdata", handshake);
router.post("/cdata", receiveData);
router.get("/getrequest", getRequest);
router.post("/devicecmd", deviceCmd);

module.exports = router;