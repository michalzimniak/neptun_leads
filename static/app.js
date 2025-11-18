// Initialize map centered on Bydgoszcz
let map = L.map('map', {
    zoomControl: false  // Disable zoom buttons
}).setView([53.1235, 18.0084], 12);

// Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
}).addTo(map);

// Global variables
let locations = [];
let leadData = [];
let users = [];
let reservations = [];
let currentUser = null;
let markers = {};
let deferredPrompt = null; // For PWA install prompt
let allAreas = []; // All areas from OSM
let areaLayers = {}; // Layers for all areas
let addingLocation = false;
let selectedCoords = null;
let selectedArea = null;
let tempMarker = null;
let drawnItems = null;
let drawControl = null;
let currentDateFilter = null;
let searchResultsLayer = null;
let searchResults = [];
let selectedResultIndex = null;
let isLoadingAreas = false;
let loadedBounds = null;
let loadedRegions = []; // Cache of loaded bounding boxes to avoid reloading same areas
let areasCache = new Map(); // Cache areas by their place_id to avoid duplicates

// Modals
let addLeadDataModal, statsModal, randomAreaModal, loginModal, registerModal, searchMapModal;

// Initialize modals when document is ready
document.addEventListener('DOMContentLoaded', function() {
    addLeadDataModal = new bootstrap.Modal(document.getElementById('addLeadDataModal'));
    statsModal = new bootstrap.Modal(document.getElementById('statsModal'));
    randomAreaModal = new bootstrap.Modal(document.getElementById('randomAreaModal'));
    loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
    registerModal = new bootstrap.Modal(document.getElementById('registerModal'));
    searchMapModal = new bootstrap.Modal(document.getElementById('searchMapModal'));
    
    // Initialize drawing layer
    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    
    // Initialize search results layer
    searchResultsLayer = new L.FeatureGroup();
    map.addLayer(searchResultsLayer);
    
    // Add Enter key handler for location search
    document.getElementById('locationSearch').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchLocation();
        }
    });
    
    // Add Enter key handlers for login
    document.getElementById('loginUsername').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('loginPassword').focus();
        }
    });
    
    document.getElementById('loginPassword').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            login();
        }
    });
    
    // Add Enter key handler for map search
    document.getElementById('searchMapInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            performMapSearch();
        }
    });
    
    // Check current user session
    checkCurrentUser();
    
    // PWA install prompt handling
    setupPWAInstall();
    
    // Load initial data
    loadLocations();
    loadLeadData();
    loadUsers();
    loadReservations();
    
    // Preload nearby areas in background (100km radius from Bydgoszcz)
    setTimeout(() => {
        preloadNearbyAreas();
    }, 2000); // Wait 2 seconds after app start to not block other requests
    
    // Load areas when map is ready
    map.whenReady(function() {
        loadAreasInView();
    });
    
    // Reload areas when map moves or zooms (with debounce)
    let moveEndTimeout = null;
    map.on('moveend', function() {
        // Clear previous timeout
        if (moveEndTimeout) {
            clearTimeout(moveEndTimeout);
        }
        
        // Set new timeout - wait 500ms after movement stops
        moveEndTimeout = setTimeout(() => {
            loadAreasInView();
        }, 500);
    });
    
    // Reload areas when user returns to the app (e.g., after opening Google Maps)
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) {
            console.log('App became visible, refreshing display...');
            // Just refresh display of already loaded areas
            displayAllAreas();
        }
    });
    
    // Also reload when window gains focus
    window.addEventListener('focus', function() {
        console.log('Window gained focus, refreshing display...');
        // Just refresh display of already loaded areas
        displayAllAreas();
    });
});

// ============== AUTHENTICATION ==============

// Check current user session
async function checkCurrentUser() {
    try {
        const response = await fetch('/api/auth/current');
        const data = await response.json();
        
        if (data.user) {
            currentUser = data.user;
            updateUIForLoggedInUser();
        } else {
            currentUser = null;
            updateUIForLoggedOutUser();
        }
    } catch (error) {
        console.error('Error checking current user:', error);
        currentUser = null;
        updateUIForLoggedOutUser();
    }
}

// Update UI for logged in user
function updateUIForLoggedInUser() {
    // Update floating buttons
    document.getElementById('floatingLoggedInSection').style.display = 'block';
    document.getElementById('floatingLoggedOutSection').style.display = 'none';
    document.getElementById('floatingUsername').textContent = currentUser.username;
}

// Update UI for logged out user
function updateUIForLoggedOutUser() {
    // Update floating buttons
    document.getElementById('floatingLoggedInSection').style.display = 'none';
    document.getElementById('floatingLoggedOutSection').style.display = 'block';
}

// Show login modal
function showLoginModal() {
    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginError').style.display = 'none';
    loginModal.show();
}

// Show register modal
function showRegisterModal() {
    document.getElementById('registerUsername').value = '';
    document.getElementById('registerPassword').value = '';
    document.getElementById('registerPasswordConfirm').value = '';
    document.getElementById('registerError').style.display = 'none';
    registerModal.show();
}

// Login
async function login() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (!username || !password) {
        document.getElementById('loginError').textContent = 'Proszę wypełnić wszystkie pola';
        document.getElementById('loginError').style.display = 'block';
        return;
    }
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser = data.user;
            updateUIForLoggedInUser();
            loginModal.hide();
            
            // Reload data
            await loadLocations();
            await loadLeadData();
            await loadUsers();
            await loadReservations();
        } else {
            document.getElementById('loginError').textContent = data.error || 'Błąd logowania';
            document.getElementById('loginError').style.display = 'block';
        }
    } catch (error) {
        console.error('Login error:', error);
        document.getElementById('loginError').textContent = 'Błąd połączenia z serwerem';
        document.getElementById('loginError').style.display = 'block';
    }
}

// Register
async function register() {
    const username = document.getElementById('registerUsername').value.trim();
    const password = document.getElementById('registerPassword').value;
    const passwordConfirm = document.getElementById('registerPasswordConfirm').value;
    
    if (!username || !password || !passwordConfirm) {
        document.getElementById('registerError').textContent = 'Proszę wypełnić wszystkie pola';
        document.getElementById('registerError').style.display = 'block';
        return;
    }
    
    if (password !== passwordConfirm) {
        document.getElementById('registerError').textContent = 'Hasła nie są identyczne';
        document.getElementById('registerError').style.display = 'block';
        return;
    }
    
    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser = data.user;
            updateUIForLoggedInUser();
            registerModal.hide();
            
            // Reload data
            await loadLocations();
            await loadLeadData();
            await loadUsers();
            await loadReservations();
        } else {
            document.getElementById('registerError').textContent = data.error || 'Błąd rejestracji';
            document.getElementById('registerError').style.display = 'block';
        }
    } catch (error) {
        console.error('Register error:', error);
        document.getElementById('registerError').textContent = 'Błąd połączenia z serwerem';
        document.getElementById('registerError').style.display = 'block';
    }
}

// Confirm logout with toast
function confirmLogout() {
    showConfirm(
        'Czy na pewno chcesz się wylogować?',
        logout
    );
}

// Logout
async function logout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        currentUser = null;
        updateUIForLoggedOutUser();
        
        // Clear sensitive data
        leadData = [];
        displayAllAreas();
        
        showToast('Wylogowano pomyślnie', 'success');
    } catch (error) {
        console.error('Logout error:', error);
        showToast('Błąd podczas wylogowania', 'error');
    }
}

