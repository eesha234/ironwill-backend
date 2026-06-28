"use strict";

const Joi = require("joi");

const decisionSchema = Joi.object({
  decision: Joi.string().valid("Approved", "Rejected", "Suspended").required(),
  notes: Joi.string().max(500).allow("", null).default(null),
});

const updateStatusSchema = Joi.object({
  accountStatus: Joi.string()
    .valid("Pending", "Trial", "Approved", "Rejected", "Suspended")
    .required(),
  notes: Joi.string().max(500).allow("", null).default(null),
});

function validate(schema, body) {
  return schema.validate(body, { abortEarly: false, stripUnknown: true });
}

module.exports = { decisionSchema, updateStatusSchema, validate };
