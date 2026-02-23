const express = require('express');
const router = express.Router();
const { ensureStaff, ensureAdmin } = require('../middleware/checkRole');
// Import all updated models
const User = require('../models/User');
const {
    ArchiveItem, History, Culture, NotablePerson, FreedomFighter,
    MeritoriousStudent, HiddenTalent, Occupation, HeartbreakingStory,
    SocialWork, Institution, Transport, Emergency, TouristSpot
} = require('../models/ArchiveItem');
const Traffic = require('../models/Traffic');


// 1. Updated Model Map to match the 14 Reformed categories
const MODEL_MAP = {
    'history': History,
    'culture': Culture,
    'institution': Institution,
    'notable people': NotablePerson,
    'freedom fighters': FreedomFighter,
    'meritorious student': MeritoriousStudent,
    'hidden talent': HiddenTalent,
    'occupation': Occupation,
    'Heartbreaking stories': HeartbreakingStory,
    'tourist spots': TouristSpot,
    'transport': Transport,
    'Emergency services': Emergency,
    'social works': SocialWork,

    // Slug-friendly aliases
    'notable-people': NotablePerson,
    'freedom-fighters': FreedomFighter,
    'meritorious-student': MeritoriousStudent,
    'hidden-talent': HiddenTalent,
    'heartbreaking-stories': HeartbreakingStory,
    'tourist-spots': TouristSpot,
    'emergency-services': Emergency,
    'social-works': SocialWork
};

// --- NEW ADMIN DASHBOARD (ADMIN ONLY) ---

router.get('/panel', ensureAdmin, async (req, res) => {
    try {
        // 1. OVERVIEW DATA
        const totalUsers = await User.countDocuments();
        const totalEntries = await ArchiveItem.countDocuments();

        // Category Breakdown
        const categoryCounts = await ArchiveItem.aggregate([
            { $group: { _id: "$category", count: { $sum: 1 } } }
        ]);

        // Recent Entries
        const recentEntries = await ArchiveItem.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .select('title category createdAt');

        // 2. TRAFFIC ANALYTICS DATA
        // Get last 7 days
        const trafficData = await Traffic.find()
            .sort({ date: -1 })
            .limit(7);

        // Reverse to show chronological order in graph (past to present)
        const trafficStats = trafficData.reverse();

        // Calculate Today's Totals (using first item of reversed if it matches today)
        const todayStr = new Date().toISOString().split('T')[0];
        const todayTraffic = trafficStats.find(t => t.date === todayStr) || { views: 0, uniqueVisits: 0 };

        // 3. USER MANAGEMENT DATA
        const users = await User.find().sort({ createdAt: -1 });

        res.render('admin/dashboard/index', {
            user: req.user,
            stats: {
                totalUsers,
                totalEntries,
                categories: categoryCounts,
                recentEntries,
                traffic: trafficStats,
                todayViews: todayTraffic.views,
                todayUniques: todayTraffic.uniqueVisits
            },
            users,
            pageTitle: 'Admin Dashboard'
        });

    } catch (err) {
        console.error("Dashboard Error:", err);
        res.status(500).send("Error loading admin dashboard");
    }
});