// Preload areas within 100km radius from Bydgoszcz at startup
async function preloadNearbyAreas() {
    console.log('Preloading areas within 100km from Bydgoszcz...');
    
    const radiusKm = 100;
    const radiusDegrees = radiusKm / 111; // Approximate: 1 degree ≈ 111 km
    
    // Calculate bounding box around Bydgoszcz
    const south = BYDGOSZCZ_LAT - radiusDegrees;
    const north = BYDGOSZCZ_LAT + radiusDegrees;
    const west = BYDGOSZCZ_LNG - radiusDegrees;
    const east = BYDGOSZCZ_LNG + radiusDegrees;
    
    try {
        console.log('Preload bounds:', {south, west, north, east});
        
        const overpassUrl = `https://overpass-api.de/api/interpreter`;
        
        // Single comprehensive query for all administrative areas
        const query = `[out:json][timeout:60];
(
  node["place"~"city|town|village|hamlet|suburb|neighbourhood"](${south},${west},${north},${east});
  way["place"~"city|town|village|hamlet|suburb|neighbourhood"](${south},${west},${north},${east});
  relation["boundary"="administrative"]["admin_level"~"^(7|8|9)$"](${south},${west},${north},${east});
);
out center;`;
        
        showToast('Ładowanie obszarów w okolicy...', 'info', 3000);
        
        const response = await fetch(overpassUrl, {
            method: 'POST',
            body: query
        });
        
        if (!response.ok) {
            console.log(`Preload failed with status: ${response.status}`);
            return;
        }
        
        const data = await response.json();
        const elements = data.elements || [];
        
        console.log(`Preloaded ${elements.length} elements`);
        
        // Convert to our format
        let loadedCount = 0;
        for (const element of elements) {
            if (!element.tags || !element.tags.name) continue;
            
            const name = element.tags.name;
            let centerLat = 0;
            let centerLon = 0;
            
            if (element.type === 'node') {
                centerLat = element.lat;
                centerLon = element.lon;
            } else if (element.center) {
                centerLat = element.center.lat;
                centerLon = element.center.lon;
            } else if (element.type === 'way' && element.geometry) {
                let sumLat = 0, sumLon = 0;
                element.geometry.forEach(point => {
                    sumLat += point.lat;
                    sumLon += point.lon;
                });
                centerLat = sumLat / element.geometry.length;
                centerLon = sumLon / element.geometry.length;
            } else if (element.type === 'relation' && element.members) {
                let sumLat = 0, sumLon = 0, totalPoints = 0;
                element.members.forEach(member => {
                    if (member.geometry) {
                        member.geometry.forEach(point => {
                            sumLat += point.lat;
                            sumLon += point.lon;
                            totalPoints++;
                        });
                    }
                });
                if (totalPoints > 0) {
                    centerLat = sumLat / totalPoints;
                    centerLon = sumLon / totalPoints;
                }
            }
            
            if (centerLat === 0 && centerLon === 0) continue;
            
            // Add to cache
            const area = {
                place_id: element.id,
                name: name,
                lat: centerLat,
                lon: centerLon,
                geojson: null,
                type: element.tags?.place || element.tags?.boundary || 'area',
                display_name: name,
                tags: element.tags
            };
            
            if (!areasCache.has(area.place_id)) {
                areasCache.set(area.place_id, area);
                allAreas.push(area);
                loadedCount++;
            }
        }
        
        // Mark the entire region as loaded
        loadedRegions.push({
            south: south,
            west: west,
            north: north,
            east: east
        });
        
        console.log(`Preloaded ${loadedCount} new areas. Cache size: ${areasCache.size}`);
        showToast(`Załadowano ${loadedCount} obszarów w okolicy`, 'success', 3000);
        
        // Display areas if map is zoomed in
        if (map.getZoom() >= 10) {
            displayAllAreas();
        }
        
    } catch (error) {
        console.error('Preload error:', error);
        showToast('Nie udało się załadować obszarów w tle', 'warning', 3000);
    }
}

// Load all areas visible in current map view
async function loadAreasInView() {
    if (isLoadingAreas) return;
    
    const bounds = map.getBounds();
    const zoom = map.getZoom();
    
    // Only load areas when zoomed in enough
    if (zoom < 10) {
        console.log('Zoom in to see areas (current zoom:', zoom, ')');
        return;
    }
    
    // Check if this region was already loaded
    const south = bounds.getSouth();
    const west = bounds.getWest();
    const north = bounds.getNorth();
    const east = bounds.getEast();
    
    // Check if current view overlaps significantly with any already loaded region
    const alreadyLoaded = loadedRegions.some(region => {
        // Check if at least 80% of current view is covered by this region
        const overlapSouth = Math.max(south, region.south);
        const overlapWest = Math.max(west, region.west);
        const overlapNorth = Math.min(north, region.north);
        const overlapEast = Math.min(east, region.east);
        
        if (overlapSouth >= overlapNorth || overlapWest >= overlapEast) {
            return false; // No overlap
        }
        
        const overlapArea = (overlapNorth - overlapSouth) * (overlapEast - overlapWest);
        const currentArea = (north - south) * (east - west);
        const coverage = overlapArea / currentArea;
        
        return coverage > 0.8; // 80% covered
    });
    
    if (alreadyLoaded) {
        console.log('Region already loaded from cache, just displaying...');
        displayAllAreas();
        return;
    }
    
    isLoadingAreas = true;
    
    try {
        const south = bounds.getSouth();
        const west = bounds.getWest();
        const north = bounds.getNorth();
        const east = bounds.getEast();
        
        // Build bounding box for Nominatim
        const bbox = `${west},${south},${east},${north}`;
        
        console.log('Loading areas for bounds:', bbox);
        
        // Use reverse geocoding to get areas in the bounding box
        // Get center point
        const centerLat = (south + north) / 2;
        const centerLon = (west + east) / 2;
        
        // Try multiple data sources for better coverage
        let elements = [];
        
        console.log('Querying Overpass API...');
        const overpassUrl = `https://overpass-api.de/api/interpreter`;
        
        // Split into smaller queries to avoid timeouts
        const queries = [
            // Administrative boundaries
            `[out:json][timeout:25];
(
  node["place"~"city|town|village|hamlet|suburb|neighbourhood"](${south},${west},${north},${east});
  way["place"~"city|town|village|hamlet|suburb|neighbourhood"](${south},${west},${north},${east});
);
out center;`,
            // Get boundaries with geometry
            `[out:json][timeout:25];
(
  relation["boundary"="administrative"]["admin_level"~"^(7|8|9)$"](${south},${west},${north},${east});
);
out geom;`
        ];
        
        for (const query of queries) {
            try {
                const response = await fetch(overpassUrl, {
                    method: 'POST',
                    body: query
                });
                
                if (!response.ok) {
                    console.log(`Overpass query failed with status: ${response.status}`);
                    continue;
                }
                
                const data = await response.json();
                if (data.elements && data.elements.length > 0) {
                    elements = elements.concat(data.elements);
                    console.log(`Found ${data.elements.length} elements from query`);
                }
            } catch (e) {
                console.log('Overpass query error:', e.message);
            }
        }
        
        console.log(`Found ${elements.length} total elements`);
        
        // Convert to our format - use points as markers instead of polygons
        const newAreas = [];
        
        for (const element of elements) {
            // Skip if no tags or name
            if (!element.tags || !element.tags.name) {
                continue;
            }
            
            const name = element.tags.name;
            let centerLat = 0;
            let centerLon = 0;
            
            // Get coordinates based on element type
            if (element.type === 'node') {
                centerLat = element.lat;
                centerLon = element.lon;
            } else if (element.center) {
                centerLat = element.center.lat;
                centerLon = element.center.lon;
            } else if (element.type === 'way' && element.geometry) {
                // Calculate center from geometry
                let sumLat = 0, sumLon = 0;
                element.geometry.forEach(point => {
                    sumLat += point.lat;
                    sumLon += point.lon;
                });
                centerLat = sumLat / element.geometry.length;
                centerLon = sumLon / element.geometry.length;
            } else if (element.type === 'relation' && element.members) {
                // Calculate center from members
                let sumLat = 0, sumLon = 0, totalPoints = 0;
                element.members.forEach(member => {
                    if (member.geometry) {
                        member.geometry.forEach(point => {
                            sumLat += point.lat;
                            sumLon += point.lon;
                            totalPoints++;
                        });
                    }
                });
                if (totalPoints > 0) {
                    centerLat = sumLat / totalPoints;
                    centerLon = sumLon / totalPoints;
                }
            }
            
            // Skip if no valid center
            if (centerLat === 0 && centerLon === 0) {
                continue;
            }
            
            // Store as point - no polygon, just coordinates
            newAreas.push({
                place_id: element.id,
                name: name,
                lat: centerLat,
                lon: centerLon,
                geojson: null, // No polygon
                type: element.tags?.place || element.tags?.boundary || 'area',
                display_name: name,
                tags: element.tags
            });
        }
        
        console.log(`Converted to ${newAreas.length} areas as points`);
        if (newAreas.length > 0) {
            console.log('Sample area:', newAreas[0]);
        }
        
        // Add new areas to our collection and cache
        newAreas.forEach(newArea => {
            // Check if already in cache
            if (!areasCache.has(newArea.place_id)) {
                areasCache.set(newArea.place_id, newArea);
                allAreas.push(newArea);
            }
        });
        
        // Store this region as loaded
        loadedRegions.push({
            south: south,
            west: west,
            north: north,
            east: east
        });
        
        console.log(`Cache now contains ${areasCache.size} areas, ${loadedRegions.length} regions loaded`);
        
        // Display all areas
        displayAllAreas();
        
    } catch (error) {
        console.error('Error loading areas:', error);
    } finally {
        isLoadingAreas = false;
    }
}

