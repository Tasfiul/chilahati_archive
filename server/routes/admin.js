const express = require('express');
const router = express.Router();
const { ensureStaff } = require('../middleware/checkRole');
// Import all updated models
const {
    ArchiveItem, History, Culture, NotablePerson, FreedomFighter,
    MeritoriousStudent, HiddenTalent, Occupation, HeartbreakingStory,
    SocialWork, InteractiveMap, Institution, Transport, Emergency, TouristSpot
} = require('../models/ArchiveItem');

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
    'interactive map': InteractiveMap,

    // Slug-friendly aliases
    'notable-people': NotablePerson,
    'freedom-fighters': FreedomFighter,
    'meritorious-student': MeritoriousStudent,
    'hidden-talent': HiddenTalent,
    'heartbreaking-stories': HeartbreakingStory,
    'tourist-spots': TouristSpot,
    'emergency-services': Emergency,
    'social-works': SocialWork,
    'interactive-map': InteractiveMap
};

// GET: Show the "Add Content" Page
router.get('/add', ensureStaff, (req, res) => {
    res.render('admin/add-content/index', {
        user: req.user,
        pageTitle: 'Contribute to Archive'
    });
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
            status: 'published',
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
            status: 'published',
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