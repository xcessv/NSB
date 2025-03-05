const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
 type: { 
   type: String, 
   enum: ['review', 'comment', 'user'],
   required: true 
 },
 contentId: {
   type: mongoose.Schema.Types.ObjectId,
   required: true,
   refPath: 'type'
 },
 contentPreview: String,
 reason: {
   type: String,
   required: true
 },
 reportedBy: {
   type: mongoose.Schema.Types.ObjectId,
   ref: 'User',
   required: true
 },
 status: {
   type: String,
   enum: ['pending', 'reviewing', 'resolved', 'dismissed'],
   default: 'pending'
 },
 resolution: {
   type: String,
   enum: ['removed', 'dismissed', 'warning'],
   default: null
 },
 resolvedBy: {
   type: mongoose.Schema.Types.ObjectId,
   ref: 'User'
 },
 resolvedDate: Date,
 notes: String,
 date: {
   type: Date,
   default: Date.now
 }
});

reportSchema.index({ status: 1, date: -1 });

module.exports = mongoose.model('Report', reportSchema);