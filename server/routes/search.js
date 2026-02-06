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

        // Search across EVERY text-based field
        const searchCriteria = {
            $or: [
                { title: searchRegex },
                { slug: searchRegex }, // User explicitly allowed slug
                { tags: searchRegex },
                { category: searchRegex },
                // NEW: Only search inside text-heavy blocks, skipping URL blocks (PDF, Video, Image, Link)
                { bodyContent: { $elemMatch: { type: { $in: ['paragraph', 'heading', 'list', 'quote'] }, content: searchRegex } } },
                // Mixed/Reformed Fields (Text only)
                { subType: searchRegex },
                { profession: searchRegex },
                { education: searchRegex },
                { achievements: searchRegex },
                { address: searchRegex },
                { period: searchRegex },
                { significance: searchRegex },
                { involvedParties: searchRegex },
                { foundedBy: searchRegex },
                { missionStatement: searchRegex },
                { traditionalName: searchRegex },
                { toolsUsed: searchRegex },
                { headOfInstitution: searchRegex },
                { transportType: searchRegex },
                { destinations: searchRegex },
                { serviceType: searchRegex },
                { entryFee: searchRegex },
                { bestTimeToVisit: searchRegex },
                { sectorNo: searchRegex },
                { passingYear: searchRegex },
                { currentStatus: searchRegex },
                { occupationStatus: searchRegex }
                // locationLink removed as it is a URL
            ]
        };

        // Get total count
        const totalResults = await ArchiveItem.countDocuments(searchCriteria);
        const totalPages = Math.ceil(totalResults / limit);

        // Fetch all candidates for smart sorting (limit to a reasonable number if needed, but 10 matches is small)
        // Since we want to sort by relevance in JS for complex logic, we'll fetch results
        let results = await ArchiveItem.find(searchCriteria).lean();

        // Smart Re-sorting in Javascript for Better Intuition:
        // 1. Title starts with search query (High Priority)
        // 2. Title contains search query
        // 3. Category/Tag match
        // 4. Everything else
        results.sort((a, b) => {
            const aTitle = a.title.toLowerCase();
            const bTitle = b.title.toLowerCase();
            const q = query.toLowerCase();

            // Priority 1: Exact or Starts With Title
            const aStartsWith = aTitle.startsWith(q);
            const bStartsWith = bTitle.startsWith(q);
            if (aStartsWith && !bStartsWith) return -1;
            if (!aStartsWith && bStartsWith) return 1;

            // Priority 2: Title Contains
            const aContains = aTitle.includes(q);
            const bContains = bTitle.includes(q);
            if (aContains && !bContains) return -1;
            if (!aContains && bContains) return 1;

            // Fallback: Newest first
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        // Apply pagination to the sorted array
        const paginatedResults = results.slice(skip, skip + limit);

        res.render('search-results', {
            title: `Search: ${query}`,
            results: paginatedResults,
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
