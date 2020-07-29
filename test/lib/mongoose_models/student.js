const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  id: { type: Number, required: true},
  name: { type: String, required: true},
});

const studentModel = new mongoose.model('Student', studentSchema);

module.exports = studentModel;
