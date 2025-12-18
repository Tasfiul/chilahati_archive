const mongoose = require('mongoose');

// --- 1. The Flexible Content Block Schema (Wikipedia Style) ---
// This is used inside ALL items to store the main story/content.
const contentBlockSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['paragraph', 'heading', 'image', 'list', 'table', 'pdf'],
        required: true
    },
    content: mongoose.Schema.Types.Mixed, // Can be string, or object for images/tables
    order: Number // To keep them in the right sequence
}, { _id: false });

// --- 2. The Base Schema (Parent) ---
// Every single section inherits these fields.
const baseOptions = {
    discriminatorKey: 'category', // This tells Mongoose which "Child" model to use
    collection: 'archive_items',   // All data goes into this one collection
    timestamps: true
};

const BaseSchema = new mongoose.Schema({
    title: { type: String, required: true, index: true }, // Name of Person, Place, or Event
    slug: { type: String, required: true, unique: true }, // URL-friendly name
    thumbnail: { type: String }, // Google Drive Link for the cover card

    // Status for moderation (Draft vs Published)
    status: {
        type: String,
        enum: ['draft', 'published'],
        default: 'draft'
    },

    // Who created this?
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // The "Wikipedia" Content Body
    bodyContent: [contentBlockSchema]

}, baseOptions);

const ArchiveItem = mongoose.model('ArchiveItem', BaseSchema);

// --- 3. The Child Schemas (Specific Attributes) ---

// A. ENTITIES WITH LOCATIONS (Institutions, Spots, Emergency, Social, Transport)
// We create a "LocationBased" schema first to avoid repeating code, 
// then specific ones inherit from it or we use it directly.

const LocationSchema = new mongoose.Schema({
    locationLink: { type: String }, // Google Maps Link
    address: { type: String },
    contactPhone: { type: String }, // Optional contact info
});

// Institution (Schools, Govt, Banks)
const Institution = ArchiveItem.discriminator('Institution', new mongoose.Schema({
    ...LocationSchema.obj, // Inherit location fields
    subType: {
        type: String,
        enum: ['Educational', 'Governmental', 'Financial', 'Religious', 'Other']
    },
    establishedDate: { type: Date }, // Fixed attribute for sorting
    headOfInstitution: { type: String } // e.g. Principal or Manager
}));

// Tourist Spot
const TouristSpot = ArchiveItem.discriminator('TouristSpot', new mongoose.Schema({
    ...LocationSchema.obj,
    entryFee: { type: String }, // e.g., "Free" or "20 Taka"
    bestTimeToVisit: { type: String }
}));

// Emergency (Hospitals, Police)
const Emergency = ArchiveItem.discriminator('Emergency', new mongoose.Schema({
    ...LocationSchema.obj,
    serviceType: { type: String, enum: ['Health', 'Police', 'Fire', 'Ambulance'] },
    is24Hours: { type: Boolean, default: true }
}));

// Transport (Bus Stand, Train Station)
const Transport = ArchiveItem.discriminator('Transport', new mongoose.Schema({
    ...LocationSchema.obj,
    transportType: { type: String, enum: ['Bus', 'Train', 'Auto-Stand'] },
    destinations: [String] // List of major places it connects to
}));

// Social Work (NGOs)
const SocialWork = ArchiveItem.discriminator('SocialWork', new mongoose.Schema({
    ...LocationSchema.obj,
    focusArea: { type: String } // e.g. "Education", "Poverty", "Health"
}));

// B. ENTITIES WITHOUT LOCATIONS (People, History, Culture)

// Notable People & Local Scholars
// We can use one schema for both, or separate if Scholars need "University" fields.
// Let's allow flexible "Roles" to distinguish them.
const Person = ArchiveItem.discriminator('Person', new mongoose.Schema({
    personType: {
        type: String,
        enum: ['Notable', 'Scholar'],
        required: true
    },
    subType: { type: String }, // e.g. "Freedom Fighter", "Artist", "PhD Holder"
    dateOfBirth: { type: Date },
    dateOfDeath: { type: Date }, // Null if alive
    profession: { type: String },
    achievements: [String] // List of awards/degrees
}));

// History & Culture (Events)
const Heritage = ArchiveItem.discriminator('Heritage', new mongoose.Schema({
    heritageType: {
        type: String,
        enum: ['History', 'Culture'],
        required: true
    },
    eventDate: { type: Date }, // For historical events
    significance: { type: String } // Short text
}));

module.exports = {
    ArchiveItem,
    Institution,
    TouristSpot,
    Emergency,
    Transport,
    SocialWork,
    Person,
    Heritage
};