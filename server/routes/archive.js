const express = require('express');
const router = express.Router();
const models = require('../models/ArchiveItem');
const {
    ArchiveItem,
    Institution,
    Emergency,
    Transport,
    InteractiveMap,
    Organization,
    Person,
    Heritage,
    Narrative,
    TouristSpot,
    Occupation
} = models;

// LEVEL 2: Show Sub-Categories (user clicked a main category)
router.get('/:category', async (req, res) => {
    try {
        const { category } = req.params;

        // 1. DEFINE THE SCHEMA RULES (Which categories represent sub-menus)
        // If a category is here, we ALWAYS show the sub-menu, using the Enum values.
        const lower = String(category).toLowerCase();

        // Define mapping for ALL categories that have sub-divisions
        const enumMap = {
            'institution': { model: Institution, field: 'subType' },
            'person': { model: Person, field: 'personType' },
            'heritage': { model: Heritage, field: 'heritageType' },
            'narrative': { model: Narrative, field: 'narrativeType' },
            'emergency': { model: Emergency, field: 'serviceType' },
            'transport': { model: Transport, field: 'transportType' },
            'interactive-map': { model: InteractiveMap, field: 'mapType' },
            'organization': { model: Organization, field: 'orgType' },
            'education': { model: Institution, field: 'subType' } // Handle alias if necessary
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

        // 3. FALLBACK: IF NOT IN MAP, CHECK DB (For categories we might have missed or dynamic ones)
        // This handles cases like "TouristSpot" which effectively has no sub-types in the map,
        // so it skips this and goes to "Show List".
        if (!foundField) {
            // Candidate fields that may act as "subType" depending on discriminator
            const candidateFields = [
                'subType', 'personType', 'heritageType', 'narrativeType',
                'serviceType', 'transportType', 'orgType', 'mapType'
            ];

            // Try to find distinct subtype values for this category across candidate fields.
            for (const field of candidateFields) {
                const vals = await ArchiveItem.distinct(field, { category: new RegExp('^' + category + '$', 'i') });
                const cleaned = (vals || []).filter(v => v !== undefined && v !== null && String(v).trim() !== '');
                if (cleaned.length > 0) {
                    foundField = field;
                    subTypes = cleaned;
                    break;
                }
            }
        }

        // 4. DECISION: LIST OR SUB-MENU?
        // If still no subTypes found (meaning it's a flat category like TouristSpot), show the list.
        if (!foundField || subTypes.length === 0) {
            const items = await ArchiveItem.find({ category: new RegExp('^' + category + '$', 'i'), status: 'published' });
            return res.render('archive/list', { items, title: category, category });
        }

        // Render the sub-categories page with the discovered subType values
        res.render('archive/sub-categories', {
            category,
            subTypes,
            title: `Explore ${category}`
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

// LEVEL 3: Show List of Items (e.g., User clicked "Educational", now show all Schools)
router.get('/:category/:subType', async (req, res) => {
    try {
        const { category, subType } = req.params;

        // Search for items that match the category (case-insensitive) and the provided subType
        // across the known subtype fields.
        const subtypeFields = ['subType', 'personType', 'heritageType', 'narrativeType', 'serviceType', 'transportType', 'orgType', 'mapType'];
        const orClauses = subtypeFields.map(f => ({ [f]: subType }));

        const query = {
            category: new RegExp('^' + category + '$', 'i'),
            status: 'published',
            $or: orClauses
        };

        const items = await ArchiveItem.find(query).select('title slug thumbnail category subType personType heritageType');

        res.render('archive/list', {
            items,
            title: `${subType} ${category}`,
            category,
            subType
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

module.exports = router;