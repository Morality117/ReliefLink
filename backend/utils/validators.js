
const CATEGORIES = [
  "Rescue",
  "Food",
  "Water",
  "Medical",
  "Other"
];

const PRIORITIES = [
  "Low",
  "Medium",
  "High",
  "Critical"
];

const STATUSES = [
  "Pending",
  "Verified",
  "Assigned",
  "In Progress",
  "Resolved",
  "Cancelled"
];

const isNonEmptyString = value =>
  typeof value === "string" &&
  value.trim().length > 0;

const isUuid = value =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const validateCreateRequest = body => {
  const errors = [];

  if (!CATEGORIES.includes(body.category)) {
    errors.push(
      `category must be one of: ${CATEGORIES.join(", ")}`
    );
  }

  if (!isNonEmptyString(body.description)) {
    errors.push("description is required");
  }

  if (
    body.description &&
    body.description.trim().length > 5000
  ) {
    errors.push(
      "description must be 5000 characters or fewer"
    );
  }

  const lat = body.latitude;
  const lng = body.longitude;

  if (
    (lat === undefined) !==
    (lng === undefined)
  ) {
    errors.push(
      "latitude and longitude must be provided together"
    );
  }

  if (
    lat !== undefined &&
    (!Number.isFinite(Number(lat)) ||
      Number(lat) < -90 ||
      Number(lat) > 90)
  ) {
    errors.push(
      "latitude must be between -90 and 90"
    );
  }

  if (
    lng !== undefined &&
    (!Number.isFinite(Number(lng)) ||
      Number(lng) < -180 ||
      Number(lng) > 180)
  ) {
    errors.push(
      "longitude must be between -180 and 180"
    );
  }

  for (const protectedField of [
    "priority",
    "status",
    "assigned_volunteer_id",
    "resident_id"
  ]) {
    if (
      Object.prototype.hasOwnProperty.call(
        body,
        protectedField
      )
    ) {
      errors.push(
        `${protectedField} cannot be set by this endpoint`
      );
    }
  }

  return errors;
};

const validateStatus = status =>
  STATUSES.includes(status);

module.exports = {
  CATEGORIES,
  PRIORITIES,
  STATUSES,
  isNonEmptyString,
  isUuid,
  validateCreateRequest,
  validateStatus
};
