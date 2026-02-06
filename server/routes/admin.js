const express = require('express');
const router = express.Router();
const { ensureStaff } = require('../middleware/checkRole');
// Import all updated models
const {
    ArchiveItem, Institution, Emergency, Transport, Person,
    Heritage, Narrative, TouristSpot, InteractiveMap, Organization, Occupation
} = require('../models/ArchiveItem');

// 1. Updated Model Map to include all 15+ types
const MODEL_MAP = {
    'Institution': Institution,
    'TouristSpot': TouristSpot,
    'Emergency': Emergency,
    'Transport': Transport,
    'Person': Person,
    'Heritage': Heritage,
    'Narrative': Narrative,
    'InteractiveMap': InteractiveMap,
    'Organization': Organization,
    'Occupation': Occupation,
    'Social Work': Organization, // Map frontend category names to models
    'Sopnotory Foundation': Organization,
    'History': Heritage,
    'Culture': Heritage,
    'Heart Breaking Story': Narrative
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
        const {
            title, slug, category, subType, thumbnail, bodyContentJSON, ...otherFields
        } = req.body;

        // 1. Validate Category
        const SelectedModel = MODEL_MAP[category];
        if (!SelectedModel) {
            throw new Error(`Invalid Category Selected: ${category}`);
        }

        // 2. Parse the Block Editor JSON
        let parsedBodyContent = [];
        if (bodyContentJSON) {
            parsedBodyContent = JSON.parse(bodyContentJSON);
        }

        // 3. Prepare the data object
        const itemData = {
            title,
            slug,
            category,
            subType,
            thumbnail,
            status: 'published', // Always published, no draft option
            author: req.user._id,
            bodyContent: parsedBodyContent,
            ...otherFields
        };

        // 4. Special Handling: Coordinates for Interactive Map Points
        if (otherFields.lat || otherFields.lng) {
            itemData.coordinates = {
                lat: parseFloat(otherFields.lat),
                lng: parseFloat(otherFields.lng)
            };
        }

        // 5. Special Handling: Normalize dates
        if (otherFields.eventDate) itemData.eventDate = otherFields.eventDate;
        if (otherFields.dateOfIncident) itemData.dateOfIncident = otherFields.dateOfIncident;

        // 6. Create and Save
        const newItem = new SelectedModel(itemData);
        await newItem.save();

        req.flash('success_msg', `${category} entry created successfully!`);
        res.redirect('/admin/add');

    } catch (err) {
        console.error("SAVE ERROR:", err);
        req.flash('error_msg', 'Error creating entry: ' + err.message);
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
        res.render('admin/edit-content/index', { item, user: req.user });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// POST: Update Item
router.post('/edit/:id', ensureStaff, async (req, res) => {
    try {
        const { title, slug, category, subType, thumbnail, bodyContentJSON, ...otherFields } = req.body;

        // 1. Validate Category
        const SelectedModel = MODEL_MAP[category];
        if (!SelectedModel) {
            throw new Error(`Invalid Category Selected: ${category}`);
        }

        // 2. Parse the Block Editor JSON
        let parsedBodyContent = [];
        if (bodyContentJSON) {
            parsedBodyContent = JSON.parse(bodyContentJSON);
        }

        // 3. Prepare the data object
        const updateData = {
            title,
            slug,
            category,
            subType,
            thumbnail,
            status: 'published',
            bodyContent: parsedBodyContent,
            ...otherFields
        };

        // 4. Special Handling: Coordinates
        if (otherFields.lat || otherFields.lng) {
            updateData.coordinates = {
                lat: parseFloat(otherFields.lat),
                lng: parseFloat(otherFields.lng)
            };
        }

        if (otherFields.eventDate) updateData.eventDate = otherFields.eventDate;
        if (otherFields.dateOfIncident) updateData.dateOfIncident = otherFields.dateOfIncident;

        // 5. Update and Save
        const updatedItem = await ArchiveItem.findByIdAndUpdate(req.params.id, updateData, { new: true });

        req.flash('success_msg', 'Entry updated successfully!');
        res.redirect(`/entry/${updatedItem.slug}`);

    } catch (err) {
        console.error("UPDATE ERROR:", err);
        req.flash('error_msg', 'Error updating entry: ' + err.message);
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