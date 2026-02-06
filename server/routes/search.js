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

        // 1. Perform Text Search
        // Sort by 'score' metadata to show most relevant first
        const searchCriteria = { $text: { $search: query, $caseSensitive: false } };

        // We need two queries: one for count, one for data
        const totalResults = await ArchiveItem.countDocuments(searchCriteria);
        const totalPages = Math.ceil(totalResults / limit);

        const results = await ArchiveItem.find(searchCriteria, {
            score: { $meta: "textScore" } // Project the score
        })
            .sort({ score: { $meta: "textScore" } }) // Sort by score
            .skip(skip)
            .limit(limit);

        res.render('search-results', {
            title: `Search: ${query}`,
            results,
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
