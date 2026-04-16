import Database from 'better-sqlite3';
import fs from 'fs';
import crypto from 'crypto';

// Create data directory if it doesn't exist
if (!fs.existsSync('./data')) {
  fs.mkdirSync('./data', { recursive: true });
}

const db = new Database('./data/app.db');

// Check if data already exists
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
if (userCount.count > 0) {
  console.log('Data already seeded, skipping...');
  process.exit(0);
}

// Helper function to generate password hash (matching auth.js implementation)
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return salt + ':' + hash;
}

// Helper function to generate share code
function generateShareCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase() + Date.now().toString(36).toUpperCase();
}

// Helper to get random date within last 30 days
function getRandomDate(daysAgo) {
  const date = new Date(Date.now() - daysAgo * 86400000);
  return date.toISOString();
}

// Helper to get random item from array
function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Wardrobe categories
const categories = ['Tops', 'Bottoms', 'Outerwear', 'Shoes', 'Accessories'];

// Occasions
const occasions = ['Work', 'Casual', 'Date Night', 'Workout', 'Formal'];

// Weather conditions
const weathers = ['Sunny', 'Rainy', 'Cold', 'Hot'];

// Colors
const colors = ['Black', 'White', 'Navy', 'Gray', 'Beige', 'Burgundy', 'Olive', 'Denim Blue', 'Cream', 'Forest Green', 'Dusty Rose', 'Charcoal'];

// Wardrobe item names by category
const itemNames = {
  Tops: [
    'Classic White Button-Down',
    'Silk Blouse in Ivory',
    'Cashmere Crewneck Sweater',
    'Striped Breton Top',
    'Linen Blend Shirt',
    'Fitted Black Turtleneck',
    'Oversized Cotton Tee',
    'Chambray Button-Up',
    'Merino Wool Cardigan',
    'Satin Camisole'
  ],
  Bottoms: [
    'High-Rise Straight Leg Jeans',
    'Tailored Wool Trousers',
    'Pleated Midi Skirt',
    'Cotton Chino Shorts',
    'Wide-Leg Palazzo Pants',
    'A-Line Denim Skirt',
    'Slim Fit Dress Pants',
    'Cropped Cigarette Pants',
    'Suede Mini Skirt',
    'Linen Drawstring Pants'
  ],
  Outerwear: [
    'Wool Blend Peacoat',
    'Leather Moto Jacket',
    'Trench Coat in Khaki',
    'Quilted Puffer Vest',
    'Denim Trucker Jacket',
    'Cashmere Wrap Coat',
    'Bomber Jacket in Olive',
    'Blazer in Navy Pinstripe',
    'Faux Fur Vest',
    'Lightweight Rain Jacket'
  ],
  Shoes: [
    'Leather Ankle Boots',
    'White Leather Sneakers',
    'Suede Loafers',
    'Classic Black Pumps',
    'Strappy Sandals',
    'Canvas Slip-Ons',
    'Chelsea Boots in Brown',
    'Pointed Flats',
    'Block Heel Mules',
    'Running Trainers'
  ],
  Accessories: [
    'Leather Belt in Brown',
    'Silk Scarf in Floral Print',
    'Structured Tote Bag',
    'Minimalist Watch',
    'Gold Hoop Earrings',
    'Crossbody Bag in Black',
    'Cashmere Beanie',
    'Leather Gloves',
    'Statement Necklace',
    'Woven Straw Hat'
  ]
};

// Outfit names
const outfitNames = [
  'Monday Office Ready',
  'Weekend Brunch Look',
  'Client Meeting Ensemble',
  'Casual Friday Vibes',
  'Date Night Elegance',
  'Coffee Run Comfort',
  'Presentation Day Power',
  'Sunday Stroll Style',
  'After Work Drinks',
  'Gym to Street',
  'Beach Day Ready',
  'Autumn Layers',
  'Summer Minimalist',
  'Winter Warmth',
  'Spring Fresh',
  'Business Casual Classic',
  'Creative Studio Look',
  'Outdoor Adventure',
  'Evening Sophistication',
  'Travel Comfort'
];

