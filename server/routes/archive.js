const express = require('express');
const router = express.Router();
const models = require('../models/ArchiveItem');
const { ArchiveItem, Institution, Emergency, Transport, InteractiveMap, Organization } = models;

// LEVEL 2: Show Sub-Categories (user clicked a main category)
router.get('/:category', async (req, res) => {
    try {
        const { category } = req.params;

        // Candidate fields that may act as "subType" depending on discriminator
        const candidateFields = [
            'subType',
            'personType',
            'heritageType',
            'narrativeType',
            'serviceType',
            'transportType',
            'orgType',
            'mapType'
        ];

        // Try to find distinct subtype values for this category across candidate fields.
        // Use case-insensitive match for the stored `category` (discriminator values are capitalized).
        let foundField = null;
        let subTypes = [];
        for (const field of candidateFields) {
            const vals = await ArchiveItem.distinct(field, { category: new RegExp('^' + category + '$', 'i') });
            const cleaned = (vals || []).filter(v => v !== undefined && v !== null && String(v).trim() !== '');
            if (cleaned.length > 0) {
                foundField = field;
                subTypes = cleaned;
                break;
            }
        }

        // If we didn't find any subtype-like field with values, try falling back
        // to known enum definitions for certain categories (so sub-categories show
        // even when there are no database entries yet).
        if (!foundField) {
            const lower = String(category).toLowerCase();
            const enumMap = {
                'institution': { model: Institution, field: 'subType' },
                'emergency-service': { model: Emergency, field: 'serviceType' },
                'transport': { model: Transport, field: 'transportType' },
                'interactive-map': { model: InteractiveMap, field: 'mapType' },
                'social-work': { model: Organization, field: 'orgType' },
                'sopnotory-foundation': { model: Organization, field: 'orgType' }
            };

            const mapping = enumMap[lower];
            if (mapping && mapping.model && mapping.field) {
                const schemaPath = mapping.model.schema.path(mapping.field);
                const enums = schemaPath && schemaPath.enumValues ? schemaPath.enumValues : [];
                if (enums && enums.length > 0) {
                    subTypes = enums;
                    foundField = mapping.field;
                }
            }

            // If still not found, show the list directly
            if (!foundField) {
                const items = await ArchiveItem.find({ category: new RegExp('^' + category + '$', 'i'), status: 'published' });
                return res.render('archive/list', { items, title: category, category });
            }
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