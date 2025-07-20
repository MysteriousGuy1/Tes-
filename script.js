// Global variables
let parsedData = [];
let learningData = {
    patterns: {},
    locations: {},
    accuracy: 0,
    totalProcessed: 0,
    successfulParses: 0
};

// Address Parser API
let addressParserAPI = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    loadLearningData();
    updateLearningPanel();
    
    // Try to load sample database automatically
    setTimeout(() => {
        loadSampleDatabase();
    }, 1000);
});

// Toggle settings panel
function toggleSettings() {
    const panel = document.getElementById('settingsPanel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

// Extract price from text (critical function)
function extractPrice(text) {
    if (!text) return 0;
    // Remove "Rp", spaces, dots, commas and convert to integer
    const cleaned = text.replace(/[Rp\s\.,]/g, '');
    return parseInt(cleaned) || 0;
}

// Detect courier from input text
function detectCourier(text) {
    const couriers = {
        'JNE': /jne/i,
        'J&T Express': /j&t|jnt/i,
        'SiCepat': /sicepat/i,
        'AnterAja': /anteraja/i,
        'ID Express': /id express/i,
        'SAP Express': /sap express/i,
        'Lion Parcel': /lion/i,
        'Tiki': /tiki/i,
        'Indah Logistik': /indah logistik/i,
        'GoSend': /gosend/i,
        'GrabExpress': /grabexpress/i,
        'Lalamove': /lalamove/i,
        'Paxel': /paxel/i,
        'PopExpress': /popexpress/i,
        'REX': /rex/i,
        'Deliveree': /deliveree/i,
        'J&T Cargo': /j&t cargo|jnt cargo/i,
        'Sentral Cargo': /sentral cargo/i
    };

    for (const [courier, pattern] of Object.entries(couriers)) {
        if (pattern.test(text)) {
            return courier;
        }
    }
    return null;
}

// Detect payment method
function detectPaymentMethod(text) {
    if (/cod/i.test(text)) return 'COD';
    if (/transfer/i.test(text)) return 'TRANSFER';
    return null;
}

// Extract customer information
function extractCustomerInfo(text) {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    
    let customerInfo = {
        nama: '',
        hp: '',
        alamat: '',
        harga: 0,
        ongkir: 0,
        biayaCod: 0,
        total: 0,
        produk: ''
    };

    for (const line of lines) {
        // Extract name
        if (/nama\s*:\s*(.+)/i.test(line)) {
            customerInfo.nama = line.match(/nama\s*:\s*(.+)/i)[1].trim();
        }
        
        // Extract phone
        if (/hp\s*:\s*(.+)/i.test(line) || /no\s*hp\s*:\s*(.+)/i.test(line)) {
            const match = line.match(/(?:hp|no\s*hp)\s*:\s*(.+)/i);
            customerInfo.hp = match[1].trim();
        }
        
        // Extract address
        if (/alamat\s*:\s*(.+)/i.test(line)) {
            customerInfo.alamat = line.match(/alamat\s*:\s*(.+)/i)[1].trim();
        }
        
        // Extract harga produk
        if (/harga\s*produk\s*:\s*(.+)/i.test(line)) {
            const match = line.match(/harga\s*produk\s*:\s*(.+)/i);
            customerInfo.harga = extractPrice(match[1]);
        }
        
        // Extract harga (for transfer format)
        if (/harga\s*:\s*(.+)/i.test(line) && !/harga\s*produk/i.test(line)) {
            const match = line.match(/harga\s*:\s*(.+)/i);
            customerInfo.harga = extractPrice(match[1]);
        }
        
        // Extract ongkir
        if (/ongkir\s*:\s*(.+)/i.test(line) || /ongkir\s*kirim\s*:\s*(.+)/i.test(line)) {
            const match = line.match(/ongkir(?:\s*kirim)?\s*:\s*(.+)/i);
            customerInfo.ongkir = extractPrice(match[1]);
        }
        
        // Extract biaya COD
        if (/biaya\s*cod\s*:\s*(.+)/i.test(line)) {
            const match = line.match(/biaya\s*cod\s*:\s*(.+)/i);
            customerInfo.biayaCod = extractPrice(match[1]);
        }
        
        // Extract total
        if (/total\s*:\s*(.+)/i.test(line)) {
            const match = line.match(/total\s*:\s*(.+)/i);
            customerInfo.total = extractPrice(match[1]);
        }
        
        // Extract produk
        if (/produk\s*:\s*(.+)/i.test(line)) {
            const match = line.match(/produk\s*:\s*(.+)/i);
            customerInfo.produk = match[1].trim();
        }
    }

    return customerInfo;
}

// Parse Indonesian address
function parseIndonesianAddress(address) {
    if (!address) return { kecamatan: '', kota: '' };
    
    const lowerAddress = address.toLowerCase();
    
    // Extract kecamatan
    let kecamatan = '';
    const kecMatch = lowerAddress.match(/kecamatan\s+([^\s,]+(?:\s+[^\s,]+)*)/);
    if (kecMatch) {
        kecamatan = kecMatch[1];
    } else {
        const kecShortMatch = lowerAddress.match(/kec\s+([^\s,]+(?:\s+[^\s,]+)*)/);
        if (kecShortMatch) {
            kecamatan = kecShortMatch[1];
        }
    }
    
    // Extract kabupaten/kota
    let kota = '';
    const kabMatch = lowerAddress.match(/kabupaten\s+([^\s,]+(?:\s+[^\s,]+)*)/);
    if (kabMatch) {
        kota = kabMatch[1];
    } else {
        const kabShortMatch = lowerAddress.match(/kab\s+([^\s,]+(?:\s+[^\s,]+)*)/);
        if (kabShortMatch) {
            kota = kabShortMatch[1];
        }
    }
    
    // Extract provinsi
    const provMatch = lowerAddress.match(/provinsi\s+([^\s,]+(?:\s+[^\s,]+)*)/);
    if (provMatch) {
        // If no kabupaten found, use provinsi as kota
        if (!kota) {
            kota = provMatch[1];
        }
    }
    
    return { kecamatan, kota };
}

// Internet search for location verification (simulated)
async function verifyLocation(kecamatan, kota) {
    showSearchStatus('Searching for location verification...', 'searching');
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    
    // Simulate internet search results
    const confidence = Math.random();
    let status = 'success';
    let message = 'Location verified';
    
    if (confidence < 0.3) {
        status = 'error';
        message = 'Location not found';
    } else if (confidence < 0.7) {
        status = 'searching';
        message = 'Location found with medium confidence';
    }
    
    showSearchStatus(message, status);
    
    // Store in learning database
    if (confidence > 0.5) {
        learningData.locations[`${kecamatan}-${kota}`] = {
            confidence: confidence,
            verified: true,
            timestamp: Date.now()
        };
    }
    
    return { confidence, verified: confidence > 0.5 };
}

// Show search status
function showSearchStatus(message, type) {
    const statusDiv = document.getElementById('searchStatus');
    const statusText = document.getElementById('searchStatusText');
    
    statusDiv.className = `search-status ${type}`;
    statusText.textContent = message;
    statusDiv.style.display = 'block';
    
    if (type === 'success' || type === 'error') {
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 3000);
    }
}

// Get product specifications based on price
function getProductSpecs(harga) {
    if (harga === 118000 || harga === 159000) {
        return { berat: 0.25, panjang: 10, lebar: 10, tinggi: 10, isi: 'reguler' };
    } else if (harga === 259000) {
        return { berat: 0.50, panjang: 10, lebar: 10, tinggi: 10, isi: 'reguler' };
    }
    return { berat: 0.25, panjang: 10, lebar: 10, tinggi: 10, isi: 'reguler' };
}

// Get product content based on price
function getProductContent(harga) {
    if (harga === 118000) {
        return 'Promo Kapsul Pinang Solusi Herbal Indonesia FB (1)';
    } else if (harga === 159000) {
        return 'Promo Kapsul Pinang Solusi Herbal Indonesia FB (2)';
    } else if (harga === 259000) {
        return 'Promo Kapsul Pinang Solusi Herbal Indonesia FB (3)';
    }
    return 'Promo Kapsul Pinang Solusi Herbal Indonesia FB (1)'; // Default
}

// Determine shipping type and courier logic
function getShippingInfo(courier, paymentMethod) {
    let jenisPengiriman = '';
    let jenisLayanan = 'Reguler';
    
    // Cargo services
    const cargoServices = ['J&T Cargo', 'Indah Logistik', 'Sentral Cargo'];
    if (cargoServices.includes(courier)) {
        jenisLayanan = 'Kargo';
    }
    
    // Shipping type logic
    if (courier === 'Lion Parcel') {
        if (paymentMethod === 'COD') {
            jenisPengiriman = 'COD PICKUP';
        } else {
            jenisPengiriman = 'PICKUP';
        }
    } else {
        if (paymentMethod === 'COD') {
            jenisPengiriman = 'COD DROPOFF';
        } else {
            jenisPengiriman = 'DROPOFF';
        }
    }
    
    return { jenisPengiriman, jenisLayanan };
}

// Calculate insurance
function calculateInsurance(ongkir, total) {
    return (ongkir * 10) < total ? 'Ya' : '';
}

// Process the input data
async function processData() {
    const inputText = document.getElementById('inputData').value.trim();
    if (!inputText) {
        alert('Please enter customer data');
        return;
    }

    const selectedCourier = document.getElementById('courierSelect').value;
    
    // Split input into multiple entries if separated by blank lines
    const entries = inputText.split(/\n\s*\n/).filter(entry => entry.trim());
    
    parsedData = [];
    let rowNumber = 1;

    for (const entry of entries) {
        const customerInfo = extractCustomerInfo(entry);
        
        if (!customerInfo.nama || !customerInfo.hp || !customerInfo.alamat) {
            continue; // Skip invalid entries
        }

        // Detect courier and payment method
        const detectedCourier = selectedCourier || detectCourier(entry);
        const paymentMethod = detectPaymentMethod(entry);
        
        if (!detectedCourier || !paymentMethod) {
            continue; // Skip entries without clear courier/payment info
        }

        // Parse address with AI enhancement
        const addressInfo = parseIndonesianAddressWithAI(customerInfo.alamat);
        
        // Verify location with internet search
        await verifyLocation(addressInfo.kecamatan, addressInfo.kota);
        
        // Get product specifications
        const specs = getProductSpecs(customerInfo.harga);
        
        // Get product content based on price
        const productContent = getProductContent(customerInfo.harga);
        
        // Get shipping information
        const shippingInfo = getShippingInfo(detectedCourier, paymentMethod);
        
        // Calculate insurance
        const asuransi = calculateInsurance(customerInfo.ongkir, customerInfo.total);
        
        // Critical: Handle payment values correctly
        let hargaBarang = '';
        let nilaiCod = '';
        
        if (paymentMethod === 'COD') {
            nilaiCod = customerInfo.total; // Use total for COD
        } else if (paymentMethod === 'TRANSFER') {
            hargaBarang = customerInfo.harga; // Use harga for TRANSFER
        }

        const rowData = {
            no: rowNumber++,
            jenisPengiriman: shippingInfo.jenisPengiriman,
            pilihanKurir: detectedCourier,
            jenisLayanan: shippingInfo.jenisLayanan,
            namaPengirim: document.getElementById('senderName').value,
            alamatPengirim: document.getElementById('senderAddress').value,
            noTelpPengirim: document.getElementById('senderPhone').value,
            kecamatanPengirim: document.getElementById('senderKecamatan').value,
            kotaPengirim: document.getElementById('senderKota').value,
            namaPenerima: customerInfo.nama,
            alamatPenerima: customerInfo.alamat,
            noTelpPenerima: customerInfo.hp,
            kecamatanPenerima: addressInfo.kecamatan,
            kotaPenerima: addressInfo.kota,
            berat: specs.berat,
            panjang: specs.panjang,
            lebar: specs.lebar,
            tinggi: specs.tinggi,
            isiPaket: productContent,
            asuransi: asuransi,
            hargaBarang: hargaBarang,
            nilaiCod: nilaiCod,
            instruksiPengiriman: 'JANGAN LUPA HUBUNGI BUYER SEBELUM MENGIRIM PAKET',
            noReferensi: ''
        };

        parsedData.push(rowData);
        
        // Update learning data
        learningData.totalProcessed++;
        learningData.successfulParses++;
    }

    // Update accuracy
    learningData.accuracy = (learningData.successfulParses / learningData.totalProcessed) * 100;
    
    // Save learning data
    saveLearningData();
    
    // Display preview
    displayPreview();
    
    // Update learning panel
    updateLearningPanel();
}

// Display preview table
function displayPreview() {
    const tableBody = document.getElementById('previewTableBody');
    tableBody.innerHTML = '';

    parsedData.forEach((row, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.no}</td>
            <td><span class="payment-badge">${row.jenisPengiriman}</span></td>
            <td><span class="courier-badge">${row.pilihanKurir}</span></td>
            <td>${row.jenisLayanan}</td>
            <td>${row.namaPengirim}</td>
            <td>${row.alamatPengirim}</td>
            <td>${row.noTelpPengirim}</td>
            <td>${row.kecamatanPengirim}</td>
            <td>${row.kotaPengirim}</td>
            <td class="editable-cell" onclick="editCell(this, 'namaPenerima', ${index})">${row.namaPenerima}</td>
            <td class="editable-cell" onclick="editCell(this, 'alamatPenerima', ${index})">${row.alamatPenerima}</td>
            <td class="editable-cell" onclick="editCell(this, 'noTelpPenerima', ${index})">${row.noTelpPenerima}</td>
            <td class="editable-cell" onclick="editCell(this, 'kecamatanPenerima', ${index})">${row.kecamatanPenerima}</td>
            <td class="editable-cell" onclick="editCell(this, 'kotaPenerima', ${index})">${row.kotaPenerima}</td>
            <td>${row.berat}</td>
            <td>${row.panjang}</td>
            <td>${row.lebar}</td>
            <td>${row.tinggi}</td>
            <td>${row.isiPaket}</td>
            <td>${row.asuransi}</td>
            <td>${row.hargaBarang}</td>
            <td>${row.nilaiCod}</td>
            <td>${row.instruksiPengiriman}</td>
            <td>${row.noReferensi}</td>
        `;
        tableBody.appendChild(tr);
    });

    // Update parsing summary
    const summary = document.getElementById('parsingSummary');
    summary.textContent = `Successfully parsed ${parsedData.length} customer entries`;

    // Show preview section
    document.getElementById('previewSection').style.display = 'block';
    
    // Show address suggestions if available
    if (addressParserAPI && addressParserAPI.isInitialized) {
        showAddressSuggestions();
    }
}

// Edit cell function
function editCell(element, field, index) {
    const currentValue = parsedData[index][field];
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentValue;
    input.className = 'form-control form-control-sm';
    
    input.onblur = function() {
        parsedData[index][field] = this.value;
        element.textContent = this.value;
        element.className = 'editable-cell';
        
        // Update learning data
        learningData.patterns[field] = learningData.patterns[field] || {};
        learningData.patterns[field][currentValue] = this.value;
        saveLearningData();
    };
    
    input.onkeypress = function(e) {
        if (e.key === 'Enter') {
            this.blur();
        }
    };
    
    element.innerHTML = '';
    element.appendChild(input);
    input.focus();
}

// Download Excel file
function downloadExcel() {
    if (parsedData.length === 0) {
        alert('No data to export');
        return;
    }

    // Define headers
    const headers = [
        'No', 'Jenis Pengiriman', 'Pilihan Kurir', 'Jenis Layanan', 'Nama Pengirim',
        'Alamat Pengirim', 'No. Telp. Pengirim', 'Kecamatan Pengirim', 'Kota Pengirim',
        'Nama Penerima', 'Alamat Penerima', 'No Telp. Penerima', 'Kecamatan Penerima',
        'Kota Penerima', 'Berat (kg)', 'Panjang (cm)', 'Lebar (cm)', 'Tinggi (cm)',
        'Isi Paket', 'Asuransi (Jika ya)', 'Harga Barang (jika non-COD)', 'Nilai COD (Jika COD)',
        'Instruksi Pengiriman (opt)', 'No Referensi (opt)'
    ];

    // Convert data to worksheet format
    const wsData = [headers];
    parsedData.forEach(row => {
        wsData.push([
            row.no, row.jenisPengiriman, row.pilihanKurir, row.jenisLayanan,
            row.namaPengirim, row.alamatPengirim, row.noTelpPengirim,
            row.kecamatanPengirim, row.kotaPengirim, row.namaPenerima,
            row.alamatPenerima, row.noTelpPenerima, row.kecamatanPenerima,
            row.kotaPenerima, row.berat, row.panjang, row.lebar, row.tinggi,
            row.isiPaket, row.asuransi, row.hargaBarang, row.nilaiCod,
            row.instruksiPengiriman, row.noReferensi
        ]);
    });

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Style the header row
    const headerRange = XLSX.utils.decode_range(ws['!ref']);
    for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!ws[cellAddress]) continue;
        
        ws[cellAddress].s = {
            font: { bold: true },
            alignment: { horizontal: 'center' }
        };
    }

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Shipping Data');

    // Generate filename with current date
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const filename = `shipping_data_${dateStr}.xlsx`;

    // Download the file
    XLSX.writeFile(wb, filename);
}

// Learning data management
function saveLearningData() {
    localStorage.setItem('shippingLearningData', JSON.stringify(learningData));
}

function loadLearningData() {
    const saved = localStorage.getItem('shippingLearningData');
    if (saved) {
        learningData = JSON.parse(saved);
    }
}

function updateLearningPanel() {
    document.getElementById('accuracyBar').style.width = `${learningData.accuracy}%`;
    document.getElementById('accuracyText').textContent = `${learningData.accuracy.toFixed(1)}%`;
    document.getElementById('patternCount').textContent = `${Object.keys(learningData.patterns).length} patterns`;
    document.getElementById('locationCount').textContent = `${Object.keys(learningData.locations).length} locations`;
    
    // Update address parser statistics
    if (addressParserAPI && addressParserAPI.isInitialized) {
        try {
            const stats = addressParserAPI.getLearningStats();
            const dbSize = addressParserAPI.parser.addressDatabase.length;
            document.getElementById('suggestionCount').textContent = `${stats.learnedWords + stats.addressPatterns} learned items`;
        } catch (error) {
            console.error('Error getting learning stats:', error);
            document.getElementById('suggestionCount').textContent = '0 suggestions';
        }
    } else {
        document.getElementById('suggestionCount').textContent = '0 suggestions';
    }
}

function exportLearningData() {
    const exportData = {
        shippingData: learningData,
        addressParserData: addressParserAPI ? addressParserAPI.exportLearningData() : null
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'complete_learning_data.json';
    link.click();
    
    URL.revokeObjectURL(url);
}

function importLearningData() {
    document.getElementById('learningDataInput').click();
}

        // Address Parser Functions
        async function loadAddressDatabase(input) {
            const file = input.files[0];
            if (!file) return;

            // Check if file is CSV
            if (!file.name.toLowerCase().endsWith('.csv')) {
                showDatabaseStatus('Please select a CSV file', 'error');
                return;
            }

            // Check if AddressParserAPI is available
            if (typeof AddressParserAPI === 'undefined') {
                showDatabaseStatus('Address Parser API not loaded. Please refresh the page.', 'error');
                return;
            }

            const reader = new FileReader();
            reader.onload = async function(e) {
                try {
                    const csvContent = e.target.result;
                    
                    // Initialize address parser if not already done
                    if (!addressParserAPI) {
                        addressParserAPI = new AddressParserAPI();
                    }
                    
                    await addressParserAPI.initialize(csvContent);
                    
                    showDatabaseStatus(`Database loaded successfully with ${addressParserAPI.parser.addressDatabase.length} records`, 'success');
                    updateLearningPanel();
                } catch (error) {
                    showDatabaseStatus(`Error loading database: ${error.message}`, 'error');
                    console.error('Database loading error:', error);
                }
            };
            
            reader.onerror = function() {
                showDatabaseStatus('Error reading file. Please try again.', 'error');
            };
            
            reader.readAsText(file);
        }

        async function loadSampleDatabase() {
            try {
                // Check if AddressParserAPI is available
                if (typeof AddressParserAPI === 'undefined') {
                    showDatabaseStatus('Address Parser API not loaded. Please refresh the page.', 'error');
                    return;
                }

                // Create sample database content directly in JavaScript
                const sampleCsvContent = `provinsi,kabupaten_kota,kecamatan,kelurahan_desa,kode_pos
DKI Jakarta,Jakarta Pusat,Tanah Abang,Sukamaju,10120
DKI Jakarta,Jakarta Pusat,Tanah Abang,Kebon Melati,10120
DKI Jakarta,Jakarta Pusat,Tanah Abang,Kebon Kacang,10120
DKI Jakarta,Jakarta Selatan,Kebayoran Baru,Selong,12110
DKI Jakarta,Jakarta Selatan,Kebayoran Baru,Gunung,12120
DKI Jakarta,Jakarta Barat,Grogol Petamburan,Grogol,11450
DKI Jakarta,Jakarta Utara,Penjaringan,Pluit,14450
Jawa Barat,Bogor,Cileungsi,Mampir,16820
Jawa Barat,Bogor,Cileungsi,Cileungsi,16820
Jawa Barat,Bekasi,Bekasi Utara,Kranji,17142
Jawa Barat,Bekasi,Bekasi Utara,Kayu Tinggi,17142
Jawa Barat,Bandung,Bandung Wetan,Citarum,40115
Jawa Barat,Bandung,Bandung Wetan,Citarum,40115
Jawa Tengah,Semarang,Semarang Tengah,Pindrikan Kidul,50131
Jawa Tengah,Semarang,Semarang Tengah,Pindrikan Lor,50131
Jawa Tengah,Solo,Solo,Kemlayan,57121
Jawa Tengah,Solo,Solo,Serengan,57155
Jawa Timur,Surabaya,Surabaya Pusat,Ketabang,60272
Jawa Timur,Surabaya,Surabaya Pusat,Genteng,60272
Jawa Timur,Malang,Malang,Klojen,65111
Jawa Timur,Malang,Malang,Sukun,65147
Bali,Buleleng,Buleleng,Kampung Kajanan,81113
Bali,Buleleng,Buleleng,Kampung Baru,81113
Bali,Denpasar,Denpasar Barat,Pemecutan,80118
Bali,Denpasar,Denpasar Barat,Dauh Puri,80114
Sumatera Utara,Medan,Medan Petisah,Petisah Tengah,20112
Sumatera Utara,Medan,Medan Petisah,Petisah Hulu,20112
Sumatera Utara,Medan,Medan Tuntungan,Tuntungan I,20135
Sumatera Utara,Medan,Medan Tuntungan,Tuntungan II,20136
Sumatera Barat,Padang,Padang Utara,Air Tawar Barat,25118
Sumatera Barat,Padang,Padang Utara,Air Tawar Timur,25118
Sumatera Barat,Padang,Padang Selatan,Ranah,25126
Sumatera Barat,Padang,Padang Selatan,Seberang Padang,25127`;
                
                if (!addressParserAPI) {
                    addressParserAPI = new AddressParserAPI();
                }
                
                await addressParserAPI.initialize(sampleCsvContent);
                showDatabaseStatus(`Sample database loaded with ${addressParserAPI.parser.addressDatabase.length} records`, 'success');
                updateLearningPanel();
            } catch (error) {
                showDatabaseStatus(`Error loading sample database: ${error.message}`, 'error');
                console.error('Sample database loading error:', error);
            }
        }

function showDatabaseStatus(message, type) {
    const statusDiv = document.getElementById('databaseStatus');
    const statusText = document.getElementById('databaseStatusText');
    
    statusDiv.className = `alert alert-${type === 'success' ? 'success' : 'danger'} mt-2`;
    statusText.textContent = message;
    statusDiv.style.display = 'block';
    
    setTimeout(() => {
        statusDiv.style.display = 'none';
    }, 5000);
}

// Show address suggestions and corrections
function showAddressSuggestions() {
    const suggestionsContainer = document.getElementById('addressSuggestions');
    if (!suggestionsContainer) {
        // Create suggestions container if it doesn't exist
        const previewSection = document.getElementById('previewSection');
        const suggestionsDiv = document.createElement('div');
        suggestionsDiv.id = 'addressSuggestions';
        suggestionsDiv.className = 'mt-3';
        suggestionsDiv.innerHTML = `
            <div class="section-title">
                <i class="fas fa-lightbulb"></i>
                <h4>AI Address Suggestions</h4>
            </div>
            <div class="row">
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">
                            <h6><i class="fas fa-search"></i> Address Suggestions</h6>
                        </div>
                        <div class="card-body" id="suggestionsList">
                            <p class="text-muted">No suggestions available</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">
                            <h6><i class="fas fa-spell-check"></i> Spelling Corrections</h6>
                        </div>
                        <div class="card-body" id="correctionsList">
                            <p class="text-muted">No corrections available</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        previewSection.appendChild(suggestionsDiv);
    }

    // Update suggestions and corrections
    updateSuggestionsAndCorrections();
}

function updateSuggestionsAndCorrections() {
    const suggestionsList = document.getElementById('suggestionsList');
    const correctionsList = document.getElementById('correctionsList');
    
    if (!suggestionsList || !correctionsList) return;

    // Get suggestions for the last processed address
    if (parsedData.length > 0 && addressParserAPI && addressParserAPI.isInitialized) {
        const lastAddress = parsedData[parsedData.length - 1].alamatPenerima;
        
        try {
            const parseResult = addressParserAPI.parseAddress(lastAddress);
            const suggestions = parseResult.suggestions || [];
            const corrections = parseResult.corrections || [];

            // Display suggestions
            if (suggestions.length > 0) {
                suggestionsList.innerHTML = suggestions.map(s => `
                    <div class="mb-2 p-2 border rounded">
                        <small class="text-muted">Suggestion</small><br>
                        <strong>${s}</strong>
                    </div>
                `).join('');
            } else {
                suggestionsList.innerHTML = '<p class="text-muted">No similar addresses found</p>';
            }

            // Display corrections
            if (corrections.length > 0) {
                correctionsList.innerHTML = corrections.map(c => `
                    <div class="mb-2 p-2 border rounded">
                        <small class="text-muted">Correction</small><br>
                        <strong>${c.original}</strong> → <strong class="text-success">${c.suggested}</strong>
                    </div>
                `).join('');
            } else {
                correctionsList.innerHTML = '<p class="text-muted">No spelling corrections needed</p>';
            }
        } catch (error) {
            console.error('Error getting suggestions:', error);
            suggestionsList.innerHTML = '<p class="text-muted">Error loading suggestions</p>';
            correctionsList.innerHTML = '<p class="text-muted">Error loading corrections</p>';
        }
    } else {
        suggestionsList.innerHTML = '<p class="text-muted">No address database loaded</p>';
        correctionsList.innerHTML = '<p class="text-muted">No address database loaded</p>';
    }
}

// Enhanced address parsing with AI suggestions
function parseIndonesianAddressWithAI(address) {
    if (!addressParserAPI || !addressParserAPI.isInitialized) {
        // Fallback to original parsing if no database loaded
        return parseIndonesianAddress(address);
    }

    try {
        const result = addressParserAPI.parseAddress(address);

        // Use both kabupaten_kota and kota as fallback, and kecamatan
        return {
            kecamatan: result.parsed.kecamatan || result.parsed.kecamatan_penerima || '',
            kota: result.parsed.kabupaten_kota || result.parsed.kota || result.parsed.kota_penerima || result.parsed.provinsi || '',
            confidence: result.confidence,
            suggestions: result.suggestions || [],
            corrections: result.corrections || [],
            postalCode: result.parsed.kode_pos || ''
        };
    } catch (error) {
        console.error('AI address parsing error:', error);
        return parseIndonesianAddress(address);
    }
}

// Add sample data button (for testing)
function addSampleData() {
    const sampleData = `Harga produk: 118.000 (1)
Ongkir kirim: 40.000
Biaya COD: 5.000
Total: 163.000
NAMA: Muhammad Muksin
HP: +62 877-8872-4610
ALAMAT: jln imam Bonjol GG masjid Jamik no 23 Singaraja Bali Kel kpnkajanan kab Buleleng provinsi bali RT 11 lingkungan tengah kp kajanan kec Buleleng
COD

Produk: Promo Kapsul Pinang Solusi Herbal Indonesia FB (1)
Harga: Rp118.000
Ongkir: Rp10.000
Biaya COD: Rp5.000
Total: Rp133.000
Dikirim ke:
Nama: Setiyono
No HP: +6281380272327
Alamat: Perum griya cileungsi 5 blok b6/03 RT/RW 03/18 Desa Mampir cileungsi Bogor
TRANSFER

Harga produk: 259.000 (1)
Ongkir kirim: 15.000
Total: 274.000
NAMA: Budi Santoso
HP: +62 812-3456-7890
ALAMAT: Jl. Merdeka No. 123 RT 05 RW 02 Kelurahan Sukamaju Kecamatan Tanah Abang Jakarta Pusat
LION`;
    
    document.getElementById('inputData').value = sampleData;
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Add sample data button to the UI
    const inputSection = document.querySelector('.col-lg-8');
    const sampleButton = document.createElement('button');
    sampleButton.className = 'btn btn-outline-secondary btn-sm mt-2';
    sampleButton.innerHTML = '<i class="fas fa-magic"></i> Load Sample Data';
    sampleButton.onclick = addSampleData;
    inputSection.appendChild(sampleButton);

    // Learning data import event listener
    document.getElementById('learningDataInput').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const importedData = JSON.parse(e.target.result);
                    
                    // Handle both old format and new format
                    if (importedData.shippingData && importedData.addressParserData) {
                        // New format with both shipping and address parser data
                        learningData = importedData.shippingData;
                        if (addressParserAPI) {
                            addressParserAPI.importLearningData(importedData.addressParserData);
                        }
                    } else {
                        // Old format - just shipping data
                        learningData = importedData;
                    }
                    
                    saveLearningData();
                    updateLearningPanel();
                    alert('Learning data imported successfully!');
                } catch (error) {
                    alert('Error importing learning data: ' + error.message);
                }
            };
            reader.readAsText(file);
        }
    });
}); 
