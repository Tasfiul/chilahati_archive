const express = require('express');
const router = express.Router();
const { ArchiveItem } = require('../models/ArchiveItem');

// GET: Individual Entry Page
router.get('/:slug', async (req, res) => {
    try {
        // Find the item and get the author's name
        const item = await ArchiveItem.findOne({ slug: req.params.slug })
            .populate('author', 'username');

        if (!item) {
            return res.status(404).render('404', { message: 'Archive entry not found' });
        }

        res.render('archive/detail', { item, user: req.user });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

module.exports = router;