"use strict";

/**
 * ADMS (iClock push protocol) endpoints.
 *
 * This is the protocol eSSL/ZKTeco devices speak when their "Cloud Server
 * Setting" is pointed at a server (Comm > ADMS). The device is the client —
 * it calls out to us, so no port-forwarding or local PC bridge is required.
 *
 * Flow:
 *   1. GET  /iclock/cdata?SN=...&options=all   → handshake, we reply with config text
 *   2. POST /iclock/cdata?SN=...&table=ATTLOG  → device pushes punch logs (plain text body)
 *   3. GET  /iclock/getrequest?SN=...          → device polls for pending commands
 *   4. POST /iclock/devicecmd?SN=...           → device reports command results
 *
 * All responses are plain text (not JSON) — this is part of the protocol spec,
 * the device firmware does not parse JSON here.
 */

const Member = require("../models/Member");
const Attendance = require("../models/Attendance");

// Optional shared secret check. If ADMS_COMM_KEY is set in env, require it to
// match the device's Comm Key (devices send it as a query param `commkey` on
// some firmware versions; many older eSSL units don't send it at all, so this
// check is skipped entirely when the device doesn't send one).
function commKeyOk(req) {
  const expected = process.env.ADMS_COMM_KEY;
  if (!expected) return true; // not configured → don't enforce
  const provided = req.query.commkey || req.query.CommKey;
  if (!provided) return true; // older firmware doesn't send it — can't enforce
  return String(provided) === String(expected);
}

// ─── Handshake ──────────────────────────────────────────────────────────────
// Device calls this first to fetch its operating parameters.
function handshake(req, res) {
  const sn = req.query.SN || "unknown";
  console.log(`[ADMS] Handshake from device SN=${sn}`);

  const lines = [
    `GET OPTION FROM: ${sn}`,
    "Stamp=9999",
    "OpStamp=9999",
    "ErrorDelay=60",
    "Delay=30",
    "TransTimes=00:00;14:05",
    "TransInterval=1",
    "TransFlag=1111000000",
    "Realtime=1",
    "Encrypt=None",
  ];

  res.set("Content-Type", "text/plain");
  return res.send(lines.join("\n"));
}

// ─── Attendance log push ────────────────────────────────────────────────────
// Body is plain text, one punch per line, tab-separated:
//   PIN<TAB>TIME<TAB>STATUS<TAB>VERIFY<TAB>WORKCODE...
// PIN is the numeric user ID enrolled on the device — we match it against
// Member.deviceUserId.
async function pushAttendance(req, res, next) {
  try {
    const sn = req.query.SN || "unknown";
    const table = req.query.table;

    if (table !== "ATTLOG") {
      // Other tables (OPERLOG, BIODATA photos, etc.) — acknowledge, ignore.
      return res.set("Content-Type", "text/plain").send("OK");
    }

    if (!commKeyOk(req)) {
      console.warn(`[ADMS] Rejected push from SN=${sn}: bad comm key`);
      return res.status(401).set("Content-Type", "text/plain").send("FAIL");
    }

    const body = typeof req.body === "string" ? req.body : "";
    const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);

    let processed = 0;
    for (const line of lines) {
      const cols = line.split("\t");
      const pin = (cols[0] || "").trim();
      const timeStr = (cols[1] || "").trim();
      if (!pin || !timeStr) continue;

      try {
        await recordPunch(pin, timeStr);
        processed++;
      } catch (e) {
        console.error(`[ADMS] Failed to process punch PIN=${pin}:`, e.message);
      }
    }

    console.log(`[ADMS] SN=${sn} pushed ${lines.length} line(s), processed ${processed}`);
    return res.set("Content-Type", "text/plain").send("OK");
  } catch (err) {
    next(err);
  }
}

// Resolve a device punch into an Attendance record.
// First punch of the day → check-in. Second punch (existing open record) → check-out.
async function recordPunch(deviceUserId, deviceTimeStr) {
  const member = await Member.findOne({ deviceUserId }).select("_id name").lean();
  if (!member) {
    console.warn(`[ADMS] No member mapped to deviceUserId=${deviceUserId} — skipping`);
    return;
  }

  // Device sends local time as "YYYY-MM-DD HH:mm:ss"
  const punchDate = new Date(deviceTimeStr.replace(" ", "T"));
  const isoTime = isNaN(punchDate.getTime()) ? new Date().toISOString() : punchDate.toISOString();
  const dateKey = isoTime.split("T")[0];

  const openRecord = await Attendance.findOne({
    memberId: member._id,
    date: dateKey,
    checkOut: null,
  });

  if (openRecord) {
    // Second punch today → checkout
    const duration = Math.round(
      (new Date(isoTime).getTime() - new Date(openRecord.checkIn).getTime()) / 60000
    );
    if (duration <= 0) return; // duplicate/out-of-order punch, ignore
    openRecord.checkOut = isoTime;
    openRecord.duration = duration;
    await openRecord.save();
  } else {
    // First punch today → checkin
    const hour = punchDate.getHours();
    const status = hour >= 10 ? "Late" : "Present";
    await Attendance.create({
      memberId: member._id,
      memberName: member.name,
      checkIn: isoTime,
      checkOut: null,
      duration: null,
      date: dateKey,
      status,
    });
  }
}

// ─── Command polling ────────────────────────────────────────────────────────
// We don't currently push commands (e.g. "delete user X") down to the device,
// so always respond with no pending commands.
function getRequest(req, res) {
  return res.set("Content-Type", "text/plain").send("OK");
}

// ─── Command result reporting ───────────────────────────────────────────────
function deviceCmd(req, res) {
  return res.set("Content-Type", "text/plain").send("OK");
}

module.exports = { handshake, pushAttendance, getRequest, deviceCmd };
