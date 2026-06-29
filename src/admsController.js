"use strict";

const Member = require("../models/Member");
const Attendance = require("../models/Attendance");
const BiometricDevice = require("../models/BiometricDevice");

const handshake = async (req, res) => {
  const sn = req.query.SN || "";
  console.log(`[ADMS] Handshake from device: ${sn}`);
  try {
    await BiometricDevice.findOneAndUpdate(
      { serialNumber: sn },
      { lastSync: new Date(), deviceName: sn, serialNumber: sn },
      { upsert: true, new: true }
    );
  } catch (e) {
    console.error("[ADMS] Device upsert error:", e.message);
  }
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  res.set("Content-Type", "text/plain");
  res.send(`GET OPTION FROM: ${sn}\nATTLOGSTAMP=None\nOPERSTAMP=9999\nATTPHOTO=0\nErrorDelay=30\nDelay=10\nTransTimes=00:00;14:05\nTransInterval=1\nTransFlag=TransData AttLog\nTimeZone=5.5\nRealtime=1\nEncrypt=None\nServerVer=2.4.1 ${timestamp}\n`);
};

const receiveData = async (req, res) => {
  const sn = req.query.SN || "";
  const body = req.body || "";
  const text = typeof body === "string" ? body : JSON.stringify(body);
  console.log(`[ADMS] Data from ${sn}:`, text);
  const lines = text.split("\n").filter((l) => l.startsWith("ATTLOG"));
  for (const line of lines) {
    try {
      const parts = line.replace("ATTLOG ", "").trim().split("\t");
      const pin = parts[0];
      const dateStr = parts[1];
      const timeStr = parts[2];
      const punchType = parts[3];
      if (!pin || !dateStr) continue;
      const member = await Member.findOne({ biometricId: pin });
      if (!member) { console.warn(`[ADMS] No member for PIN: ${pin}`); continue; }
      const isoDateTime = `${dateStr}T${timeStr || "00:00:00"}`;
      if (punchType === "0" || punchType === undefined) {
        const existing = await Attendance.findOne({ memberId: member._id, date: dateStr });
        if (!existing) {
          await Attendance.create({ memberId: member._id, memberName: member.name, checkIn: isoDateTime, date: dateStr, status: "Present" });
        }
      } else if (punchType === "1") {
        const record = await Attendance.findOne({ memberId: member._id, date: dateStr });
        if (record && !record.checkOut) {
          const duration = Math.round((new Date(isoDateTime) - new Date(record.checkIn)) / 60000);
          record.checkOut = isoDateTime;
          record.duration = duration > 0 ? duration : null;
          await record.save();
        }
      }
    } catch (err) {
      console.error("[ADMS] Error:", err.message);
    }
  }
  res.set("Content-Type", "text/plain");
  res.send("OK");
};

const getRequest = (_req, res) => { res.set("Content-Type", "text/plain"); res.send("OK"); };
const deviceCmd = (_req, res) => { res.set("Content-Type", "text/plain"); res.send("OK"); };

module.exports = { handshake, receiveData, getRequest, deviceCmd };
