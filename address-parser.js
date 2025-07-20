// Indonesian Address Parser with AI Learning Capabilities
class IndonesianAddressParser {
    constructor() {
        this.addressDatabase = [];
        this.learnedWords = new Map();
        this.addressPatterns = new Map();
        this.corrections = new Map();
        this.fuzzyMatchThreshold = 0.8;
        this.learningEnabled = true;
    }

    // Initialize with CSV database
    async initialize(csvContent) {
        try {
            this.addressDatabase = this.parseCSV(csvContent);
            this.buildIndex();
            return true;
        } catch (error) {
            console.error('Error initializing address parser:', error);
            throw error;
        }
    }

    // Parse CSV content
    parseCSV(csvContent) {
        const lines = csvContent.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });
            data.push(row);
        }

        return data;
    }

    // Build search index
    buildIndex() {
        this.provinsiIndex = new Map();
        this.kabupatenIndex = new Map();
        this.kecamatanIndex = new Map();
        this.kelurahanIndex = new Map();

        this.addressDatabase.forEach(record => {
            const provinsi = record.provinsi?.toLowerCase();
            const kabupaten = record.kabupaten_kota?.toLowerCase();
            const kecamatan = record.kecamatan?.toLowerCase();
            const kelurahan = record.kelurahan_desa?.toLowerCase();

            if (provinsi) {
                if (!this.provinsiIndex.has(provinsi)) {
                    this.provinsiIndex.set(provinsi, []);
                }
                this.provinsiIndex.get(provinsi).push(record);
            }

            if (kabupaten) {
                if (!this.kabupatenIndex.has(kabupaten)) {
                    this.kabupatenIndex.set(kabupaten, []);
                }
                this.kabupatenIndex.get(kabupaten).push(record);
            }

            if (kecamatan) {
                if (!this.kecamatanIndex.has(kecamatan)) {
                    this.kecamatanIndex.set(kecamatan, []);
                }
                this.kecamatanIndex.get(kecamatan).push(record);
            }

            if (kelurahan) {
                if (!this.kelurahanIndex.has(kelurahan)) {
                    this.kelurahanIndex.set(kelurahan, []);
                }
                this.kelurahanIndex.get(kelurahan).push(record);
            }
        });
    }

    // Parse address with AI learning
    parseAddress(address) {
        if (!address || typeof address !== 'string') {
            return {
                success: false,
                error: 'Invalid address input',
                parsed: null,
                confidence: 0
            };
        }

        const originalAddress = address.trim();
        const normalizedAddress = this.normalizeAddress(originalAddress);
        
        // Apply learned corrections
        const correctedAddress = this.applyCorrections(normalizedAddress);
        
        // Extract components
        const components = this.extractComponents(correctedAddress);
        
        // Match with database
        const matches = this.findMatches(components);
        
        // Calculate confidence
        const confidence = this.calculateConfidence(components, matches);
        
        // Learn from this parsing
        if (this.learningEnabled) {
            this.learnFromAddress(originalAddress, components, matches, confidence);
        }

        return {
            success: confidence > 0.3,
            parsed: {
                original: originalAddress,
                normalized: correctedAddress,
                provinsi: matches.provinsi || components.provinsi || '',
                kabupaten_kota: matches.kabupaten_kota || components.kabupaten_kota || '',
                kecamatan: matches.kecamatan || components.kecamatan || '',
                kelurahan_desa: matches.kelurahan_desa || components.kelurahan_desa || '',
                kode_pos: matches.kode_pos || components.kode_pos || '',
                detail_alamat: components.detail_alamat || ''
            },
            confidence: confidence,
            suggestions: this.generateSuggestions(components, matches),
            corrections: this.getCorrections(components)
        };
    }

    // Normalize address
    normalizeAddress(address) {
        return address
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .replace(/[^\w\s]/g, ' ')
            .trim();
    }

    // Apply learned corrections
    applyCorrections(address) {
        let corrected = address;
        this.corrections.forEach((correction, wrong) => {
            corrected = corrected.replace(new RegExp(wrong, 'gi'), correction);
        });
        return corrected;
    }

    // Extract address components
    extractComponents(address) {
        const components = {
            provinsi: '',
            kabupaten_kota: '',
            kecamatan: '',
            kelurahan_desa: '',
            kode_pos: '',
            detail_alamat: ''
        };

        // Extract postal code
        const postalCodeMatch = address.match(/\b\d{5}\b/);
        if (postalCodeMatch) {
            components.kode_pos = postalCodeMatch[0];
        }

        // Extract administrative divisions using regex patterns
        const patterns = [
            { key: 'provinsi', pattern: /\b(dki jakarta|jawa (barat|tengah|timur)|bali|sumatera (utara|barat|selatan|tengah|timur)|kalimantan (barat|tengah|selatan|timur|utara)|sulawesi (utara|tengah|selatan|barat|tenggara|utara)|papua|maluku|nusa tenggara (barat|timur))\b/gi },
            { key: 'kabupaten_kota', pattern: /\b(jakarta (pusat|selatan|barat|utara|timur)|bogor|bekasi|bandung|semarang|solo|surabaya|malang|medan|padang|denpasar|buleleng)\b/gi },
            { key: 'kecamatan', pattern: /\b(tanah abang|kebayoran baru|grogol petamburan|penjaringan|cileungsi|bekasi utara|bandung wetan|semarang tengah|surabaya pusat|medan petisah|medan tuntungan|padang utara|padang selatan|denpasar barat)\b/gi },
            { key: 'kelurahan_desa', pattern: /\b(sukamaju|kebon melati|kebon kacang|selong|gunung|grogol|pluit|mampir|cileungsi|kranji|kayu tinggi|citarum|pindrikan kidul|pindrikan lor|kemlayan|serengan|ketabang|genteng|klojen|sukun|kampung kajanan|kampung baru|pemecutan|dauh puri|petisah tengah|petisah hulu|tuntungan i|tuntungan ii|air tawar barat|air tawar timur|ranah|seberang padang)\b/gi }
        ];

        patterns.forEach(({ key, pattern }) => {
            const match = address.match(pattern);
            if (match) {
                components[key] = match[0];
            }
        });

        // Extract detail address (everything else)
        const detailParts = address.split(' ').filter(word => {
            return !Object.values(components).some(comp => 
                comp && comp.toLowerCase().includes(word.toLowerCase())
            );
        });
        components.detail_alamat = detailParts.join(' ');

        return components;
    }

    // Find matches in database
    findMatches(components) {
        const matches = {};

        // Try exact matches first
        if (components.provinsi && this.provinsiIndex.has(components.provinsi.toLowerCase())) {
            const provinsiMatches = this.provinsiIndex.get(components.provinsi.toLowerCase());
            if (provinsiMatches.length > 0) {
                matches.provinsi = components.provinsi;
                matches.kode_pos = provinsiMatches[0].kode_pos;
            }
        }

        if (components.kabupaten_kota && this.kabupatenIndex.has(components.kabupaten_kota.toLowerCase())) {
            const kabupatenMatches = this.kabupatenIndex.get(components.kabupaten_kota.toLowerCase());
            if (kabupatenMatches.length > 0) {
                matches.kabupaten_kota = components.kabupaten_kota;
                matches.provinsi = kabupatenMatches[0].provinsi;
                matches.kode_pos = kabupatenMatches[0].kode_pos;
            }
        }

        if (components.kecamatan && this.kecamatanIndex.has(components.kecamatan.toLowerCase())) {
            const kecamatanMatches = this.kecamatanIndex.get(components.kecamatan.toLowerCase());
            if (kecamatanMatches.length > 0) {
                matches.kecamatan = components.kecamatan;
                matches.kabupaten_kota = kecamatanMatches[0].kabupaten_kota;
                matches.provinsi = kecamatanMatches[0].provinsi;
                matches.kode_pos = kecamatanMatches[0].kode_pos;
            }
        }

        if (components.kelurahan_desa && this.kelurahanIndex.has(components.kelurahan_desa.toLowerCase())) {
            const kelurahanMatches = this.kelurahanIndex.get(components.kelurahan_desa.toLowerCase());
            if (kelurahanMatches.length > 0) {
                matches.kelurahan_desa = components.kelurahan_desa;
                matches.kecamatan = kelurahanMatches[0].kecamatan;
                matches.kabupaten_kota = kelurahanMatches[0].kabupaten_kota;
                matches.provinsi = kelurahanMatches[0].provinsi;
                matches.kode_pos = kelurahanMatches[0].kode_pos;
            }
        }

        // Try fuzzy matching if no exact matches
        if (!matches.provinsi && components.provinsi) {
            const fuzzyMatch = this.fuzzyMatch(components.provinsi, Array.from(this.provinsiIndex.keys()));
            if (fuzzyMatch) {
                const provinsiMatches = this.provinsiIndex.get(fuzzyMatch);
                matches.provinsi = this.provinsiIndex.get(fuzzyMatch)[0].provinsi;
                matches.kode_pos = provinsiMatches[0].kode_pos;
            }
        }

        return matches;
    }

    // Fuzzy matching using Levenshtein distance
    fuzzyMatch(target, candidates) {
        let bestMatch = null;
        let bestScore = 0;

        candidates.forEach(candidate => {
            const score = this.levenshteinSimilarity(target.toLowerCase(), candidate.toLowerCase());
            if (score > bestScore && score >= this.fuzzyMatchThreshold) {
                bestScore = score;
                bestMatch = candidate;
            }
        });

        return bestMatch;
    }

    // Calculate Levenshtein similarity
    levenshteinSimilarity(str1, str2) {
        const matrix = [];
        const len1 = str1.length;
        const len2 = str2.length;

        for (let i = 0; i <= len1; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= len2; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                if (str1[i - 1] === str2[j - 1]) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j - 1] + 1
                    );
                }
            }
        }

        const distance = matrix[len1][len2];
        const maxLength = Math.max(len1, len2);
        return maxLength === 0 ? 1 : (maxLength - distance) / maxLength;
    }

    // Calculate confidence score
    calculateConfidence(components, matches) {
        let confidence = 0;
        let totalComponents = 0;

        // Check each component
        ['provinsi', 'kabupaten_kota', 'kecamatan', 'kelurahan_desa'].forEach(component => {
            if (components[component]) {
                totalComponents++;
                if (matches[component]) {
                    confidence += 1;
                } else {
                    // Partial credit for fuzzy matches
                    confidence += 0.3;
                }
            }
        });

        // Bonus for postal code match
        if (components.kode_pos && matches.kode_pos === components.kode_pos) {
            confidence += 0.5;
        }

        return totalComponents > 0 ? confidence / totalComponents : 0;
    }

    // Learn from address parsing
    learnFromAddress(originalAddress, components, matches, confidence) {
        // Learn common words
        const words = originalAddress.toLowerCase().split(/\s+/);
        words.forEach(word => {
            if (word.length > 2) {
                this.learnedWords.set(word, (this.learnedWords.get(word) || 0) + 1);
            }
        });

        // Learn address patterns
        const pattern = this.extractPattern(components);
        if (pattern) {
            this.addressPatterns.set(pattern, (this.addressPatterns.get(pattern) || 0) + 1);
        }

        // Learn corrections for low confidence results
        if (confidence < 0.7) {
            Object.keys(components).forEach(key => {
                if (components[key] && !matches[key]) {
                    const suggestions = this.generateSuggestionsForComponent(key, components[key]);
                    if (suggestions.length > 0) {
                        this.corrections.set(components[key].toLowerCase(), suggestions[0]);
                    }
                }
            });
        }
    }

    // Extract pattern from components
    extractPattern(components) {
        const pattern = [];
        ['provinsi', 'kabupaten_kota', 'kecamatan', 'kelurahan_desa'].forEach(key => {
            if (components[key]) {
                pattern.push(key);
            }
        });
        return pattern.join('->');
    }

    // Generate suggestions
    generateSuggestions(components, matches) {
        const suggestions = [];

        Object.keys(components).forEach(key => {
            if (components[key] && !matches[key]) {
                const componentSuggestions = this.generateSuggestionsForComponent(key, components[key]);
                suggestions.push(...componentSuggestions);
            }
        });

        return suggestions.slice(0, 5); // Limit to 5 suggestions
    }

    // Generate suggestions for specific component
    generateSuggestionsForComponent(componentType, value) {
        const suggestions = [];
        const searchValue = value.toLowerCase();

        switch (componentType) {
            case 'provinsi':
                this.provinsiIndex.forEach((records, provinsi) => {
                    if (this.levenshteinSimilarity(searchValue, provinsi) > 0.6) {
                        suggestions.push(records[0].provinsi);
                    }
                });
                break;
            case 'kabupaten_kota':
                this.kabupatenIndex.forEach((records, kabupaten) => {
                    if (this.levenshteinSimilarity(searchValue, kabupaten) > 0.6) {
                        suggestions.push(records[0].kabupaten_kota);
                    }
                });
                break;
            case 'kecamatan':
                this.kecamatanIndex.forEach((records, kecamatan) => {
                    if (this.levenshteinSimilarity(searchValue, kecamatan) > 0.6) {
                        suggestions.push(records[0].kecamatan);
                    }
                });
                break;
            case 'kelurahan_desa':
                this.kelurahanIndex.forEach((records, kelurahan) => {
                    if (this.levenshteinSimilarity(searchValue, kelurahan) > 0.6) {
                        suggestions.push(records[0].kelurahan_desa);
                    }
                });
                break;
        }

        return suggestions.slice(0, 3); // Limit to 3 suggestions per component
    }

    // Get corrections
    getCorrections(components) {
        const corrections = [];
        Object.keys(components).forEach(key => {
            if (components[key]) {
                const correction = this.corrections.get(components[key].toLowerCase());
                if (correction) {
                    corrections.push({
                        original: components[key],
                        suggested: correction
                    });
                }
            }
        });
        return corrections;
    }

    // Get learning statistics
    getLearningStats() {
        return {
            learnedWords: this.learnedWords.size,
            addressPatterns: this.addressPatterns.size,
            corrections: this.corrections.size,
            databaseSize: this.addressDatabase.length
        };
    }

    // Export learning data
    exportLearningData() {
        return {
            learnedWords: Object.fromEntries(this.learnedWords),
            addressPatterns: Object.fromEntries(this.addressPatterns),
            corrections: Object.fromEntries(this.corrections),
            timestamp: new Date().toISOString()
        };
    }

    // Import learning data
    importLearningData(data) {
        if (data.learnedWords) {
            this.learnedWords = new Map(Object.entries(data.learnedWords));
        }
        if (data.addressPatterns) {
            this.addressPatterns = new Map(Object.entries(data.addressPatterns));
        }
        if (data.corrections) {
            this.corrections = new Map(Object.entries(data.corrections));
        }
    }

    // Enable/disable learning
    setLearningEnabled(enabled) {
        this.learningEnabled = enabled;
    }

    // Set fuzzy match threshold
    setFuzzyMatchThreshold(threshold) {
        this.fuzzyMatchThreshold = Math.max(0, Math.min(1, threshold));
    }
}

// API Wrapper for easier integration
class AddressParserAPI {
    constructor() {
        this.parser = new IndonesianAddressParser();
        this.isInitialized = false;
    }

    async initialize(csvContent) {
        try {
            await this.parser.initialize(csvContent);
            this.isInitialized = true;
            return true;
        } catch (error) {
            console.error('Failed to initialize AddressParserAPI:', error);
            throw error;
        }
    }

    parseAddress(address) {
        if (!this.isInitialized) {
            throw new Error('AddressParserAPI not initialized. Call initialize() first.');
        }
        return this.parser.parseAddress(address);
    }

    getLearningStats() {
        return this.parser.getLearningStats();
    }

    exportLearningData() {
        return this.parser.exportLearningData();
    }

    importLearningData(data) {
        this.parser.importLearningData(data);
    }

    setLearningEnabled(enabled) {
        this.parser.setLearningEnabled(enabled);
    }

    setFuzzyMatchThreshold(threshold) {
        this.parser.setFuzzyMatchThreshold(threshold);
    }
} 
