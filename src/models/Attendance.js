"use strict";

const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: true,
      index: true,
    },
    memberName: { type: String, required: true, trim: true },
    checkIn: { type: String, required: true },   // ISO datetime
    checkOut: { type: String, default: null },    // ISO datetime
    duration: { type: Number, default: null },    // minutes
    date: { type: String, required: true, index: true }, // YYYY-MM-DD
    status: {
      type: String,
      enum: ["Present", "Late", "Absent"],
      default: "Present",
    },
  },
  { timestamps: true }
);

attendanceSchema.index({ memberId: 1, date: 1 });
attendanceSchema.index({ date: 1, status: 1 });

attendanceSchema.methods.toPublic = function () {
  const obj = this.toObject({ virtuals: true });
  obj.id = obj._id.toString();
  obj.memberId = obj.memberId.toString();
  delete obj._id;
  delete obj.__v;
  return obj;
};

const Attendance = mongoose.model("Attendance", attendanceSchema);
module.exports = Attendance;
