import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  createUser,
  getUserByEmail,
  getUserById,
  createMannequin,
  getMannequinByUserId,
  updateMannequin,
  createWardrobeItem,
  getWardrobeItemById,
  getWardrobeItemsByUserId,
  updateWardrobeItem,
  deleteWardrobeItem,
  createOutfit,
  getOutfitById,
  getOutfitsByUserId,
  deleteOutfit,
  createSavedLook,
  getSavedLooksByUserId,
  updateSavedLook,
  deleteSavedLook,
  getSavedLookByUserAndOutfit,
  createSharedOutfit,
  getSharedOutfitByCode,
  getSharedOutfitByOutfitId,
  getAnalytics
} from './db.js';
import {
  hashPassword,
  verifyPassword,
  generateToken,
  authMiddleware,
  generateShareCode
} from './auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${new Date().toISOString()} ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

app.use(express.static(path.join(__dirname, '../frontend')));

function categorizeItem(name, color) {
  const nameLower = (name || '').toLowerCase();
  
  if (nameLower.includes('shirt') || nameLower.includes('blouse') || nameLower.includes('t-shirt') || nameLower.includes('tee') || nameLower.includes('top') || nameLower.includes('sweater') || nameLower.includes('hoodie') || nameLower.includes('polo') || nameLower.includes('tank')) {
    return 'Tops';
  }
  if (nameLower.includes('pant') || nameLower.includes('jean') || nameLower.includes('short') || nameLower.includes('skirt') || nameLower.includes('trouser') || nameLower.includes('legging') || nameLower.includes('chino')) {
    return 'Bottoms';
  }
  if (nameLower.includes('jacket') || nameLower.includes('coat') || nameLower.includes('blazer') || nameLower.includes('vest') || nameLower.includes('cardigan') || nameLower.includes('parka') || nameLower.includes('windbreaker')) {
    return 'Outerwear';
  }
  if (nameLower.includes('shoe') || nameLower.includes('boot') || nameLower.includes('sneaker') || nameLower.includes('sandal') || nameLower.includes('heel') || nameLower.includes('flat') || nameLower.includes('loafer')) {
    return 'Shoes';
  }
  if (nameLower.includes('hat') || nameLower.includes('cap') || nameLower.includes('scarf') || nameLower.includes('belt') || nameLower.includes('bag') || nameLower.includes('watch') || nameLower.includes('jewelry') || nameLower.includes('necklace') || nameLower.includes('ring') || nameLower.includes('bracelet') || nameLower.includes('sunglass') || nameLower.includes('glove') || nameLower.includes('tie') || nameLower.includes('sock')) {
    return 'Accessories';
  }
  
  return 'Tops';
}

function extractColor(imageData) {
  return 'Multi-color';
}

function generateOutfitSuggestions(wardrobeItems, occasion, weather) {
  const suggestions = [];
  
  const itemsByCategory = {
    'Tops': [],
    'Bottoms': [],
    'Outerwear': [],
    'Shoes': [],
    'Accessories': []
  };
  
  wardrobeItems.forEach(item => {
    if (itemsByCategory[item.category]) {
      itemsByCategory[item.category].push(item);
    }
  });
  
  const tops = itemsByCategory['Tops'];
  const bottoms = itemsByCategory['Bottoms'];
  const shoes = itemsByCategory['Shoes'];
  const outerwear = itemsByCategory['Outerwear'];
  const accessories = itemsByCategory['Accessories'];
  
  const occasionNames = {
    'Work': ['Professional Look', 'Office Ready', 'Business Casual'],
    'Casual': ['Weekend Vibes', 'Relaxed Style', 'Everyday Look'],
    'Date Night': ['Evening Elegance', 'Night Out', 'Romantic Style'],
    'Workout': ['Athletic Ready', 'Gym Fit', 'Sport Style'],
    'Formal': ['Black Tie', 'Formal Affair', 'Elegant Evening']
  };
  
  const names = occasionNames[occasion] || occasionNames['Casual'];
  
  for (let i = 0; i < 3; i++) {
    const outfit = {
      items: [],
      name: names[i] || `Outfit ${i + 1}`,
      occasion: occasion || 'Casual',
      weather: weather || 'Sunny'
    };
    
    if (tops.length > 0) {
      const topIndex = i % tops.length;
      outfit.items.push(tops[topIndex]);
    }
    
    if (bottoms.length > 0) {
      const bottomIndex = (i + 1) % bottoms.length;
      outfit.items.push(bottoms[bottomIndex]);
    }
    
    if (shoes.length > 0) {
      const shoeIndex = (i + 2) % shoes.length;
      outfit.items.push(shoes[shoeIndex]);
    }
    
    if ((weather === 'Cold' || weather === 'Rainy') && outerwear.length > 0) {
      const outerIndex = i % outerwear.length;
      outfit.items.push(outerwear[outerIndex]);
    }
    
    if (accessories.length > 0) {
      const accIndex = (i + 1) % accessories.length;
      outfit.items.push(accessories[accIndex]);
    }
    
    if (outfit.items.length >= 2) {
      suggestions.push(outfit);
    }
  }
  
  return suggestions;
}

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        error: 'Email, password, and name are required'
      });
    }
    
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters'
      });
    }
    
    const existingUser = getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'Email already registered'
      });
    }
    
    const passwordHash = await hashPassword(password);
    const userId = createUser(email, passwordHash, name);
    
    const token = generateToken(userId);
    
    const user = getUserById(userId);
    
    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          created_at: user.created_at
        },
        token
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register user'
    });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }
    
    const user = getUserByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }
    
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }
    
    const token = generateToken(user.id);
    
    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          created_at: user.created_at
        },
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to login'
    });
  }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({
    success: true,
    data: {
      user: req.user
    }
  });
});