// Display all areas on the map
function displayAllAreas() {
    // Use cache if available, otherwise fallback to allAreas
    const areasToDisplay = areasCache.size > 0 ? Array.from(areasCache.values()) : allAreas;
    
    console.log(`displayAllAreas called - showing ${areasToDisplay.length} total areas (from ${areasCache.size > 0 ? 'cache' : 'legacy array'})`);
    
    // Clear existing area layers
    Object.values(areaLayers).forEach(layer => map.removeLayer(layer));
    areaLayers = {};
    
    // Get current map bounds
    const bounds = map.getBounds();
    console.log(`Current map bounds:`, bounds.toBBoxString());
    
    // Detect if device is mobile (touch-enabled) - once for all markers
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const iconSize = isMobile ? 26 : 24; // 10% larger on mobile
    const xSize = isMobile ? 32 : 29;
    
    let displayedCount = 0;
    
    areasToDisplay.forEach((area, index) => {
        const lat = parseFloat(area.lat);
        const lon = parseFloat(area.lon);
        
        // Only show areas within current view
        if (!bounds.contains([lat, lon])) {
            return;
        }
        
        displayedCount++;
        
        const areaName = area.name || area.display_name.split(',')[0];
        
        // Check if we have data for this area in our database
        const matchingLocation = locations.find(loc => {
            // Try to match by name or proximity
            const distance = Math.sqrt(Math.pow(loc.lat - lat, 2) + Math.pow(loc.lng - lon, 2));
            return loc.name === areaName || distance < 0.01;
        });
        
        let markerColor = '#1976d2'; // Default blue
        let totalLeads = 0;
        let totalRejections = 0;
        let locationLeadData = [];
        let hasNoProspects = false;
        
        if (matchingLocation) {
            locationLeadData = leadData.filter(ld => ld.location_id === matchingLocation.id);
            
            // Check if any entry has no_prospects flag
            hasNoProspects = locationLeadData.some(ld => ld.no_prospects === 1);
            
            // Apply date filter if active
            let filteredData = locationLeadData;
            if (currentDateFilter) {
                filteredData = locationLeadData.filter(ld => ld.date === currentDateFilter);
            }
            
            // Calculate totals
            totalLeads = filteredData.reduce((sum, ld) => sum + ld.leads_count, 0);
            totalRejections = filteredData.reduce((sum, ld) => sum + ld.rejections_count, 0);
            
            // Determine color based on data
            if (totalLeads > 0) {
                const successRate = (totalLeads - totalRejections) / totalLeads;
                if (successRate > 0.7) markerColor = '#28a745'; // green - high success
                else if (successRate > 0.4) markerColor = '#ffc107'; // yellow - medium
                else markerColor = '#dc3545'; // red - low success
            }
        }
        
        // Create custom icon - use X for no prospects, dot otherwise
        let iconHtml;
        if (hasNoProspects) {
            // X marker for no prospects
            iconHtml = `<div style="color: #dc3545; font-weight: bold; font-size: ${xSize}px; text-shadow: 0 0 3px white, 0 0 3px white;">✕</div>`;
        } else {
            // Regular dot marker
            iconHtml = `<div style="background-color: ${markerColor}; width: ${iconSize}px; height: ${iconSize}px; border-radius: 50%; border: 4px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`;
        }
        
        const icon = L.divIcon({
            className: 'custom-marker',
            html: iconHtml,
            iconSize: [iconSize, iconSize],
            iconAnchor: [iconSize/2, iconSize/2]
        });
        
        // Create marker
        const marker = L.marker([lat, lon], { icon: icon });
        
        // Create tooltip content
        let tooltipContent = `<div class="tooltip-content">`;
        tooltipContent += `<div class="tooltip-header">${areaName}</div>`;
        
        if (matchingLocation && locationLeadData.length > 0) {
            if (currentDateFilter) {
                tooltipContent += `<div class="tooltip-row">
                    <span class="tooltip-label">Data:</span>
                    <span class="tooltip-value">${currentDateFilter}</span>
                </div>`;
            }
            tooltipContent += `<div class="tooltip-row">
                <span class="tooltip-label">Leady:</span>
                <span class="tooltip-value">${totalLeads}</span>
            </div>`;
            tooltipContent += `<div class="tooltip-row">
                <span class="tooltip-label">Odmowy:</span>
                <span class="tooltip-value">${totalRejections}</span>
            </div>`;
        } else {
            tooltipContent += `<div class="tooltip-row">
                <span class="tooltip-label text-muted">Brak danych</span>
            </div>`;
        }
        
        tooltipContent += `</div>`;
        
        marker.bindTooltip(tooltipContent, {
            permanent: false,
            direction: 'top',
            className: 'custom-tooltip'
        });
        
        // Different behavior for desktop vs mobile
        if (isMobile) {
            // Mobile: tooltip only on click (touch)
            marker.on('click', () => {
                if (marker.isTooltipOpen()) {
                    marker.closeTooltip();
                } else {
                    marker.openTooltip();
                }
            });
        } else {
            // Desktop: tooltip on hover (mouseover), click does nothing
            marker.on('mouseover', () => {
                marker.openTooltip();
            });
            marker.on('mouseout', () => {
                marker.closeTooltip();
            });
        }
        
        // Right click - add new data (works on both desktop and mobile long-press)
        marker.on('contextmenu', (e) => {
            L.DomEvent.preventDefault(e);
            openLeadDataModalForArea(area, matchingLocation);
        });
        
        marker.addTo(map);
        areaLayers[`area_${index}`] = marker;
    });
    
    console.log(`Displayed ${displayedCount} areas as markers on map (out of ${areasToDisplay.length} total)`);
}

// Open modal to add/edit lead data for an area
function openLeadDataModalForArea(area, existingLocation) {
    // Check if user is logged in
    if (!currentUser) {
        showToast('Musisz być zalogowany, aby dodać dane', 'warning');
        showLoginModal();
        return;
    }
    
    const areaName = area.name || area.display_name.split(',')[0];
    const lat = parseFloat(area.lat);
    const lon = parseFloat(area.lon);
    
    // If location doesn't exist in database, create it first
    if (!existingLocation) {
        // Save location to database
        const locationData = {
            name: areaName,
            lat: lat,
            lng: lon,
            type: 'district',
            geojson: area.geojson
        };
        
        fetch('/api/locations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(locationData)
        })
        .then(response => response.json())
        .then(data => {
            // Reload locations and open modal
            loadLocations().then(() => {
                const newLocation = locations.find(loc => loc.name === areaName);
                if (newLocation) {
                    openLeadDataModal(newLocation);
                }
            });
        })
        .catch(error => {
            console.error('Error creating location:', error);
            showToast('Błąd podczas tworzenia lokalizacji', 'error');
        });
    } else {
        openLeadDataModal(existingLocation);
    }
}

// Load all locations from API
async function loadLocations() {
    try {
        const response = await fetch('/api/locations');
        locations = await response.json();
        updateMarkers();
        displayAllAreas(); // Refresh area colors
    } catch (error) {
        console.error('Error loading locations:', error);
        showToast('Błąd podczas wczytywania lokalizacji', 'error');
    }
}

// Load all lead data from API
async function loadLeadData() {
    try {
        const response = await fetch('/api/lead-data');
        leadData = await response.json();
        updateMarkers();
        displayAllAreas(); // Refresh area colors
    } catch (error) {
        console.error('Error loading lead data:', error);
    }
}