// Insert all data in a single transaction
const insertAll = db.transaction(() => {
  // Create demo users
  const userStmt = db.prepare('INSERT INTO users (email, password_hash, name, created_at) VALUES (?, ?, ?, ?)');
  
  const users = [
    { email: 'sarah.chen@email.com', name: 'Sarah Chen', daysAgo: 28 },
    { email: 'marcus.johnson@company.org', name: 'Marcus Johnson', daysAgo: 21 },
    { email: 'elena.rodriguez@design.co', name: 'Elena Rodriguez', daysAgo: 14 }
  ];
  
  const userIds = [];
  const passwordHash = hashPassword('password123');
  
  users.forEach(user => {
    const result = userStmt.run(user.email, passwordHash, user.name, getRandomDate(user.daysAgo));
    userIds.push(result.lastInsertRowid);
  });

  // Create mannequins for users
  const mannequinStmt = db.prepare('INSERT INTO mannequins (user_id, image_data, silhouette_data, created_at) VALUES (?, ?, ?, ?)');
  
  userIds.forEach((userId, index) => {
    const silhouetteData = JSON.stringify({
      height: 165 + index * 5,
      bodyType: ['hourglass', 'athletic', 'slim'][index],
      measurements: {
        shoulders: 38 + index * 2,
        chest: 86 + index * 3,
        waist: 68 + index * 2,
        hips: 92 + index * 3
      }
    });
    mannequinStmt.run(
      userId,
      `mannequin_image_user_${userId}.jpg`,
      silhouetteData,
      getRandomDate(25 - index * 5)
    );
  });

  // Create wardrobe items for each user
  const itemStmt = db.prepare('INSERT INTO wardrobe_items (user_id, category, name, color, image_data, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  
  const itemIds = [];
  
  userIds.forEach((userId, userIndex) => {
    // Each user gets 12-18 items spread across categories
    const itemCounts = {
      Tops: 4 + Math.floor(Math.random() * 2),
      Bottoms: 3 + Math.floor(Math.random() * 2),
      Outerwear: 2 + Math.floor(Math.random() * 2),
      Shoes: 2 + Math.floor(Math.random() * 2),
      Accessories: 2 + Math.floor(Math.random() * 2)
    };
    
    let daysOffset = 20 - userIndex * 5;
    
    Object.entries(itemCounts).forEach(([category, count]) => {
      const availableNames = [...itemNames[category]];
      
      for (let i = 0; i < count; i++) {
        const nameIndex = Math.floor(Math.random() * availableNames.length);
        const name = availableNames.splice(nameIndex, 1)[0];
        const color = randomItem(colors);
        const metadata = JSON.stringify({
          brand: randomItem(['Everlane', 'COS', '& Other Stories', 'Uniqlo', 'Madewell', 'Reformation', 'Massimo Dutti', 'Zara', 'H&M', 'Nordstrom']),
          size: ['XS', 'S', 'M', 'L', 'XL'][Math.floor(Math.random() * 5)],
          material: randomItem(['Cotton', 'Wool', 'Silk', 'Linen', 'Polyester', 'Cashmere', 'Denim', 'Leather']),
          season: randomItem(['Spring', 'Summer', 'Fall', 'Winter', 'All Season']),
          timesWorn: Math.floor(Math.random() * 15)
        });
        
        const result = itemStmt.run(
          userId,
          category,
          name,
          color,
          `item_${category.toLowerCase()}_${userId}_${i}.jpg`,
          metadata,
          getRandomDate(daysOffset - i * 0.5)
        );
        itemIds.push({ id: result.lastInsertRowid, userId, category });
        daysOffset -= 0.3;
      }
    });
  });

  // Create outfits for each user
  const outfitStmt = db.prepare('INSERT INTO outfits (user_id, name, occasion, weather, items_json, preview_data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  
  const outfitIds = [];
  
  userIds.forEach((userId, userIndex) => {
    const userItems = itemIds.filter(item => item.userId === userId);
    const outfitCount = 8 + Math.floor(Math.random() * 5);
    let daysOffset = 18 - userIndex * 4;
    
    for (let i = 0; i < outfitCount; i++) {
      const name = outfitNames[(userIndex * 5 + i) % outfitNames.length];
      const occasion = randomItem(occasions);
      const weather = randomItem(weathers);
      
      // Select 2-4 items for outfit
      const itemCount = 2 + Math.floor(Math.random() * 3);
      const selectedItems = [];
      const usedCategories = new Set();
      
      // Try to get items from different categories
      const shuffledItems = [...userItems].sort(() => Math.random() - 0.5);
      
      for (const item of shuffledItems) {
        if (selectedItems.length >= itemCount) break;
        if (!usedCategories.has(item.category)) {
          selectedItems.push(item.id);
          usedCategories.add(item.category);
        }
      }
      
      // Fill remaining slots if needed
      while (selectedItems.length < itemCount && selectedItems.length < userItems.length) {
        const remainingItems = userItems.filter(item => !selectedItems.includes(item.id));
        if (remainingItems.length === 0) break;
        const randomIdx = Math.floor(Math.random() * remainingItems.length);
        selectedItems.push(remainingItems[randomIdx].id);
      }
      
      const itemsJson = JSON.stringify(selectedItems);
      
      const result = outfitStmt.run(
        userId,
        name,
        occasion,
        weather,
        itemsJson,
        `outfit_preview_${userId}_${i}.jpg`,
        getRandomDate(daysOffset - i * 1.5)
      );
      outfitIds.push({ id: result.lastInsertRowid, userId });
    }
  });

  // Create saved looks
  const savedLookStmt = db.prepare('INSERT INTO saved_looks (user_id, outfit_id, is_favorite, created_at) VALUES (?, ?, ?, ?)');
  
  outfitIds.forEach((outfit, index) => {
    // Save about 60% of outfits
    if (Math.random() < 0.6) {
      const isFavorite = Math.random() < 0.35 ? 1 : 0;
      savedLookStmt.run(
        outfit.userId,
        outfit.id,
        isFavorite,
        getRandomDate(15 - index * 0.3)
      );
    }
  });

  // Create shared outfits
  const sharedOutfitStmt = db.prepare('INSERT INTO shared_outfits (outfit_id, share_code, created_at) VALUES (?, ?, ?)');
  
  // Share about 30% of outfits
  outfitIds.forEach((outfit, index) => {
    if (Math.random() < 0.3) {
      const shareCode = generateShareCode();
      sharedOutfitStmt.run(
        outfit.id,
        shareCode,
        getRandomDate(10 - index * 0.2)
      );
    }
  });
});

// Execute the transaction
insertAll();

// Count records for summary
const counts = {
  users: db.prepare('SELECT COUNT(*) as count FROM users').get().count,
  mannequins: db.prepare('SELECT COUNT(*) as count FROM mannequins').get().count,
  wardrobe_items: db.prepare('SELECT COUNT(*) as count FROM wardrobe_items').get().count,
  outfits: db.prepare('SELECT COUNT(*) as count FROM outfits').get().count,
  saved_looks: db.prepare('SELECT COUNT(*) as count FROM saved_looks').get().count,
  shared_outfits: db.prepare('SELECT COUNT(*) as count FROM shared_outfits').get().count
};

db.close();

console.log('StyleMuse database seeded successfully!');
console.log(`Seeded: ${counts.users} users, ${counts.mannequins} mannequins, ${counts.wardrobe_items} wardrobe items, ${counts.outfits} outfits, ${counts.saved_looks} saved looks, ${counts.shared_outfits} shared outfits`);
console.log('');
console.log('Demo users:');
console.log('  - sarah.chen@email.com / password123');
console.log('  - marcus.johnson@company.org / password123');
console.log('  - elena.rodriguez@design.co / password123');