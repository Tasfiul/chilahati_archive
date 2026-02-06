const mongoose = require('mongoose');

// --- 1. The Flexible Content Block Schema ---
const contentBlockSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['paragraph', 'heading', 'image', 'list', 'table', 'pdf', 'video', 'quote', 'link'],
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
    category: { type: String, required: true, index: true }, // Explicitly defined for better builder support
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

const PersonFields = {
    dateOfBirth: { type: Date },
    dateOfDeath: { type: Date },
    education: { type: String },
    achievements: [String],
    sectorNo: { type: String }, // Specific to Freedom Fighters
    passingYear: { type: Number }, // Specific to Students
    currentStatus: { type: String }, // e.g., "Studying at DU"
    profession: { type: String }
};

const HeritageFields = {
    period: { type: String }, // e.g. "British Era", "1971"
    significance: { type: String }
};

const NarrativeFields = {
    dateOfIncident: { type: Date },
    involvedParties: [String]
};

const OccupationFields = {
    traditionalName: { type: String }, // e.g. "Kumar", "Kamars"
    toolsUsed: [String],
    occupationStatus: { type: String, enum: ['Thriving', 'Declining', 'Extinct'] }
};

const OrgFields = {
    foundedBy: { type: String },
    missionStatement: { type: String }
};

// --- 4. THE DISCRIMINATORS (The Specific Types) ---

// A. SIMPLE CATEGORIES (No sub-category)
const History = ArchiveItem.discriminator('history', new mongoose.Schema({ ...HeritageFields }));
const Culture = ArchiveItem.discriminator('culture', new mongoose.Schema({ ...HeritageFields }));
const NotablePerson = ArchiveItem.discriminator('notable people', new mongoose.Schema({ ...PersonFields }));
const FreedomFighter = ArchiveItem.discriminator('freedom fighters', new mongoose.Schema({ ...PersonFields }));
const MeritoriousStudent = ArchiveItem.discriminator('meritorious student', new mongoose.Schema({ ...PersonFields }));
const HiddenTalent = ArchiveItem.discriminator('hidden talent', new mongoose.Schema({ ...PersonFields }));
const Occupation = ArchiveItem.discriminator('occupation', new mongoose.Schema({ ...HeritageFields, ...OccupationFields }));
const HeartbreakingStory = ArchiveItem.discriminator('Heartbreaking stories', new mongoose.Schema({ ...NarrativeFields }));
const SocialWork = ArchiveItem.discriminator('social works', new mongoose.Schema({ ...LocationSchema, ...OrgFields }));
const InteractiveMap = ArchiveItem.discriminator('interactive map', new mongoose.Schema({ ...LocationSchema, markerIcon: String, mapType: String }));

// B. CATEGORIES WITH SUB-CATEGORIES
const Institution = ArchiveItem.discriminator('institution', new mongoose.Schema({
    ...LocationSchema,
    subType: { type: String, enum: ['educational', 'governmental', 'Banks', 'Religious', 'other'] },
    establishedDate: { type: Date },
    headOfInstitution: { type: String }
}));

const Transport = ArchiveItem.discriminator('transport', new mongoose.Schema({
    ...LocationSchema,
    transportType: { type: String, enum: ['bus', 'train', 'auto stand', 'launch-ghat'] },
    destinations: [String]
}));

const Emergency = ArchiveItem.discriminator('Emergency services', new mongoose.Schema({
    ...LocationSchema,
    serviceType: { type: String, enum: ['hospitals', 'police', 'fire'] },
    is24Hours: { type: Boolean, default: true }
}));

const TouristSpot = ArchiveItem.discriminator('tourist spots', new mongoose.Schema({
    ...LocationSchema,
    entryFee: { type: String },
    bestTimeToVisit: { type: String }
}));


module.exports = {
    ArchiveItem,
    History,
    Culture,
    NotablePerson,
    FreedomFighter,
    MeritoriousStudent,
    HiddenTalent,
    Occupation,
    HeartbreakingStory,
    SocialWork,
    InteractiveMap,
    Institution,
    Transport,
    Emergency,
    TouristSpot
};
