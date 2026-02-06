const mongoose = require('mongoose');

// --- 1. The Flexible Content Block Schema ---
const contentBlockSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['paragraph', 'heading', 'image', 'list', 'table', 'pdf', 'video', 'quote'],
        required: true
    },
    content: mongoose.Schema.Types.Mixed,
    order: Number
}, { _id: false });

// --- 2. The Base Schema ---
const baseOptions = {
    discriminatorKey: 'category',
    collection: 'archive_items',
    timestamps: true
};

const BaseSchema = new mongoose.Schema({
    title: { type: String, required: true, index: true },
    slug: { type: String, required: true, unique: true },
    thumbnail: { type: String }, // URL (Google Drive/Cloudinary)
    status: {
        type: String,
        enum: ['draft', 'published'],
        default: 'draft'
    },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    bodyContent: [contentBlockSchema],
    tags: [String] // Helpful for filtering across categories
}, baseOptions);

// Enable Text Search on Title, Tags, and Slug
BaseSchema.index({ title: 'text', tags: 'text', slug: 'text', category: 'text' });

const ArchiveItem = mongoose.model('ArchiveItem', BaseSchema);

// --- 3. Shared Field Objects (Mixins) ---
const LocationSchema = {
    locationLink: { type: String }, // Maps link
    coordinates: { // For the "Interactive Map" feature
        lat: Number,
        lng: Number
    },
    address: { type: String },
    contactPhone: { type: String }
};

// --- 4. THE DISCRIMINATORS (The Specific Types) ---

// A. INSTITUTIONS & SERVICES
const Institution = ArchiveItem.discriminator('Institution', new mongoose.Schema({
    ...LocationSchema,
    subType: { type: String, enum: ['Educational', 'Governmental', 'Financial', 'Religious', 'Health', 'Other'] },
    establishedDate: { type: Date },
    headOfInstitution: { type: String }
}));

const Emergency = ArchiveItem.discriminator('Emergency', new mongoose.Schema({
    ...LocationSchema,
    serviceType: { type: String, enum: ['Health', 'Police', 'Fire', 'Ambulance'] },
    is24Hours: { type: Boolean, default: true }
}));

const Transport = ArchiveItem.discriminator('Transport', new mongoose.Schema({
    ...LocationSchema,
    transportType: { type: String, enum: ['Bus', 'Train', 'Auto-Stand', 'Launch-Ghat'] },
    destinations: [String]
}));

// B. PEOPLE (Freedom Fighters, Students, Notable, Talent)
const Person = ArchiveItem.discriminator('Person', new mongoose.Schema({
    personType: {
        type: String,
        enum: ['Notable People', 'Freedom Fighter', 'Meritorious Student', 'Hidden Talent', 'Scholar']
    },
    dateOfBirth: { type: Date },
    dateOfDeath: { type: Date },
    education: { type: String },
    achievements: [String],
    // Specific to Freedom Fighters
    sectorNo: { type: String },
    // Specific to Students
    passingYear: { type: Number },
    currentStatus: { type: String } // e.g., "Studying at DU"
}));

// C. STORIES & CULTURE
const Heritage = ArchiveItem.discriminator('Heritage', new mongoose.Schema({
    heritageType: { type: String, enum: ['History', 'Culture', 'Occupation'] },
    period: { type: String }, // e.g. "British Era", "1971"
    significance: { type: String }
}));

const Narrative = ArchiveItem.discriminator('Narrative', new mongoose.Schema({
    narrativeType: { type: String, enum: ['Heart Breaking Story', 'Local Legend', 'Success Story'] },
    dateOfIncident: { type: Date },
    involvedParties: [String]
}));

// D. PLACES & INTERACTIVE MAPS
const TouristSpot = ArchiveItem.discriminator('TouristSpot', new mongoose.Schema({
    ...LocationSchema,
    entryFee: { type: String },
    bestTimeToVisit: { type: String }
}));

const InteractiveMap = ArchiveItem.discriminator('InteractiveMap', new mongoose.Schema({
    ...LocationSchema,
    mapType: { type: String, enum: ['Historical Site', 'Boundary', 'Utility Services'] },
    markerIcon: { type: String } // Custom icon for the map
}));

// E. ORGANIZATIONS (Social Work, Sopnotory Foundation)
const Organization = ArchiveItem.discriminator('Organization', new mongoose.Schema({
    ...LocationSchema,
    orgType: { type: String, enum: ['Social Work', 'Sopnotory Foundation', 'NGO', 'Club'] },
    foundedBy: { type: String },
    missionStatement: { type: String }
}));

// F. OCCUPATION (Special focus on local traditional jobs)
const Occupation = ArchiveItem.discriminator('Occupation', new mongoose.Schema({
    traditionalName: { type: String }, // e.g. "Kumar", "Kamars"
    toolsUsed: [String],
    currentStatus: { type: String, enum: ['Thriving', 'Declining', 'Extinct'] }
}));


module.exports = {
    ArchiveItem,
    Institution,
    Emergency,
    Transport,
    Person,
    Heritage,
    Narrative,
    TouristSpot,
    InteractiveMap,
    Organization,
    Occupation
};