app.post('/api/mannequin', authMiddleware, (req, res) => {
  try {
    const { image_data, silhouette_data } = req.body;
    
    if (!image_data) {
      return res.status(400).json({
        success: false,
        error: 'Image data is required'
      });
    }
    
    const userId = req.user.id;
    
    const existing = getMannequinByUserId(userId);
    
    if (existing) {
      updateMannequin(userId, image_data, silhouette_data || null);
    } else {
      createMannequin(userId, image_data, silhouette_data || null);
    }
    
    const mannequin = getMannequinByUserId(userId);
    
    res.json({
      success: true,
      data: {
        mannequin: {
          id: mannequin.id,
          user_id: mannequin.user_id,
          image_data: mannequin.image_data,
          silhouette_data: mannequin.silhouette_data,
          created_at: mannequin.created_at
        }
      }
    });
  } catch (error) {
    console.error('Mannequin upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload mannequin'
    });
  }
});

app.get('/api/mannequin', authMiddleware, (req, res) => {
  try {
    const mannequin = getMannequinByUserId(req.user.id);
    
    if (!mannequin) {
      return res.status(404).json({
        success: false,
        error: 'No mannequin found. Please upload a body photo.'
      });
    }
    
    res.json({
      success: true,
      data: {
        mannequin: {
          id: mannequin.id,
          user_id: mannequin.user_id,
          image_data: mannequin.image_data,
          silhouette_data: mannequin.silhouette_data,
          created_at: mannequin.created_at
        }
      }
    });
  } catch (error) {
    console.error('Get mannequin error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get mannequin'
    });
  }
});

app.post('/api/wardrobe/upload', authMiddleware, (req, res) => {
  try {
    const { items } = req.body;
    const userId = req.user.id;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Items array is required'
      });
    }
    
    const createdItems = [];
    
    for (const item of items) {
      const { image_data, name, category, color } = item;
      
      if (!image_data) {
        continue;
      }
      
      const itemCategory = category || categorizeItem(name, extractColor(image_data));
      const itemColor = color || extractColor(image_data);
      const itemName = name || `${itemCategory} Item`;
      
      const itemId = createWardrobeItem(
        userId,
        itemCategory,
        itemName,
        itemColor,
        image_data,
        { auto_categorized: !category }
      );
      
      const createdItem = getWardrobeItemById(itemId);
      createdItems.push(createdItem);
    }
    
    res.status(201).json({
      success: true,
      data: {
        items: createdItems,
        count: createdItems.length
      }
    });
  } catch (error) {
    console.error('Wardrobe upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload wardrobe items'
    });
  }
});