// Load all users from API
async function loadUsers() {
    try {
        const response = await fetch('/api/users');
        users = await response.json();
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

// Load all reservations from API
async function loadReservations() {
    try {
        const response = await fetch('/api/reservations');
        reservations = await response.json();
    } catch (error) {
        console.error('Error loading reservations:', error);
    }
}

// Update markers on the map (now handled by displayAllAreas)
function updateMarkers() {
    // This function is kept for compatibility
    // All rendering is now done in displayAllAreas()
    if (allAreas.length > 0) {
        displayAllAreas();
    }
}

// Create tooltip content HTML
function createTooltipContent(location, locationLeadData, totalLeads, totalRejections) {
    let html = `<div class="tooltip-content">`;
    html += `<div class="tooltip-header">${location.name}</div>`;
    html += `<div class="tooltip-row">
                <span class="tooltip-label">Typ:</span>
                <span class="tooltip-value">${location.type === 'city' ? 'Miejscowość' : 'Osiedle'}</span>
             </div>`;
    
    if (currentDateFilter) {
        html += `<div class="tooltip-row">
                    <span class="tooltip-label">Data:</span>
                    <span class="tooltip-value">${currentDateFilter}</span>
                 </div>`;
    }
    
    html += `<div class="tooltip-row">
                <span class="tooltip-label">Leady:</span>
                <span class="tooltip-value">${totalLeads}</span>
             </div>`;
    html += `<div class="tooltip-row">
                <span class="tooltip-label">Odmowy:</span>
                <span class="tooltip-value">${totalRejections}</span>
             </div>`;
    
    if (locationLeadData.length > 0 && !currentDateFilter) {
        const latestData = locationLeadData.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
        html += `<div class="tooltip-row">
                    <span class="tooltip-label">Ostatnia data:</span>
                    <span class="tooltip-value">${latestData.date}</span>
                 </div>`;
    }
    
    html += `</div>`;
    return html;
}

// Open add location panel
function openAddLocationPanel() {
    document.getElementById('addLocationPanel').classList.add('open');
    addingLocation = true;
    clearAll();
}

// Close add location panel
function closeAddLocationPanel() {
    document.getElementById('addLocationPanel').classList.remove('open');
    addingLocation = false;
    clearAll();
}

// Clear all temporary data
function clearAll() {
    document.getElementById('locationSearch').value = '';
    document.getElementById('locationName').value = '';
    document.getElementById('panelTitle').textContent = 'Wyszukaj i dodaj lokalizację';
    clearSearchResults();
    clearSelection();
}

// Search for location using Overpass API
async function searchLocation() {
    const query = document.getElementById('locationSearch').value.trim();
    if (!query) {
        showToast('Proszę wpisać nazwę lokalizacji', 'warning');
        return;
    }
    
    try {
        // Clear previous results
        clearSearchResults();
        
        // Use Nominatim for search (not for areas)
        const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ', Poland')}&format=json&polygon_geojson=1&limit=10`);
        searchResults = await response.json();
        
        if (searchResults.length === 0) {
            showToast('Nie znaleziono lokalizacji. Spróbuj innej nazwy.', 'info');
            return;
        }
        
        // Display results on map and in list
        displaySearchResults();
        
    } catch (error) {
        console.error('Error searching location:', error);
        showToast('Błąd podczas wyszukiwania lokalizacji', 'error');
    }
}

// Display search results on map and in panel
function displaySearchResults() {
    const resultsList = document.getElementById('searchResultsList');
    resultsList.innerHTML = '';
    
    searchResults.forEach((result, index) => {
        // Add to map
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);
        
        let layer;
        if (result.geojson && (result.geojson.type === 'Polygon' || result.geojson.type === 'MultiPolygon')) {
            layer = L.geoJSON(result.geojson, {
                style: {
                    color: '#0d6efd',
                    weight: 2,
                    fillOpacity: 0.2,
                    className: 'geometry-layer'
                }
            });
        } else {
            layer = L.marker([lat, lon]);
        }
        
        // Bind popup
        const popupContent = `<strong>${result.name || result.display_name.split(',')[0]}</strong><br><small>${result.display_name}</small>`;
        layer.bindPopup(popupContent);
        
        // Add click handler
        layer.on('click', () => selectSearchResult(index));
        
        searchResultsLayer.addLayer(layer);
        result._layer = layer;
        
        // Add to list
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.id = `result-${index}`;
        
        let displayName = result.display_name;
        let typeLabel = result.type || result.class;
        
        item.innerHTML = `
            <div class="d-flex justify-content-between align-items-start">
                <div>
                    <strong>${result.name || displayName.split(',')[0]}</strong><br>
                    <small class="text-muted">${displayName}</small>
                </div>
                <span class="badge bg-secondary">${typeLabel}</span>
            </div>
        `;
        
        item.onclick = () => selectSearchResult(index);
        resultsList.appendChild(item);
    });
    
    // Show results section
    document.getElementById('searchResultsSection').style.display = 'block';
    
    // Zoom to show all results
    if (searchResultsLayer.getLayers().length > 0) {
        map.fitBounds(searchResultsLayer.getBounds(), { padding: [50, 50] });
    }
}

// Select a search result
function selectSearchResult(index) {
    const result = searchResults[index];
    selectedResultIndex = index;
    
    // Clear previous selection from drawn items
    drawnItems.clearLayers();
    
    // Highlight selected in list
    document.querySelectorAll('.search-result-item').forEach(item => {
        item.classList.remove('selected');
    });
    document.getElementById(`result-${index}`).classList.add('selected');
    
    // Get coordinates
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    selectedCoords = { lat: lat, lng: lon };
    
    // Copy geometry to drawn items
    const layer = result._layer;
    let drawnLayer;
    
    if (result.geojson && (result.geojson.type === 'Polygon' || result.geojson.type === 'MultiPolygon')) {
        drawnLayer = L.geoJSON(result.geojson, {
            style: {
                color: '#198754',
                weight: 3,
                fillOpacity: 0.3
            }
        });
        
        selectedArea = {
            type: 'polygon',
            geojson: result.geojson,
            bounds: drawnLayer.toGeoJSON().geometry.coordinates
        };
        
        map.fitBounds(drawnLayer.getBounds());
    } else {
        drawnLayer = L.marker([lat, lon]);
        
        selectedArea = {
            type: 'marker',
            center: selectedCoords
        };
        
        map.setView([lat, lon], 13);
    }
    
    drawnItems.addLayer(drawnLayer);
    
    // Set location name and auto-fill type
    const name = result.name || result.display_name.split(',')[0];
    document.getElementById('locationName').value = name;
    
    // Auto-detect type
    if (result.type === 'suburb' || result.type === 'neighbourhood' || result.type === 'quarter') {
        document.getElementById('locationType').value = 'district';
    } else {
        document.getElementById('locationType').value = 'city';
    }
    
    // Show selected info
    document.getElementById('selectedCoords').textContent = `Szerokość: ${lat.toFixed(6)}, Długość: ${lon.toFixed(6)}`;
    document.getElementById('selectedLocationInfo').style.display = 'block';
    document.getElementById('panelTitle').textContent = 'Potwierdź i zapisz lokalizację';
}

// Clear search results
function clearSearchResults() {
    searchResultsLayer.clearLayers();
    searchResults = [];
    selectedResultIndex = null;
    document.getElementById('searchResultsSection').style.display = 'none';
    document.getElementById('searchResultsList').innerHTML = '';
}

// Clear selection
function clearSelection() {
    drawnItems.clearLayers();
    selectedCoords = null;
    selectedArea = null;
    document.getElementById('selectedLocationInfo').style.display = 'none';
    document.getElementById('locationName').value = '';
    
    // Remove draw control if exists
    if (drawControl) {
        map.removeControl(drawControl);
        drawControl = null;
    }
}

// Enable drawing mode
function enableDrawing(type) {
    clearSelection();
    clearSearchResults();
    
    // Remove old draw control if exists
    if (drawControl) {
        map.removeControl(drawControl);
    }
    
    // Configure draw control based on type
    const drawOptions = {
        edit: {
            featureGroup: drawnItems,
            remove: true
        },
        draw: {
            polygon: false,
            circle: false,
            rectangle: false,
            polyline: false,
            marker: false,
            circlemarker: false
        }
    };
    
    if (type === 'polygon') {
        drawOptions.draw.polygon = {
            allowIntersection: false,
            showArea: true
        };
    } else if (type === 'circle') {
        drawOptions.draw.circle = true;
    } else if (type === 'marker') {
        drawOptions.draw.marker = true;
    }
    
    drawControl = new L.Control.Draw(drawOptions);
    map.addControl(drawControl);
    
    // Listen for drawn shapes
    map.on('draw:created', onShapeDrawn);
}

// Handle drawn shape
function onShapeDrawn(e) {
    const layer = e.layer;
    drawnItems.addLayer(layer);
    
    // Get center point of the shape
    let center;
    if (layer instanceof L.Circle || layer instanceof L.CircleMarker) {
        center = layer.getLatLng();
        selectedArea = {
            type: 'circle',
            center: center,
            radius: layer.getRadius()
        };
    } else if (layer instanceof L.Polygon || layer instanceof L.Rectangle) {
        center = layer.getBounds().getCenter();
        selectedArea = {
            type: 'polygon',
            bounds: layer.getLatLngs()
        };
    } else if (layer instanceof L.Marker) {
        center = layer.getLatLng();
        selectedArea = {
            type: 'marker',
            center: center
        };
    }
    
    selectedCoords = center;
    
    // Show coordinates and selection info
    document.getElementById('selectedCoords').textContent = `Szerokość: ${center.lat.toFixed(6)}, Długość: ${center.lng.toFixed(6)}`;
    document.getElementById('selectedLocationInfo').style.display = 'block';
    document.getElementById('panelTitle').textContent = 'Nazwij i zapisz lokalizację';
    
    // Remove draw control after drawing
    if (drawControl) {
        map.removeControl(drawControl);
        drawControl = null;
    }
    map.off('draw:created', onShapeDrawn);
}

// Save new location
async function saveLocation() {
    const name = document.getElementById('locationName').value.trim();
    const type = document.getElementById('locationType').value;
    
    if (!name) {
        showToast('Proszę podać nazwę lokalizacji', 'warning');
        return;
    }
    
    if (!selectedCoords) {
        showToast('Proszę wybrać lokalizację na mapie', 'warning');
        return;
    }
    
    try {
        const locationData = {
            name: name,
            lat: selectedCoords.lat,
            lng: selectedCoords.lng,
            type: type
        };
        
        // Add geojson if available
        if (selectedArea && selectedArea.geojson) {
            locationData.geojson = selectedArea.geojson;
        }
        
        const response = await fetch('/api/locations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(locationData)
        });
        
        if (response.ok) {
            closeAddLocationPanel();
            
            // Reload locations
            await loadLocations();
        } else {
            showToast('Błąd podczas zapisywania lokalizacji', 'error');
        }
    } catch (error) {
        console.error('Error saving location:', error);
        showToast('Błąd podczas zapisywania lokalizacji', 'error');
    }
}

// Open modal to add lead data for a location
function openLeadDataModal(location) {
    document.getElementById('leadLocationId').value = location.id;
    document.getElementById('leadLocationName').value = location.name;
    
    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('leadDate').value = today;
    
    // Set default values
    document.getElementById('leadsCount').value = '0';
    document.getElementById('rejectionsCount').value = '0';
    
    // Reset checkbox
    document.getElementById('noProspects').checked = false;
    
    addLeadDataModal.show();
}

// Save lead data
async function saveLeadData() {
    const locationId = parseInt(document.getElementById('leadLocationId').value);
    const date = document.getElementById('leadDate').value;
    const leadsCount = parseInt(document.getElementById('leadsCount').value);
    const rejectionsCount = parseInt(document.getElementById('rejectionsCount').value);
    const noProspects = document.getElementById('noProspects').checked ? 1 : 0;
    
    if (!date) {
        showToast('Proszę podać datę', 'warning');
        return;
    }
    
    try {
        const response = await fetch('/api/lead-data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                location_id: locationId,
                date: date,
                leads_count: leadsCount,
                rejections_count: rejectionsCount,
                no_prospects: noProspects
            })
        });
        
        if (response.ok) {
            addLeadDataModal.hide();
            await loadLeadData();
        } else {
            showToast('Błąd podczas zapisywania danych', 'error');
        }
    } catch (error) {
        console.error('Error saving lead data:', error);
        showToast('Błąd podczas zapisywania danych', 'error');
    }
}

// Delete location
async function deleteLocation() {
    const locationId = parseInt(document.getElementById('leadLocationId').value);
    const locationName = document.getElementById('leadLocationName').value;
    
    showConfirm(
        `Czy na pewno chcesz usunąć lokalizację "${locationName}" i wszystkie powiązane dane?`,
        async () => {
            try {
                const response = await fetch(`/api/locations/${locationId}`, {
                    method: 'DELETE'
                });
                
                if (response.ok) {
                    addLeadDataModal.hide();
                    await loadLocations();
                    await loadLeadData();
                    showToast('Lokalizacja została usunięta', 'success');
                } else {
                    showToast('Błąd podczas usuwania lokalizacji', 'error');
                }
            } catch (error) {
                console.error('Error deleting location:', error);
                showToast('Błąd podczas usuwania lokalizacji', 'error');
            }
        }
    );
}

// Apply date filter
function applyDateFilter() {
    const dateInput = document.getElementById('dateFilter').value;
    if (dateInput) {
        currentDateFilter = dateInput;
        displayAllAreas();
    }
}

// Clear date filter
function clearDateFilter() {
    currentDateFilter = null;
    document.getElementById('dateFilter').value = '';
    displayAllAreas();
}

// Global variable for chart instance
let trendsChart = null;
let statsFilters = {
    dateFrom: null,
    dateTo: null,
    locationFilter: '',
    userFilter: null
};

// Show statistics
function showStats() {
    if (locations.length === 0) {
        showToast('Brak danych do wyświetlenia', 'info');
        return;
    }
    
    // Set default date range (last 30 days)
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    document.getElementById('statsDateFrom').value = thirtyDaysAgo.toISOString().split('T')[0];
    document.getElementById('statsDateTo').value = today.toISOString().split('T')[0];
    
    // Reset filters
    statsFilters = {
        dateFrom: null,
        dateTo: null,
        locationFilter: '',
        userFilter: null
    };
    document.getElementById('statsLocationFilter').value = '';
    
    // Populate user filter dropdown
    const userFilter = document.getElementById('statsUserFilter');
    userFilter.innerHTML = '<option value="">Wszyscy użytkownicy</option>';
    users.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = user.username;
        userFilter.appendChild(option);
    });
    
    // Generate all tabs
    generateStatsOverview();
    generateStatsByDate();
    generateStatsCharts();
    generateStatsUsers();
    
    statsModal.show();
}

// Apply filters
function applyStatsFilters() {
    const dateFrom = document.getElementById('statsDateFrom').value;
    const dateTo = document.getElementById('statsDateTo').value;
    const locationFilter = document.getElementById('statsLocationFilter').value.toLowerCase();
    const userFilter = document.getElementById('statsUserFilter').value;
    
    statsFilters = {
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
        locationFilter: locationFilter,
        userFilter: userFilter ? parseInt(userFilter) : null
    };
    
    generateStatsOverview();
    generateStatsByDate();
    generateStatsCharts();
    generateStatsUsers();
}

// Get filtered data
function getFilteredData() {
    let filteredData = [...leadData];
    
    // Apply date filters
    if (statsFilters.dateFrom) {
        filteredData = filteredData.filter(ld => ld.date >= statsFilters.dateFrom);
    }
    if (statsFilters.dateTo) {
        filteredData = filteredData.filter(ld => ld.date <= statsFilters.dateTo);
    }
    
    // Apply location filter
    if (statsFilters.locationFilter) {
        const filteredLocationIds = locations
            .filter(loc => loc.name.toLowerCase().includes(statsFilters.locationFilter))
            .map(loc => loc.id);
        filteredData = filteredData.filter(ld => filteredLocationIds.includes(ld.location_id));
    }
    
    // Apply user filter
    if (statsFilters.userFilter) {
        filteredData = filteredData.filter(ld => ld.user_id === statsFilters.userFilter);
    }
    
    return filteredData;
}

// Generate overview tab
function generateStatsOverview() {
    const filteredData = getFilteredData();
    const statsOverview = document.getElementById('statsOverview');
    
    let totalLeads = 0;
    let totalRejections = 0;
    const locationStats = [];
    
    locations.forEach(location => {
        const locationLeadData = filteredData.filter(ld => ld.location_id === location.id);
        if (locationLeadData.length === 0) return;
        
        const leads = locationLeadData.reduce((sum, ld) => sum + ld.leads_count, 0);
        const rejections = locationLeadData.reduce((sum, ld) => sum + ld.rejections_count, 0);
        
        // Find latest date for this location
        const latestDate = locationLeadData.reduce((latest, ld) => {
            return new Date(ld.date) > new Date(latest) ? ld.date : latest;
        }, locationLeadData[0].date);
        
        totalLeads += leads;
        totalRejections += rejections;
        
        if (leads > 0 || rejections > 0) {
            locationStats.push({
                name: location.name,
                leads: leads,
                rejections: rejections,
                conversionRate: leads > 0 ? ((leads - rejections) / leads * 100).toFixed(1) : 0,
                lastEntry: latestDate
            });
        }
    });
    
    locationStats.sort((a, b) => b.leads - a.leads);
    
    const successRate = totalLeads > 0 ? ((totalLeads - totalRejections) / totalLeads * 100).toFixed(1) : 0;
    
    let html = `
        <div class="row mb-4">
            <div class="col-md-3">
                <div class="card text-center">
                    <div class="card-body">
                        <h6 class="card-title">Suma leadów</h6>
                        <p class="display-6 text-primary">${totalLeads}</p>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card text-center">
                    <div class="card-body">
                        <h6 class="card-title">Suma odmów</h6>
                        <p class="display-6 text-danger">${totalRejections}</p>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card text-center">
                    <div class="card-body">
                        <h6 class="card-title">Skuteczność</h6>
                        <p class="display-6 text-success">${successRate}%</p>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card text-center">
                    <div class="card-body">
                        <h6 class="card-title">Lokalizacje</h6>
                        <p class="display-6 text-info">${locationStats.length}</p>
                    </div>
                </div>
            </div>
        </div>
        
        <h5>Ranking lokalizacji:</h5>
        <div class="table-responsive" style="max-height: 400px; overflow-y: auto;">
            <table class="table table-striped table-sm">
                <thead class="sticky-top bg-white">
                    <tr>
                        <th>#</th>
                        <th>Lokalizacja</th>
                        <th>Leady</th>
                        <th>Odmowy</th>
                        <th>Skuteczność</th>
                        <th>Ostatni wpis</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    locationStats.forEach((stat, index) => {
        html += `
            <tr>
                <td>${index + 1}</td>
                <td>${stat.name}</td>
                <td>${stat.leads}</td>
                <td>${stat.rejections}</td>
                <td><span class="badge ${stat.conversionRate > 70 ? 'bg-success' : stat.conversionRate > 40 ? 'bg-warning' : 'bg-danger'}">${stat.conversionRate}%</span></td>
                <td><small>${stat.lastEntry}</small></td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    statsOverview.innerHTML = html;
}

// Generate by date tab
function generateStatsByDate() {
    const filteredData = getFilteredData();
    const statsByDate = document.getElementById('statsByDate');
    
    // Group by date
    const dateGroups = {};
    filteredData.forEach(ld => {
        if (!dateGroups[ld.date]) {
            dateGroups[ld.date] = {
                leads: 0,
                rejections: 0,
                locations: new Set(),
                users: new Set()
            };
        }
        dateGroups[ld.date].leads += ld.leads_count;
        dateGroups[ld.date].rejections += ld.rejections_count;
        const location = locations.find(loc => loc.id === ld.location_id);
        if (location) {
            dateGroups[ld.date].locations.add(location.name);
        }
        if (ld.username) {
            dateGroups[ld.date].users.add(ld.username);
        }
    });
    
    // Sort by date descending
    const sortedDates = Object.keys(dateGroups).sort((a, b) => new Date(b) - new Date(a));
    
    let html = `
        <div class="table-responsive" style="max-height: 500px; overflow-y: auto;">
            <table class="table table-striped table-sm">
                <thead class="sticky-top bg-white">
                    <tr>
                        <th>Data</th>
                        <th>Leady</th>
                        <th>Odmowy</th>
                        <th>Skuteczność</th>
                        <th>Lokalizacje</th>
                        <th>Użytkownicy</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    sortedDates.forEach(date => {
        const data = dateGroups[date];
        const rate = data.leads > 0 ? ((data.leads - data.rejections) / data.leads * 100).toFixed(1) : 0;
        const locationsList = Array.from(data.locations).join(', ');
        const usersList = Array.from(data.users).join(', ');
        
        html += `
            <tr>
                <td><strong>${date}</strong></td>
                <td>${data.leads}</td>
                <td>${data.rejections}</td>
                <td><span class="badge ${rate > 70 ? 'bg-success' : rate > 40 ? 'bg-warning' : 'bg-danger'}">${rate}%</span></td>
                <td><small>${locationsList}</small></td>
                <td><small>${usersList || 'Nieznany'}</small></td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    statsByDate.innerHTML = html;
}

// Generate charts tab
function generateStatsCharts() {
    const filteredData = getFilteredData();
    
    // Destroy previous chart if exists
    if (trendsChart) {
        trendsChart.destroy();
    }
    
    // Group by date
    const dateGroups = {};
    filteredData.forEach(ld => {
        if (!dateGroups[ld.date]) {
            dateGroups[ld.date] = { leads: 0, rejections: 0 };
        }
        dateGroups[ld.date].leads += ld.leads_count;
        dateGroups[ld.date].rejections += ld.rejections_count;
    });
    
    // Sort by date
    const sortedDates = Object.keys(dateGroups).sort();
    const leadsData = sortedDates.map(date => dateGroups[date].leads);
    const rejectionsData = sortedDates.map(date => dateGroups[date].rejections);
    const successRateData = sortedDates.map(date => {
        const leads = dateGroups[date].leads;
        return leads > 0 ? ((leads - dateGroups[date].rejections) / leads * 100).toFixed(1) : 0;
    });
    
    // Calculate trend lines (linear regression)
    const leadsTrend = calculateTrendLine(leadsData);
    const rejectionsTrend = calculateTrendLine(rejectionsData);
    
    const ctx = document.getElementById('trendsChart').getContext('2d');
    trendsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sortedDates,
            datasets: [
                {
                    label: 'Leady',
                    data: leadsData,
                    borderColor: '#0d6efd',
                    backgroundColor: 'rgba(13, 110, 253, 0.1)',
                    tension: 0.1,
                    fill: true
                },
                {
                    label: 'Trend leadów',
                    data: leadsTrend,
                    borderColor: '#0d6efd',
                    borderDash: [5, 5],
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false
                },
                {
                    label: 'Odmowy',
                    data: rejectionsData,
                    borderColor: '#dc3545',
                    backgroundColor: 'rgba(220, 53, 69, 0.1)',
                    tension: 0.1,
                    fill: true
                },
                {
                    label: 'Trend odmów',
                    data: rejectionsTrend,
                    borderColor: '#dc3545',
                    borderDash: [5, 5],
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false
                },
                {
                    label: 'Skuteczność (%)',
                    data: successRateData,
                    borderColor: '#28a745',
                    backgroundColor: 'rgba(40, 167, 69, 0.1)',
                    tension: 0.1,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Trendy leadów i odmów w czasie'
                },
                legend: {
                    display: true,
                    position: 'bottom'
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Liczba'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Skuteczność (%)'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            }
        }
    });
}

// Calculate linear regression trend line
function calculateTrendLine(data) {
    const n = data.length;
    if (n === 0) return [];
    
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    
    for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += data[i];
        sumXY += i * data[i];
        sumX2 += i * i;
    }
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    return data.map((_, i) => slope * i + intercept);
}

// Generate users statistics tab
function generateStatsUsers() {
    const filteredData = getFilteredData();
    const statsUsers = document.getElementById('statsUsers');
    
    // Group by user
    const userStats = {};
    
    filteredData.forEach(ld => {
        const userId = ld.user_id || 0;
        const username = ld.username || 'Nieznany';
        
        if (!userStats[userId]) {
            userStats[userId] = {
                username: username,
                leads: 0,
                rejections: 0,
                entries: 0,
                locations: new Set()
            };
        }
        
        userStats[userId].leads += ld.leads_count;
        userStats[userId].rejections += ld.rejections_count;
        userStats[userId].entries += 1;
        
        const location = locations.find(loc => loc.id === ld.location_id);
        if (location) {
            userStats[userId].locations.add(location.name);
        }
    });
    
    // Convert to array and sort by leads
    const userStatsArray = Object.keys(userStats).map(userId => ({
        userId: userId,
        ...userStats[userId],
        locationCount: userStats[userId].locations.size,
        conversionRate: userStats[userId].leads > 0 ? 
            ((userStats[userId].leads - userStats[userId].rejections) / userStats[userId].leads * 100).toFixed(1) : 0
    })).sort((a, b) => b.leads - a.leads);
    
    let html = `
        <h5>Ranking użytkowników:</h5>
        <div class="row mb-4">
            <div class="col-md-3">
                <div class="card text-center">
                    <div class="card-body">
                        <h6 class="card-title">Aktywni użytkownicy</h6>
                        <p class="display-6 text-primary">${userStatsArray.length}</p>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card text-center">
                    <div class="card-body">
                        <h6 class="card-title">Łączne wpisy</h6>
                        <p class="display-6 text-info">${filteredData.length}</p>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card text-center">
                    <div class="card-body">
                        <h6 class="card-title">Najlepszy użytkownik</h6>
                        <p class="h5 text-success">${userStatsArray.length > 0 ? userStatsArray[0].username : '-'}</p>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card text-center">
                    <div class="card-body">
                        <h6 class="card-title">Leady lidera</h6>
                        <p class="display-6 text-success">${userStatsArray.length > 0 ? userStatsArray[0].leads : 0}</p>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="table-responsive" style="max-height: 400px; overflow-y: auto;">
            <table class="table table-striped table-sm">
                <thead class="sticky-top bg-white">
                    <tr>
                        <th>#</th>
                        <th>Użytkownik</th>
                        <th>Leady</th>
                        <th>Odmowy</th>
                        <th>Skuteczność</th>
                        <th>Wpisy</th>
                        <th>Lokalizacje</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    userStatsArray.forEach((stat, index) => {
        html += `
            <tr>
                <td>${index + 1}</td>
                <td><strong>${stat.username}</strong></td>
                <td>${stat.leads}</td>
                <td>${stat.rejections}</td>
                <td><span class="badge ${stat.conversionRate > 70 ? 'bg-success' : stat.conversionRate > 40 ? 'bg-warning' : 'bg-danger'}">${stat.conversionRate}%</span></td>
                <td>${stat.entries}</td>
                <td>${stat.locationCount}</td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    statsUsers.innerHTML = html;
}

// Show statistics for specific location
function showLocationStats(location, locationLeadData) {
    const statsContent = document.getElementById('statsContent');
    
    // Calculate totals
    let totalLeads = 0;
    let totalRejections = 0;
    
    locationLeadData.forEach(ld => {
        totalLeads += ld.leads_count;
        totalRejections += ld.rejections_count;
    });
    
    const successRate = totalLeads > 0 ? ((totalLeads - totalRejections) / totalLeads * 100).toFixed(1) : 0;
    
    // Sort by date descending
    const sortedData = [...locationLeadData].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Create HTML
    let html = `
        <h4 class="mb-3">${location.name}</h4>
        
        <div class="row mb-4">
            <div class="col-md-4">
                <div class="card text-center">
                    <div class="card-body">
                        <h6 class="card-title">Suma leadów</h6>
                        <p class="display-6 text-primary">${totalLeads}</p>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card text-center">
                    <div class="card-body">
                        <h6 class="card-title">Suma odmów</h6>
                        <p class="display-6 text-danger">${totalRejections}</p>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card text-center">
                    <div class="card-body">
                        <h6 class="card-title">Skuteczność</h6>
                        <p class="display-6 text-success">${successRate}%</p>
                    </div>
                </div>
            </div>
        </div>
        
        <h5>Historia danych:</h5>
        <div class="table-responsive">
            <table class="table table-striped">
                <thead>
                    <tr>
                        <th>Data</th>
                        <th>Leady</th>
                        <th>Odmowy</th>
                        <th>Skuteczność</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    sortedData.forEach(data => {
        const rate = data.leads_count > 0 ? 
            ((data.leads_count - data.rejections_count) / data.leads_count * 100).toFixed(1) : 0;
        
        html += `
            <tr>
                <td>${data.date}</td>
                <td>${data.leads_count}</td>
                <td>${data.rejections_count}</td>
                <td>${rate}%</td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
        
        <div class="mt-3">
            <small class="text-muted">Prawy przycisk myszy na punktach, aby dodać nowe dane</small>
        </div>
    `;
    
    statsContent.innerHTML = html;
    statsModal.show();
}

// ============== RANDOM AREA SELECTION ==============

// Bydgoszcz coordinates
const BYDGOSZCZ_LAT = 53.1235;
const BYDGOSZCZ_LNG = 18.0084;

// Calculate distance between two points in km (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Show random area modal
function showRandomAreaModal() {
    if (!currentUser) {
        showToast('Musisz być zalogowany, aby losować obszary', 'warning');
        showLoginModal();
        return;
    }
    
    document.getElementById('randomResult').style.display = 'none';
    
    // Set default reservation date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('reservationDate').value = today;
    
    randomAreaModal.show();
}

// Perform random area selection
let lastSelectedArea = null; // Store for reservation

function performRandomSelection() {
    const minRadius = parseFloat(document.getElementById('randomMinRadius').value);
    const maxRadius = parseFloat(document.getElementById('randomRadius').value);
    const monthsThreshold = parseInt(document.getElementById('randomMonths').value);
    
    // Validate radii
    if (minRadius >= maxRadius) {
        showToast('Minimalna odległość musi być mniejsza niż maksymalna', 'warning');
        return;
    }
    
    // Calculate date threshold
    const thresholdDate = new Date();
    thresholdDate.setMonth(thresholdDate.getMonth() - monthsThreshold);
    const thresholdDateStr = thresholdDate.toISOString().split('T')[0];
    
    // Get today's date for checking reservations
    const today = new Date().toISOString().split('T')[0];
    
    console.log('Random selection criteria:', {
        minRadius,
        maxRadius,
        monthsThreshold,
        thresholdDate: thresholdDateStr,
        today
    });
    
    // Get list of reserved area names for today
    const reservedToday = reservations
        .filter(r => r.reservation_date === today)
        .map(r => r.area_name.toLowerCase());
    
    console.log('Reserved areas today:', reservedToday);
    
    // Filter eligible areas - use cache if available
    const areasToCheck = areasCache.size > 0 ? Array.from(areasCache.values()) : allAreas;
    const eligibleAreas = [];
    
    areasToCheck.forEach(area => {
        // 1. Check distance from Bydgoszcz
        const distance = calculateDistance(
            BYDGOSZCZ_LAT, BYDGOSZCZ_LNG,
            area.lat, area.lon
        );
        
        if (distance < minRadius || distance > maxRadius) {
            return; // Too close or too far
        }
        
        // Check if area is reserved for today
        if (reservedToday.includes(area.name.toLowerCase())) {
            console.log('Skipping reserved area:', area.name);
            return; // Reserved
        }
        
        // Find matching location in database
        const matchingLocation = locations.find(loc => {
            const locDistance = calculateDistance(area.lat, area.lon, loc.lat, loc.lng);
            return loc.name === area.name || locDistance < 0.01;
        });
        
        // Get lead data for this area
        let areaLeadData = [];
        let hasNoProspects = false;
        let lastEntryDate = null;
        let successRate = 0;
        let totalLeads = 0;
        
        if (matchingLocation) {
            areaLeadData = leadData.filter(ld => ld.location_id === matchingLocation.id);
            
            // Check for no_prospects flag
            hasNoProspects = areaLeadData.some(ld => ld.no_prospects === 1);
            
            if (areaLeadData.length > 0) {
                // Find last entry date
                lastEntryDate = areaLeadData.reduce((latest, ld) => {
                    return new Date(ld.date) > new Date(latest) ? ld.date : latest;
                }, areaLeadData[0].date);
                
                // Calculate success rate
                totalLeads = areaLeadData.reduce((sum, ld) => sum + ld.leads_count, 0);
                const totalRejections = areaLeadData.reduce((sum, ld) => sum + ld.rejections_count, 0);
                successRate = totalLeads > 0 ? ((totalLeads - totalRejections) / totalLeads) : 0;
            }
        }
        
        // 3. Exclude areas with "no prospects" flag
        if (hasNoProspects) {
            return;
        }
        
        // 2. Check if no entries in last N months (or never had entries)
        const isEligible = !lastEntryDate || lastEntryDate < thresholdDateStr;
        
        if (!isEligible) {
            return;
        }
        
        // Calculate score for weighted random selection
        // Higher score = better candidate
        let score = 100; // Base score
        
        // Bonus for historical success rate (0-50 points)
        if (totalLeads > 0) {
            score += successRate * 50;
        } else {
            // Bonus for never tried areas (exploration)
            score += 25;
        }
        
        // Bonus for being closer to Bydgoszcz (0-30 points)
        score += (1 - (distance / maxRadius)) * 30;
        
        // Bonus for longer time since last entry (0-20 points)
        if (lastEntryDate) {
            const daysSinceLastEntry = (new Date() - new Date(lastEntryDate)) / (1000 * 60 * 60 * 24);
            const monthsSinceLastEntry = daysSinceLastEntry / 30;
            score += Math.min(monthsSinceLastEntry / 12, 1) * 20; // Max 20 points for 12+ months
        } else {
            score += 20; // Full bonus for never visited
        }
        
        eligibleAreas.push({
            area: area,
            location: matchingLocation,
            distance: distance,
            lastEntry: lastEntryDate,
            successRate: successRate,
            totalLeads: totalLeads,
            score: score
        });
    });
    
    console.log(`Found ${eligibleAreas.length} eligible areas`);
    
    if (eligibleAreas.length === 0) {
        showToast('Nie znaleziono obszarów spełniających kryteria. Spróbuj zwiększyć promień lub zmniejszyć liczbę miesięcy.', 'info', 6000);
        return;
    }
    
    // Weighted random selection
    const totalScore = eligibleAreas.reduce((sum, ea) => sum + ea.score, 0);
    let random = Math.random() * totalScore;
    
    let selectedArea = null;
    for (const ea of eligibleAreas) {
        random -= ea.score;
        if (random <= 0) {
            selectedArea = ea;
            break;
        }
    }
    
    if (!selectedArea) {
        selectedArea = eligibleAreas[eligibleAreas.length - 1];
    }
    
    // Store for reservation
    lastSelectedArea = selectedArea;
    
    // Display result
    document.getElementById('randomAreaName').textContent = selectedArea.area.name;
    
    let infoText = `Odległość: ${selectedArea.distance.toFixed(1)} km`;
    if (selectedArea.lastEntry) {
        infoText += ` | Ostatni wpis: ${selectedArea.lastEntry}`;
    } else {
        infoText += ` | Nigdy nie odwiedzano`;
    }
    if (selectedArea.totalLeads > 0) {
        infoText += ` | Skuteczność: ${(selectedArea.successRate * 100).toFixed(0)}%`;
    }
    
    document.getElementById('randomAreaInfo').textContent = infoText;
    document.getElementById('randomResult').style.display = 'block';
    
    // Zoom to selected area on map
    map.setView([selectedArea.area.lat, selectedArea.area.lon], 14);
    
    // Find and open tooltip for this marker
    setTimeout(() => {
        Object.values(areaLayers).forEach(layer => {
            if (layer.getLatLng && 
                Math.abs(layer.getLatLng().lat - selectedArea.area.lat) < 0.0001 &&
                Math.abs(layer.getLatLng().lng - selectedArea.area.lon) < 0.0001) {
                layer.openTooltip();
            }
        });
    }, 500);
}

// Make reservation for selected area
async function makeReservation() {
    if (!lastSelectedArea) {
        showToast('Nie wybrano obszaru do rezerwacji', 'warning');
        return;
    }
    
    if (!currentUser) {
        showToast('Musisz być zalogowany, aby dokonać rezerwacji', 'warning');
        showLoginModal();
        return;
    }
    
    const reservationDate = document.getElementById('reservationDate').value;
    if (!reservationDate) {
        showToast('Proszę wybrać datę rezerwacji', 'warning');
        return;
    }
    
    try {
        const response = await fetch('/api/reservations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                area_name: lastSelectedArea.area.name,
                area_lat: lastSelectedArea.area.lat,
                area_lng: lastSelectedArea.area.lon,
                reservation_date: reservationDate
            })
        });
        
        if (response.ok) {
            await loadReservations();
            randomAreaModal.hide();
            
            // Open Google Maps with navigation to the area
            const lat = lastSelectedArea.area.lat;
            const lon = lastSelectedArea.area.lon;
            const areaName = encodeURIComponent(lastSelectedArea.area.name);
            
            // Google Maps URL with directions
            // This works on both mobile and desktop
            const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&destination_place_id=${areaName}`;
            
            // Open in new tab/window
            window.open(mapsUrl, '_blank');
        } else {
            const data = await response.json();
            showToast(`Błąd rezerwacji: ${data.error || 'Nieznany błąd'}`, 'error');
        }
    } catch (error) {
        console.error('Reservation error:', error);
        showToast('Błąd podczas tworzenia rezerwacji', 'error');
    }
}

// ============== PWA INSTALL ==============

// Setup PWA install prompt
function setupPWAInstall() {
    // Listen for beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent Chrome 67 and earlier from automatically showing the prompt
        e.preventDefault();
        // Stash the event so it can be triggered later
        deferredPrompt = e;
        
        // Check if user dismissed banner before
        const dismissed = localStorage.getItem('pwa-install-dismissed');
        const dismissedTime = localStorage.getItem('pwa-install-dismissed-time');
        
        // Show banner if not dismissed, or if dismissed more than 7 days ago
        if (!dismissed || (dismissedTime && Date.now() - parseInt(dismissedTime) > 7 * 24 * 60 * 60 * 1000)) {
            showPWABanner();
        }
    });
    
    // Listen for app installed event
    window.addEventListener('appinstalled', () => {
        console.log('PWA was installed');
        hidePWABanner();
        deferredPrompt = null;
    });
    
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
        console.log('App is running in standalone mode');
        hidePWABanner();
    }
}

// Show PWA install banner
function showPWABanner() {
    const banner = document.getElementById('pwaInstallBanner');
    if (banner) {
        banner.style.display = 'block';
    }
}

// Hide PWA install banner
function hidePWABanner() {
    const banner = document.getElementById('pwaInstallBanner');
    if (banner) {
        banner.style.display = 'none';
    }
}

// Install PWA
async function installPWA() {
    if (!deferredPrompt) {
        showToast('Instalacja aplikacji nie jest dostępna w tej przeglądarce. Spróbuj: Chrome/Edge: Menu → Dodaj do ekranu głównego lub Safari: Udostępnij → Dodaj do ekranu początkowego', 'info', 6000);
        return;
    }
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);
    
    if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
    } else {
        console.log('User dismissed the install prompt');
    }
    
    // Clear the deferredPrompt
    deferredPrompt = null;
    hidePWABanner();
}

// Dismiss PWA banner
function dismissPWABanner() {
    hidePWABanner();
    localStorage.setItem('pwa-install-dismissed', 'true');
    localStorage.setItem('pwa-install-dismissed-time', Date.now().toString());
}

// ============== MAP SEARCH ==============

let mapSearchResultsData = [];

// Show search map modal
function showSearchMapModal() {
    if (searchMapModal) {
        // Clear previous search
        document.getElementById('searchMapInput').value = '';
        document.getElementById('mapSearchResults').style.display = 'none';
        document.getElementById('mapSearchNoResults').style.display = 'none';
        document.getElementById('mapSearchResultsList').innerHTML = '';
        mapSearchResultsData = [];
        
        searchMapModal.show();
        
        // Focus on input
        setTimeout(() => {
            document.getElementById('searchMapInput').focus();
        }, 500);
    }
}

// Perform map search using Nominatim
async function performMapSearch() {
    const query = document.getElementById('searchMapInput').value.trim();
    
    if (!query) {
        showToast('Wpisz nazwę obszaru do wyszukania', 'warning');
        return;
    }
    
    // Show loading
    document.getElementById('mapSearchLoading').style.display = 'block';
    document.getElementById('mapSearchResults').style.display = 'none';
    document.getElementById('mapSearchNoResults').style.display = 'none';
    
    try {
        // Bydgoszcz coordinates for proximity search
        const bydgoszczLat = 53.1235;
        const bydgoszczLon = 18.0084;
        
        // Search using Nominatim with viewbox around Poland, prioritizing areas near Bydgoszcz
        const url = `https://nominatim.openstreetmap.org/search?` +
            `q=${encodeURIComponent(query)}` +
            `&format=json` +
            `&limit=20` +
            `&countrycodes=pl` +
            `&addressdetails=1` +
            `&polygon_geojson=1` +
            `&viewbox=14.0,49.0,24.0,55.0` + // Poland bounds
            `&bounded=0`;
        
        const response = await fetch(url);
        const results = await response.json();
        
        if (results && results.length > 0) {
            // Calculate distance from Bydgoszcz for each result
            results.forEach(result => {
                const lat = parseFloat(result.lat);
                const lon = parseFloat(result.lon);
                result.distanceFromBydgoszcz = calculateDistance(
                    bydgoszczLat, bydgoszczLon, lat, lon
                );
            });
            
            // Sort by distance from Bydgoszcz
            results.sort((a, b) => a.distanceFromBydgoszcz - b.distanceFromBydgoszcz);
            
            // Store results
            mapSearchResultsData = results;
            
            // Display results
            displayMapSearchResults(results);
            
            document.getElementById('mapSearchLoading').style.display = 'none';
            document.getElementById('mapSearchResults').style.display = 'block';
        } else {
            document.getElementById('mapSearchLoading').style.display = 'none';
            document.getElementById('mapSearchNoResults').style.display = 'block';
        }
    } catch (error) {
        console.error('Error searching map:', error);
        document.getElementById('mapSearchLoading').style.display = 'none';
        showToast('Wystąpił błąd podczas wyszukiwania. Spróbuj ponownie.', 'error');
    }
}

// Display map search results
function displayMapSearchResults(results) {
    const listContainer = document.getElementById('mapSearchResultsList');
    listContainer.innerHTML = '';
    
    results.forEach((result, index) => {
        const div = document.createElement('div');
        div.className = 'search-result-list-item';
        
        // Build display name
        let displayName = result.display_name;
        
        // Add distance info
        const distanceKm = Math.round(result.distanceFromBydgoszcz);
        const distanceInfo = distanceKm < 1 ? 'Bydgoszcz' : `${distanceKm} km od Bydgoszczy`;
        
        // Get type
        const type = result.type || result.class || 'obszar';
        
        div.innerHTML = `
            <strong>${result.name || displayName}</strong>
            <div class="text-muted small">${displayName}</div>
            <div class="text-primary small">📍 ${distanceInfo} • ${type}</div>
        `;
        
        div.onclick = () => selectMapSearchResult(index);
        
        listContainer.appendChild(div);
    });
}

// Select map search result and zoom to it
function selectMapSearchResult(index) {
    const result = mapSearchResultsData[index];
    
    if (!result) return;
    
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    
    // Close modal
    if (searchMapModal) {
        searchMapModal.hide();
    }
    
    // Zoom to location
    if (result.geojson) {
        // If we have polygon data, fit bounds to it
        const geoJsonLayer = L.geoJSON(result.geojson);
        const bounds = geoJsonLayer.getBounds();
        map.fitBounds(bounds, { padding: [50, 50] });
        
        // Add temporary highlight
        const highlightLayer = L.geoJSON(result.geojson, {
            style: {
                color: '#ff0000',
                weight: 3,
                fillOpacity: 0.1
            }
        }).addTo(map);
        
        // Remove highlight after 3 seconds
        setTimeout(() => {
            map.removeLayer(highlightLayer);
        }, 3000);
    } else if (result.boundingbox) {
        // Use bounding box
        const bbox = result.boundingbox;
        const bounds = [
            [parseFloat(bbox[0]), parseFloat(bbox[2])],
            [parseFloat(bbox[1]), parseFloat(bbox[3])]
        ];
        map.fitBounds(bounds, { padding: [50, 50] });
    } else {
        // Just center on coordinates
        map.setView([lat, lon], 14);
    }
    
    // Add temporary marker
    const tempMarker = L.marker([lat, lon], {
        icon: L.divIcon({
            className: 'search-marker',
            html: '📍',
            iconSize: [30, 30]
        })
    }).addTo(map);
    
    // Remove marker after 3 seconds
    setTimeout(() => {
        map.removeLayer(tempMarker);
    }, 3000);
    
    // Load areas in the new view after map settles
    setTimeout(() => {
        loadAreasInView();
    }, 600);
}

// Calculate distance between two points (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// ============== TOAST NOTIFICATIONS ==============

let toastCounter = 0;

// Show toast notification
function showToast(message, type = 'info', duration = 4000) {
    const toastId = `toast-${toastCounter++}`;
    const container = document.getElementById('toastContainer');
    
    // Icon based on type
    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };
    
    // Polish labels
    const labels = {
        success: 'Sukces',
        error: 'Błąd',
        warning: 'Ostrzeżenie',
        info: 'Informacja'
    };
    
    // Create toast element
    const toastDiv = document.createElement('div');
    toastDiv.id = toastId;
    toastDiv.className = `toast custom-toast toast-${type}`;
    toastDiv.setAttribute('role', 'alert');
    toastDiv.setAttribute('aria-live', 'assertive');
    toastDiv.setAttribute('aria-atomic', 'true');
    
    toastDiv.innerHTML = `
        <div class="toast-header">
            <strong class="me-auto">${icons[type]} ${labels[type]}</strong>
            <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
        </div>
        <div class="toast-body">
            ${message}
        </div>
    `;
    
    container.appendChild(toastDiv);
    
    // Initialize and show toast
    const toast = new bootstrap.Toast(toastDiv, {
        autohide: true,
        delay: duration
    });
    toast.show();
    
    // Remove element after it's hidden
    toastDiv.addEventListener('hidden.bs.toast', () => {
        toastDiv.remove();
    });
}

// Show confirm dialog with custom styling
function showConfirm(message, onConfirm, onCancel) {
    const confirmId = `confirm-${toastCounter++}`;
    const container = document.getElementById('toastContainer');
    
    const confirmDiv = document.createElement('div');
    confirmDiv.id = confirmId;
    confirmDiv.className = 'toast custom-toast toast-warning';
    confirmDiv.setAttribute('role', 'alert');
    confirmDiv.setAttribute('data-bs-autohide', 'false');
    
    confirmDiv.innerHTML = `
        <div class="toast-header">
            <strong class="me-auto">⚠ Potwierdzenie</strong>
            <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
        </div>
        <div class="toast-body">
            <p>${message}</p>
            <div class="d-flex gap-2 justify-content-end mt-2">
                <button class="btn btn-sm btn-secondary" onclick="document.getElementById('${confirmId}').querySelector('.btn-close').click()">Anuluj</button>
                <button class="btn btn-sm btn-danger" id="${confirmId}-confirm">Potwierdź</button>
            </div>
        </div>
    `;
    
    container.appendChild(confirmDiv);
    
    const toast = new bootstrap.Toast(confirmDiv, { autohide: false });
    toast.show();
    
    // Handle confirm button
    document.getElementById(`${confirmId}-confirm`).addEventListener('click', () => {
        toast.hide();
        if (onConfirm) onConfirm();
    });
    
    // Handle cancel/close
    confirmDiv.addEventListener('hidden.bs.toast', () => {
        confirmDiv.remove();
        if (onCancel) onCancel();
    });
}




