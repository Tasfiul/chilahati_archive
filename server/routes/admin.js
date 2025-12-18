const express = require('express');
const router = express.Router();
const { ensureStaff } = require('../middleware/checkRole');
const {
    Institution, TouristSpot, Emergency, Transport, SocialWork, Person, Heritage
} = require('../models/ArchiveItem');

// Map string categories to actual Mongoose Models
const MODEL_MAP = {
    'Institution': Institution,
    'TouristSpot': TouristSpot,
    'Emergency': Emergency,
    'Transport': Transport,
    'SocialWork': SocialWork,
    'Person': Person,
    'Heritage': Heritage
};

// GET: Show the "Add Content" Page
router.get('/add', ensureStaff, (req, res) => {
    // CHANGED: Added 'add-content/index'
    res.render('admin/add-content/index', {
        user: req.user,
        pageTitle: 'Contribute to Archive'
    });
});

// POST: Save the new Content
router.post('/add', ensureStaff, async (req, res) => {
    try {
        console.log("Form Data:", req.body); // For debugging

        const { title, slug, category, thumbnail, status, ...otherFields } = req.body;

        // 1. Validation
        if (!MODEL_MAP[category]) {
            throw new Error('Invalid Category Selected');
        }

        // 2. Parse the "Wikipedia" Body Content (It comes as a stringified JSON from frontend)
        let parsedBodyContent = [];
        if (req.body.bodyContentJSON) {
            parsedBodyContent = JSON.parse(req.body.bodyContentJSON);
        }

        // 3. Select the correct Model based on category
        const SelectedModel = MODEL_MAP[category];

        // 4. Create the item
        // Note: 'otherFields' contains the specific attributes like establishedDate, subType, etc.
        const newItem = new SelectedModel({
            title,
            slug,
            category, // Discriminator Key
            thumbnail,
            status: status || 'draft',
            author: req.user._id,
            bodyContent: parsedBodyContent,
            ...otherFields // Spread the rest of the fixed attributes
        });

        await newItem.save();

        req.flash('success_msg', 'Entry created successfully!');
        res.redirect('/admin/add');

    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error creating entry: ' + err.message);
        res.redirect('/admin/add');
    }
});

module.exports = router;