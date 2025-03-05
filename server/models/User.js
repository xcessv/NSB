const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: true, 
    unique: true 
  },
  displayName: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String, 
    required: true,
    unique: true
  },
  password: { 
    type: String, 
    required: true 
  },
  profileImage: {
    type: String,
    default: '/api/placeholder/150/150'
  },
  role: { 
    type: String, 
    enum: ['user', 'admin'],
    default: 'user'
  },
 banned: {
   type: Boolean,
   default: false
 },
 banDate: {
   type: Date,
   default: null
 },
 lastActive: {
   type: Date,
   default: Date.now
 },
 reviewCount: {
   type: Number,
   default: 0
 },
 favorites: [{
   type: mongoose.Schema.Types.ObjectId,
   ref: 'Review'
 }],
 following: [{
   type: mongoose.Schema.Types.ObjectId,
   ref: 'User'
 }],
 followers: [{
   type: mongoose.Schema.Types.ObjectId,
   ref: 'User'
 }],
 notifications: [{
   type: mongoose.Schema.Types.ObjectId,
   ref: 'Notification'
 }],
 resetPasswordToken: String,
 resetPasswordExpires: Date,
 joinDate: { 
   type: Date, 
   default: Date.now 
 }
});

module.exports = mongoose.model('User', userSchema);