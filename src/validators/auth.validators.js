"use strict";

const Joi = require("joi");

const password = Joi.string()
  .min(8)
  .max(72) // bcrypt truncates at 72 bytes
  .required()
  .messages({
    "string.min": "Password must be at least 8 characters",
    "string.max": "Password must be at most 72 characters",
    "any.required": "Password is required",
  });

const signupSchema = Joi.object({
  name: Joi.string().trim().min(2).max(60).required(),
  email: Joi.string().email().lowercase().required(),
  phone: Joi.string().trim().min(7).max(20).required(),
  photo: Joi.string().uri().allow(null, "").default(null),
  password,
  role: Joi.string().valid("Admin", "Trainer", "Member").required(),
  // Only required + validated server-side when role === "Admin"
  adminCode: Joi.string().when("role", {
    is: "Admin",
    then: Joi.required(),
    otherwise: Joi.optional().allow(null, ""),
  }),
});

const loginSchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
  password: Joi.string().required(),
});

/**
 * Validate req.body against a Joi schema.
 * Returns { value, error }
 */
function validate(schema, body) {
  return schema.validate(body, { abortEarly: false, stripUnknown: true });
}

module.exports = { signupSchema, loginSchema, validate };
