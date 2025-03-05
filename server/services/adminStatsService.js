const Review = require('../models/Review');
const User = require('../models/User');
const Report = require('../models/Report');

class AdminStatsService {
 static async getReviewStats(timeRange = 30) { // days
   const startDate = new Date();
   startDate.setDate(startDate.getDate() - timeRange);

   return await Review.aggregate([
     {
       $facet: {
         'ratingDistribution': [
           {
             $group: {
               _id: { 
                 $floor: '$rating'
               },
               count: { $sum: 1 }
             }
           },
           { $sort: { '_id': 1 } }
         ],
         'dailyReviews': [
           {
             $match: {
               date: { $gte: startDate }
             }
           },
           {
             $group: {
               _id: {
                 $dateToString: { format: '%Y-%m-%d', date: '$date' }
               },
               count: { $sum: 1 },
               avgRating: { $avg: '$rating' }
             }
           },
           { $sort: { '_id': 1 } }
         ],
         'topBeeferies': [
           {
             $group: {
               _id: '$beefery',
               reviewCount: { $sum: 1 },
               avgRating: { $avg: '$rating' },
               totalLikes: { $sum: { $size: '$likes' } }
             }
           },
           {
             $project: {
               score: {
                 $add: [
                   { $multiply: ['$avgRating', 10] },
                   '$reviewCount',
                   { $divide: ['$totalLikes', 2] }
                 ]
               },
               reviewCount: 1,
               avgRating: 1,
               totalLikes: 1
             }
           },
           { $sort: { score: -1 } },
           { $limit: 10 }
         ],
         'engagement': [
           {
             $group: {
               _id: null,
               totalLikes: { $sum: { $size: '$likes' } },
               totalComments: { $sum: { $size: '$comments' } },
               avgCommentsPerReview: { $avg: { $size: '$comments' } }
             }
           }
         ]
       }
     }
   ]);
 }

 static async getUserStats(timeRange = 30) { // days
   const startDate = new Date();
   startDate.setDate(startDate.getDate() - timeRange);

   return await User.aggregate([
     {
       $facet: {
         'userGrowth': [
           {
             $match: {
               joinDate: { $gte: startDate }
             }
           },
           {
             $group: {
               _id: {
                 $dateToString: { format: '%Y-%m-%d', date: '$joinDate' }
               },
               newUsers: { $sum: 1 }
             }
           },
           { $sort: { '_id': 1 } }
         ],
         'userTypes': [
           {
             $group: {
               _id: '$role',
               count: { $sum: 1 }
             }
           }
         ],
         'mostActiveUsers': [
           {
             $lookup: {
               from: 'reviews',
               localField: '_id',
               foreignField: 'userId',
               as: 'reviews'
             }
           },
           {
             $project: {
               displayName: 1,
               profileImage: 1,
               reviewCount: { $size: '$reviews' },
               totalLikes: {
                 $sum: { 
                   $map: {
                     input: '$reviews',
                     as: 'review',
                     in: { $size: '$$review.likes' }
                   }
                 }
               }
             }
           },
           { $sort: { reviewCount: -1 } },
           { $limit: 10 }
         ],
         'retention': [
           {
             $match: {
               lastActive: { $gte: startDate }
             }
           },
           {
             $group: {
               _id: {
                 $dateToString: { format: '%Y-%m-%d', date: '$lastActive' }
               },
               activeUsers: { $sum: 1 }
             }
           },
           { $sort: { '_id': 1 } }
         ]
       }
     }
   ]);
 }

 static async getReportStats(timeRange = 30) { // days
   const startDate = new Date();
   startDate.setDate(startDate.getDate() - timeRange);

   return await Report.aggregate([
     {
       $facet: {
         'reportTrends': [
           {
             $match: {
               date: { $gte: startDate }
             }
           },
           {
             $group: {
               _id: {
                 $dateToString: { format: '%Y-%m-%d', date: '$date' }
               },
               count: { $sum: 1 }
             }
           },
           { $sort: { '_id': 1 } }
         ],
         'reportTypes': [
           {
             $group: {
               _id: '$type',
               count: { $sum: 1 }
             }
           }
         ],
         'resolutionStats': [
           {
             $group: {
               _id: '$resolution',
               count: { $sum: 1 },
               avgResolutionTime: {
                 $avg: {
                   $subtract: ['$resolvedDate', '$date']
                 }
               }
             }
           }
         ],
         'mostReportedContent': [
           {
             $group: {
               _id: {
                 type: '$content.type',
                 id: '$content.id'
               },
               reportCount: { $sum: 1 }
             }
           },
           { $sort: { reportCount: -1 } },
           { $limit: 10 }
         ]
       }
     }
   ]);
 }

 static async getEngagementMetrics(timeRange = 30) {
   return {
     reviews: await this.getReviewStats(timeRange),
     users: await this.getUserStats(timeRange),
     reports: await this.getReportStats(timeRange)
   };
 }
}

module.exports = AdminStatsService;