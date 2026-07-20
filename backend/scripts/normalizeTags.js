/**
 * One-off migration: normalize all course tags to the canonical stored form
 * (trimmed, uppercase, deduped, max 20 tags of 50 chars).
 *
 * Usage: node scripts/normalizeTags.js
 */
require("dotenv").config();
const mongoose = require("mongoose");
const Course   = require("../models/Course");

const sanitizeTags = (tags) => [
  ...new Set(
    (Array.isArray(tags) ? tags : [])
      .map((t) => String(t).trim().toUpperCase().slice(0, 50))
      .filter(Boolean)
  ),
].slice(0, 20);

(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const courses = await Course.find({ tags: { $exists: true, $ne: [] } }).select("tags");
  let updated = 0;

  for (const course of courses) {
    const normalized = sanitizeTags(course.tags);
    if (JSON.stringify(normalized) !== JSON.stringify(course.tags)) {
      course.tags = normalized;
      await course.save();
      updated++;
    }
  }

  console.log(`Checked ${courses.length} courses, normalized tags on ${updated}.`);
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
