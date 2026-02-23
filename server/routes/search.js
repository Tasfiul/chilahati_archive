const express = require('express');
const router = express.Router();
const { ArchiveItem } = require('../models/ArchiveItem');

// GET /search?q=query&page=1
router.get('/', async (req, res) => {
    try {
        const query = req.query.q;
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        if (!query) {
            return res.render('search-results', {
                title: 'Search Results',
                results: [],
                query: '',
                currentPage: 1,
                totalPages: 0,
                totalResults: 0
            });
        }

        // Create case-insensitive regex for partial matching
        const searchRegex = new RegExp(query, 'i');

        // Search criteria
        const searchCriteria = {
            $or: [
                { title: searchRegex },
                { slug: searchRegex },
                { tags: searchRegex },
                { category: searchRegex },
                { bodyContent: { $elemMatch: { type: { $in: ['paragraph', 'heading', 'list', 'quote'] }, content: searchRegex } } }
                // Note: discriminator fields are indexed and included in the base query
            ]
        };

        // Get total count
        const totalResults = await ArchiveItem.countDocuments(searchCriteria);
        const totalPages = Math.ceil(totalResults / limit);

        // Fetch results with sorting and pagination at DB level
        // We prioritize title matches by doing an initial sort, but since we are using regex, 
        // true relevance sorting usually needs $text or complex aggregation.
        // For now, we'll sort by createdAt but allow pagination at DB level.
        const results = await ArchiveItem.find(searchCriteria)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        res.render('search-results', {
            title: `Search: ${query}`,
            results: results,
            query,
            currentPage: page,
            totalPages,
            totalResults
        });

    } catch (err) {
        console.error("SEARCH ERROR:", err);
        res.status(500).send("Server Error");
    }
});

module.exports = router;