app.get('/api/wardrobe', authMiddleware, (req, res) => {
  try {
    const { category } = req.query;
    const userId = req.user.id;
    
    const items = getWardrobeItemsByUserId(userId, category || null);
    
    res.json({
      success: true,
      data: {
        items,
        count: items.length
      }
    });
  } catch (error) {
    console.error('Get wardrobe error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get wardrobe items'
    });
  }
});

app.get('/api/wardrobe/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const item = getWardrobeItemById(parseInt(id));
    
    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Item not found'
      });
    }
    
    if (item.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    res.json({
      success: true,
      data: { item }
    });
  } catch (error) {
    console.error('Get wardrobe item error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get wardrobe item'
    });
  }
});

app.put('/api/wardrobe/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const item = getWardrobeItemById(parseInt(id));
    
    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Item not found'
      });
    }
    
    if (item.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    const { category, name, color, image_data, metadata } = req.body;
    const updates = {};
    
    if (category) updates.category = category;
    if (name) updates.name = name;
    if (color) updates.color = color;
    if (image_data) updates.image_data = image_data;
    if (metadata) updates.metadata = metadata;
    
    updateWardrobeItem(parseInt(id), updates);
    
    const updatedItem = getWardrobeItemById(parseInt(id));
    
    res.json({
      success: true,
      data: { item: updatedItem }
    });
  } catch (error) {
    console.error('Update wardrobe item error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update wardrobe item'
    });
  }
});

app.delete('/api/wardrobe/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const item = getWardrobeItemById(parseInt(id));
    
    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Item not found'
      });
    }
    
    if (item.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    deleteWardrobeItem(parseInt(id));
    
    res.json({
      success: true,
      data: { message: 'Item deleted successfully' }
    });
  } catch (error) {
    console.error('Delete wardrobe item error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete wardrobe item'
    });
  }
});

app.post('/api/outfits/suggest', authMiddleware, (req, res) => {
  try {
    const { occasion, weather } = req.body;
    const userId = req.user.id;
    
    const wardrobeItems = getWardrobeItemsByUserId(userId);
    
    if (wardrobeItems.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Not enough wardrobe items to generate outfit suggestions. Please add more items to your wardrobe.'
      });
    }
    
    const suggestions = generateOutfitSuggestions(wardrobeItems, occasion, weather);
    
    res.json({
      success: true,
      data: {
        suggestions,
        occasion: occasion || 'Casual',
        weather: weather || 'Sunny'
      }
    });
  } catch (error) {
    console.error('Outfit suggestion error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate outfit suggestions'
    });
  }
});

app.post('/api/outfits', authMiddleware, (req, res) => {
  try {
    const { name, occasion, weather, items, preview_data } = req.body;
    const userId = req.user.id;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Items array is required'
      });
    }
    
    const outfitName = name || `Outfit ${Date.now()}`;
    
    const outfitId = createOutfit(
      userId,
      outfitName,
      occasion || null,
      weather || null,
      items,
      preview_data || null
    );
    
    const outfit = getOutfitById(outfitId);
    
    res.status(201).json({
      success: true,
      data: { outfit }
    });
  } catch (error) {
    console.error('Create outfit error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create outfit'
    });
  }
});

app.get('/api/outfits', authMiddleware, (req, res) => {
  try {
    const { occasion, weather } = req.query;
    const userId = req.user.id;
    
    const filters = {};
    if (occasion) filters.occasion = occasion;
    if (weather) filters.weather = weather;
    
    const outfits = getOutfitsByUserId(userId, filters);
    
    res.json({
      success: true,
      data: {
        outfits,
        count: outfits.length
      }
    });
  } catch (error) {
    console.error('Get outfits error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get outfits'
    });
  }
});

app.get('/api/outfits/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const outfit = getOutfitById(parseInt(id));
    
    if (!outfit) {
      return res.status(404).json({
        success: false,
        error: 'Outfit not found'
      });
    }
    
    if (outfit.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    res.json({
      success: true,
      data: { outfit }
    });
  } catch (error) {
    console.error('Get outfit error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get outfit'
    });
  }
});

app.delete('/api/outfits/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const outfit = getOutfitById(parseInt(id));
    
    if (!outfit) {
      return res.status(404).json({
        success: false,
        error: 'Outfit not found'
      });
    }
    
    if (outfit.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    deleteOutfit(parseInt(id));
    
    res.json({
      success: true,
      data: { message: 'Outfit deleted successfully' }
    });
  } catch (error) {
    console.error('Delete outfit error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete outfit'
    });
  }
});

