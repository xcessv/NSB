// Simplified test-tags.js that doesn't require node-fetch
const mongoose = require('mongoose');
require('dotenv').config();

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/northshorebeefs';

async function testTagsDirectly() {
  try {
    // Connect to MongoDB directly
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB:', MONGODB_URI);
    
    // Get the News model
    const News = require('./models/News');
    
    // Find a test news item
    const newsItem = await News.findOne({}).exec();
    if (!newsItem) {
      console.error('No news items found to test');
      process.exit(1);
    }
    
    console.log('Found news item for testing:', {
      _id: newsItem._id,
      title: newsItem.title,
      currentTags: newsItem.tags || []
    });
    
    // Update the tags directly in MongoDB
    console.log('Updating tags directly in MongoDB...');
    
    // Define test tags
    const testTags = [
      { text: "Direct MongoDB Tag", color: "red" },
      { text: "Emergency Fix", color: "blue" }
    ];
    
    // Update the document directly
    const updateResult = await News.updateOne(
      { _id: newsItem._id },
      { $set: { tags: testTags } }
    );
    
    console.log('MongoDB update result:', updateResult);
    
    // Verify the update
    const updatedNews = await News.findById(newsItem._id);
    console.log('News item after direct update:', {
      _id: updatedNews._id,
      title: updatedNews.title,
      updatedTags: updatedNews.tags || []
    });
    
    console.log('Test completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testTagsDirectly();