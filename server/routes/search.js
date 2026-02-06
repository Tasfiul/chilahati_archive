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

        // Search across all common fields and category-specific fields
        const searchCriteria = {
            $or: [
                { title: searchRegex },
                { slug: searchRegex },
                { tags: searchRegex },
                { category: searchRegex },
                { 'bodyContent.content': searchRegex },
                // Person-specific fields
                { personType: searchRegex },
                { education: searchRegex },
                { achievements: searchRegex },
                { currentStatus: searchRegex },
                // Institution-specific fields
                { subType: searchRegex },
                { headOfInstitution: searchRegex },
                { address: searchRegex },
                // Emergency-specific fields
                { serviceType: searchRegex },
                // Transport-specific fields
                { transportType: searchRegex },
                { destinations: searchRegex },
                // Heritage-specific fields
                { heritageType: searchRegex },
                { period: searchRegex },
                { significance: searchRegex },
                // Narrative-specific fields
                { narrativeType: searchRegex },
                { involvedParties: searchRegex },
                // Organization-specific fields
                { orgType: searchRegex },
                { foundedBy: searchRegex },
                { missionStatement: searchRegex },
                // Occupation-specific fields
                { traditionalName: searchRegex },
                { toolsUsed: searchRegex }
            ]
        };

        // Get total count and calculate pages
        const totalResults = await ArchiveItem.countDocuments(searchCriteria);
        const totalPages = Math.ceil(totalResults / limit);

        // Get paginated results, sort by relevance (title matches first, then others)
        const results = await ArchiveItem.find(searchCriteria)
            .sort({
                // Prioritize title matches
                title: 1,
                createdAt: -1
            })
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