app.post('/api/outfits/:id/save', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { is_favorite } = req.body;
    const userId = req.user.id;
    
    const outfit = getOutfitById(parseInt(id));
    
    if (!outfit) {
      return res.status(404).json({
        success: false,
        error: 'Outfit not found'
      });
    }
    
    if (outfit.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    const existing = getSavedLookByUserAndOutfit(userId, parseInt(id));
    
    if (existing) {
      updateSavedLook(existing.id, { is_favorite: is_favorite || false });
    } else {
      createSavedLook(userId, parseInt(id), is_favorite || false);
    }
    
    res.json({
      success: true,
      data: { message: 'Outfit saved successfully' }
    });
  } catch (error) {
    console.error('Save outfit error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save outfit'
    });
  }
});

app.delete('/api/outfits/:id/save', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const savedLook = getSavedLookByUserAndOutfit(userId, parseInt(id));
    
    if (!savedLook) {
      return res.status(404).json({
        success: false,
        error: 'Saved look not found'
      });
    }
    
    deleteSavedLook(savedLook.id);
    
    res.json({
      success: true,
      data: { message: 'Outfit removed from saved looks' }
    });
  } catch (error) {
    console.error('Unsave outfit error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unsave outfit'
    });
  }
});

app.get('/api/saved-looks', authMiddleware, (req, res) => {
  try {
    const { is_favorite, occasion } = req.query;
    const userId = req.user.id;
    
    const filters = {};
    if (is_favorite === 'true') filters.isFavorite = true;
    if (occasion) filters.occasion = occasion;
    
    const savedLooks = getSavedLooksByUserId(userId, filters);
    
    res.json({
      success: true,
      data: {
        savedLooks,
        count: savedLooks.length
      }
    });
  } catch (error) {
    console.error('Get saved looks error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get saved looks'
    });
  }
});

app.post('/api/share/:outfitId', authMiddleware, (req, res) => {
  try {
    const { outfitId } = req.params;
    const userId = req.user.id;
    
    const outfit = getOutfitById(parseInt(outfitId));
    
    if (!outfit) {
      return res.status(404).json({
        success: false,
        error: 'Outfit not found'
      });
    }
    
    if (outfit.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    let sharedOutfit = getSharedOutfitByOutfitId(parseInt(outfitId));
    
    if (!sharedOutfit) {
      const shareCode = generateShareCode();
      createSharedOutfit(parseInt(outfitId), shareCode);
      sharedOutfit = getSharedOutfitByOutfitId(parseInt(outfitId));
    }
    
    res.json({
      success: true,
      data: {
        shareCode: sharedOutfit.share_code,
        shareUrl: `/share/${sharedOutfit.share_code}`
      }
    });
  } catch (error) {
    console.error('Share outfit error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to share outfit'
    });
  }
});

app.get('/api/share/:code', (req, res) => {
  try {
    const { code } = req.params;
    
    const sharedOutfit = getSharedOutfitByCode(code);
    
    if (!sharedOutfit) {
      return res.status(404).json({
        success: false,
        error: 'Shared outfit not found'
      });
    }
    
    const itemDetails = [];
    if (sharedOutfit.items_json && Array.isArray(sharedOutfit.items_json)) {
      for (const itemId of sharedOutfit.items_json) {
        const item = getWardrobeItemById(itemId);
        if (item) {
          itemDetails.push({
            id: item.id,
            name: item.name,
            category: item.category,
            color: item.color,
            image_data: item.image_data
          });
        }
      }
    }
    
    res.json({
      success: true,
      data: {
        outfit: {
          name: sharedOutfit.name,
          occasion: sharedOutfit.occasion,
          weather: sharedOutfit.weather,
          preview_data: sharedOutfit.preview_data,
          items: itemDetails
        }
      }
    });
  } catch (error) {
    console.error('Get shared outfit error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get shared outfit'
    });
  }
});

app.get('/api/analytics', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const analytics = getAnalytics(userId);
    
    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get analytics'
    });
  }
});

app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found'
  });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

app.listen(PORT, () => {
  console.log(`StyleMuse server running on port ${PORT}`);
  console.log(`Frontend: http://localhost:${PORT}`);
  console.log(`API: http://localhost:${PORT}/api`);
});