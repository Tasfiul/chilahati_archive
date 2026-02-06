const express = require('express');
const router = express.Router();
const models = require('../models/ArchiveItem');
const {
    ArchiveItem, History, Culture, NotablePerson, FreedomFighter,
    MeritoriousStudent, HiddenTalent, Occupation, HeartbreakingStory,
    SocialWork, InteractiveMap, Institution, Transport, Emergency, TouristSpot
} = require('../models/ArchiveItem');

// LEVEL 2: Show Sub-Categories (user clicked a main category)
router.get('/:category', async (req, res) => {
    try {
        const { category } = req.params;

        // 1. DEFINE THE SCHEMA RULES (Which categories represent sub-menus)
        const lower = String(category).toLowerCase().replace(/-/g, ' ');

        // Define mapping for categories that STILL have sub-divisions
        const enumMap = {
            'institution': { model: Institution, field: 'subType' },
            'transport': { model: Transport, field: 'transportType' },
            'emergency services': { model: Emergency, field: 'serviceType' }
        };

        let subTypes = [];
        let foundField = null;

        // 2. CHECK SCHEMA FIRST
        if (enumMap[lower]) {
            const mapping = enumMap[lower];
            const schemaPath = mapping.model.schema.path(mapping.field);
            if (schemaPath && schemaPath.enumValues && schemaPath.enumValues.length > 0) {
                subTypes = schemaPath.enumValues;
                foundField = mapping.field;
            }
        }

        // 3. FALLBACK: IF NOT IN MAP, CHECK DB
        if (!foundField) {
            const candidateFields = [
                'subType', 'transportType', 'serviceType'
            ];

            // Try to find distinct subtype values for this category across candidate fields.
            const queryCategory = category.replace(/-/g, ' ');
            for (const field of candidateFields) {
                const vals = await ArchiveItem.distinct(field, { category: new RegExp('^' + queryCategory + '$', 'i') });
                const cleaned = (vals || []).filter(v => v !== undefined && v !== null && String(v).trim() !== '');
                if (cleaned.length > 0) {
                    foundField = field;
                    subTypes = cleaned;
                    break;
                }
            }
        }

        // 4. DECISION: LIST OR SUB-MENU?
        if (!foundField || subTypes.length === 0) {
            const queryCategory = category.replace(/-/g, ' ');
            const items = await ArchiveItem.find({ category: new RegExp('^' + queryCategory + '$', 'i'), status: 'published' });
            return res.render('archive/list', { items, title: queryCategory, category: queryCategory });
        }

        // Render the sub-categories page
        res.render('archive/sub-categories', {
            category,
            subTypes,
            title: `Explore ${category.replace(/-/g, ' ')}`
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

// LEVEL 3: Show List of Items
router.get('/:category/:subType', async (req, res) => {
    try {
        const { category, subType } = req.params;
        const queryCategory = category.replace(/-/g, ' ');

        // Search across known subtype fields
        const subtypeFields = ['subType', 'transportType', 'serviceType'];
        const orClauses = subtypeFields.map(f => ({ [f]: subType }));

        const query = {
            category: new RegExp('^' + queryCategory + '$', 'i'),
            status: 'published',
            $or: orClauses
        };

        const items = await ArchiveItem.find(query).select('title slug thumbnail category subType');

        res.render('archive/list', {
            items,
            title: `${subType} ${queryCategory}`,
            category: queryCategory,
            subType
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

module.exports = router;