// User Management Actions
router.post('/users/update-role', ensureAdmin, async (req, res) => {
    try {
        const { userId, newRole } = req.body;
        const targetUser = await User.findById(userId);
        if (!targetUser) return res.status(404).json({ success: false, message: "User not found." });

        // 1. Protection Logic
        const isSelf = userId === req.user._id.toString();

        // If it's NOT yourself, you cannot modify another admin
        if (!isSelf && targetUser.role === 'admin') {
            return res.status(403).json({ success: false, message: "You cannot modify another administrator's role." });
        }

        targetUser.role = newRole;
        await targetUser.save();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.delete('/users/:id', ensureAdmin, async (req, res) => {
    try {
        // 1. Prevent admin from deleting themselves
        if (req.params.id === req.user._id.toString()) {
            return res.status(400).json({ success: false, message: "You cannot delete yourself." });
        }

        // 2. Prevent admin from deleting another admin
        const targetUser = await User.findById(req.params.id);
        if (!targetUser) return res.status(404).json({ success: false, message: "User not found." });

        if (targetUser.role === 'admin') {
            return res.status(403).json({ success: false, message: "You cannot delete another administrator." });
        }

        await User.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// --- END ADMIN DASHBOARD ---

// GET: Show the "Add Content" Page
router.get('/add', ensureStaff, (req, res) => {
    res.render('admin/add-content/index', {
        user: req.user,
        pageTitle: 'Contribute to Archive'
    });
});

// GET: Content Management Page (with pagination and search)
router.get('/content-management', ensureStaff, async (req, res) => {
    try {
        const query = req.query.q || '';
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        // Base criteria: user's own content
        const searchCriteria = { author: req.user._id };

        // Apply search if a query exists
        if (query) {
            const searchRegex = new RegExp(query, 'i');
            searchCriteria.$or = [
                { title: searchRegex },
                { slug: searchRegex },
                { category: searchRegex },
                { subType: searchRegex },
                // Limit bodyContent search to text blocks to optimize
                { bodyContent: { $elemMatch: { type: { $in: ['paragraph', 'heading', 'list', 'quote'] }, content: searchRegex } } }
            ];
        }

        // Get total count for pagination
        const totalItems = await ArchiveItem.countDocuments(searchCriteria);
        const totalPages = Math.ceil(totalItems / limit);

        // Fetch paginated items submitted by the current user
        const items = await ArchiveItem.find(searchCriteria)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(); // Faster processing

        res.render('admin/content-management', {
            user: req.user,
            items: items,
            searchQuery: query,
            currentPage: page,
            totalPages: totalPages,
            totalItems: totalItems,
            pageTitle: 'Content Management'
        });
    } catch (err) {
        console.error("Error fetching user content:", err);
        req.flash('error_msg', 'Could not load your content.');
        res.redirect('/profile');
    }
});

// POST: Save the new Content
router.post('/add', ensureStaff, async (req, res) => {
    try {
        console.log("DEBUG: Received Add Content Body:", req.body);
        const {
            title, slug, category, subType, thumbnail, bodyContentJSON, ...otherFields
        } = req.body;

        // 1. Validate Category
        const SelectedModel = MODEL_MAP[category];
        if (!SelectedModel) {
            console.error("DEBUG: Invalid Category:", category);
            throw new Error(`Invalid Category Selected: ${category}`);
        }

        // 2. Parse the Block Editor JSON
        let parsedBodyContent = [];
        if (bodyContentJSON) {
            try {
                parsedBodyContent = JSON.parse(bodyContentJSON);
            } catch (pErr) {
                console.error("DEBUG: JSON Parse Error:", pErr);
            }
        }

        // 3. Prepare the data object
        const itemData = {
            title,
            slug,
            category,
            subType, // This satisfies Institution
            thumbnail,
            author: req.user._id,
            bodyContent: parsedBodyContent,
            ...otherFields
        };

        // 4. Map Generic fields to Specific Discriminator fields
        if (category === 'transport') itemData.transportType = subType;
        if (category === 'Emergency services') itemData.serviceType = subType;

        // 5. Normalizing coordinates
        if (otherFields.lat || otherFields.lng) {
            const lat = parseFloat(otherFields.lat);
            const lng = parseFloat(otherFields.lng);
            if (!isNaN(lat) && !isNaN(lng)) {
                itemData.coordinates = { lat, lng };
            }
        }

        // 6. Normalizing dates
        if (otherFields.eventDate) itemData.dateOfIncident = otherFields.eventDate;
        if (otherFields.establishedDate) itemData.establishedDate = otherFields.establishedDate;

        // 7. Format Array Fields (Comma-separated from frontend)
        const arrayFields = ['achievements', 'involvedParties', 'toolsUsed', 'destinations'];
        arrayFields.forEach(field => {
            if (otherFields[field] !== undefined) {
                itemData[field] = otherFields[field].split(',').map(s => s.trim()).filter(Boolean);
            }
        });

        // 8. Handle empty dates (Convert empty strings to undefined to prevent CastErrors)
        const dateFields = ['dateOfBirth', 'dateOfDeath', 'eventDate', 'establishedDate', 'dateOfIncident'];
        dateFields.forEach(field => {
            if (itemData[field] === '') {
                delete itemData[field]; // Mongoose will ignore undefined fields
            }
        });

        console.log("DEBUG: Final itemData to Save:", JSON.stringify(itemData, null, 2));

        // 7. Create and Save
        const newItem = new SelectedModel(itemData);
        await newItem.save();

        console.log("DEBUG: Save Successful!");
        req.flash('success_msg', `${category} entry created successfully!`);
        res.redirect('/admin/add');

    } catch (err) {
        console.error("SAVE ERROR:", err);
        let errorMsg = 'Error creating entry: ' + err.message;

        // Specific handling for duplicate slug
        if (err.code === 11000) {
            errorMsg = 'Error: The Slug (URL Link) you provided already exists in the archive. Please provide a unique slug.';
        }

        req.flash('error_msg', errorMsg);
        res.redirect('/admin/add');
    }
});

// GET: Edit Form
router.get('/edit/:id', ensureStaff, async (req, res) => {
    try {
        const item = await ArchiveItem.findById(req.params.id).populate('author');
        if (!item) {
            return res.status(404).send('Item not found');
        }
        // Normalize subType for UI consistency
        const itemObj = item.toObject();
        itemObj.subType = item.subType || item.transportType || item.serviceType || '';

        res.render('admin/edit-content/index', { item: itemObj, user: req.user });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// POST: Update Item
router.post('/edit/:id', ensureStaff, async (req, res) => {
    try {
        console.log("DEBUG: Received Edit Content Body:", req.body);
        const { title, slug, category, subType, thumbnail, bodyContentJSON, ...otherFields } = req.body;

        // 1. Validate Category
        const SelectedModel = MODEL_MAP[category];
        if (!SelectedModel) {
            console.error("DEBUG: Invalid Category:", category);
            throw new Error(`Invalid Category Selected: ${category}`);
        }

        // 2. Parse the Block Editor JSON
        let parsedBodyContent = [];
        if (bodyContentJSON) {
            try {
                parsedBodyContent = JSON.parse(bodyContentJSON);
            } catch (pErr) {
                console.error("DEBUG: JSON Parse Error:", pErr);
            }
        }

        // 3. Prepare the data object
        const updateData = {
            title,
            slug,
            category,
            subType, // For Institution
            thumbnail,
            bodyContent: parsedBodyContent,
            ...otherFields
        };

        // 4. Map Generic fields
        if (category === 'transport') updateData.transportType = subType;
        if (category === 'Emergency services') updateData.serviceType = subType;

        // 5. Special Handling: Coordinates
        if (otherFields.lat || otherFields.lng) {
            const lat = parseFloat(otherFields.lat);
            const lng = parseFloat(otherFields.lng);
            if (!isNaN(lat) && !isNaN(lng)) {
                updateData.coordinates = { lat, lng };
            }
        }

        // 6. Normalizing dates
        if (otherFields.eventDate) updateData.dateOfIncident = otherFields.eventDate;
        if (otherFields.establishedDate) updateData.establishedDate = otherFields.establishedDate;

        // 7. Format Array Fields (Comma-separated from frontend)
        const arrayFields = ['achievements', 'involvedParties', 'toolsUsed', 'destinations'];
        arrayFields.forEach(field => {
            if (otherFields[field] !== undefined) {
                updateData[field] = otherFields[field].split(',').map(s => s.trim()).filter(Boolean);
            }
        });

        // 8. Handle empty dates (Convert empty strings to undefined to prevent CastErrors)
        const dateFields = ['dateOfBirth', 'dateOfDeath', 'eventDate', 'establishedDate', 'dateOfIncident'];
        dateFields.forEach(field => {
            if (updateData[field] === '') {
                delete updateData[field]; // Mongoose will ignore undefined, removing the field from the update
            }
        });

        console.log("DEBUG: Final updateData:", JSON.stringify(updateData, null, 2));

        // 7. Update and Save
        // FIX: Mongoose prevents changing the discriminator key (category) via standard findByIdAndUpdate/save.
        // We check if it changed, and if so, update it directly in MongoDB collection first.
        const currentItem = await ArchiveItem.findById(req.params.id);
        if (currentItem && currentItem.category !== category) {
            console.log(`DEBUG: Category change detected: ${currentItem.category} -> ${category}`);
            await ArchiveItem.collection.updateOne(
                { _id: currentItem._id },
                { $set: { category: category } }
            );
        }

        // Use { strict: false } to allow fields not in the BaseSchema (like transportType) to persist
        const updatedItem = await ArchiveItem.findByIdAndUpdate(req.params.id, updateData, { new: true, strict: false });

        console.log("DEBUG: Update Successful!");
        req.flash('success_msg', 'Entry updated successfully!');
        res.redirect(`/entry/${updatedItem.slug}`);

    } catch (err) {
        console.error("UPDATE ERROR:", err);
        let errorMsg = 'Error updating entry: ' + err.message;

        if (err.code === 11000) {
            errorMsg = 'Error: The Slug (URL Link) you provided already exists. Slugs must be unique across the archive.';
        }

        req.flash('error_msg', errorMsg);
        res.redirect(`/admin/edit/${req.params.id}`);
    }
});

// DELETE: Remove Item
router.delete('/delete/:id', ensureStaff, async (req, res) => {
    try {
        await ArchiveItem.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        console.error("DELETE ERROR:", err);
        res.json({ success: false, error: err.message });
    }
});

module.exports = router;