// main.js - Nepaldmkurl SMP Stats
// Assumptions about players.json structure:
// - Array of player objects with fields: uuid, name, playtime, hearts, blocksMined, 
//   distanceTraveled, playerKills, mobKills, kills, deaths, KDR, itemsUsed, 
//   entitiesKilled, jumps, lastSeen, movement, totals
// - Names starting with '.' get Steve skin
// - All stats should be accurately displayed

// Global variables
let players = [];
let currentStat = 'playtime';
let kdrChart = null;

// DOM elements
const leaderboardList = document.getElementById('leaderboardList');
const statHeader = document.getElementById('statHeader');
const tabs = document.querySelectorAll('.tab');
const totalPlayersStat = document.getElementById('totalPlayersStat');
const totalPlaytime = document.getElementById('totalPlaytime');
const totalDeaths = document.getElementById('totalDeaths');
const totalBlocks = document.getElementById('totalBlocks');
const totalDistance = document.getElementById('totalDistance');

// Format time from minutes to Xh Ym
function formatTime(minutes) {
    if (!minutes || minutes === 0) return '0m';
    
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
}

// Format distance from blocks to km with 2 decimals
function formatDistance(blocks) {
    if (!blocks || blocks === 0) return '0.00 km';
    return (blocks / 1000).toFixed(2) + ' km';
}

// Calculate KDR with 2 decimals
function calculateKDR(kills, deaths) {
    if (deaths === 0) {
        return kills > 0 ? kills.toFixed(2) : '0.00';
    }
    return (kills / deaths).toFixed(2);
}

// Get player avatar URL - use Steve skin for names starting with '.'
function getAvatarUrl(uuid, name, size = 80) {
    // If name starts with '.', use Steve skin
    if (name && name.startsWith('.')) {
        return `https://minotar.net/avatar/Steve/${size}.png`;
    }
    // Use Minotar by name for better compatibility
    return `https://minotar.net/avatar/${encodeURIComponent(name)}/${size}.png`;
}

// Format player name to show at least 3 characters
function formatPlayerName(name) {
    if (!name) return 'Unknown';
    
    // Remove any leading/trailing dots and spaces
    const cleanName = name.trim().replace(/^\.+|\.+$/g, '');
    
    if (cleanName.length <= 12) {
        return cleanName;
    }
    
    // For long names, show first 3 characters + "..." + last 3 characters
    if (cleanName.length > 12) {
        const firstPart = cleanName.substring(0, 3);
        const lastPart = cleanName.substring(cleanName.length - 3);
        return `${firstPart}...${lastPart}`;
    }
    
    return cleanName;
}

// Sort players by current stat (highest first, except deaths which is also highest first)
function sortPlayersByStat(stat) {
    return [...players].sort((a, b) => {
        let aVal = a[stat] || 0;
        let bVal = b[stat] || 0;
        
        // For all stats, higher is better (even deaths - shows most deaths)
        return bVal - aVal;
    });
}

// Update stat header text based on current stat
function updateStatHeader() {
    const headerTexts = {
        playtime: 'Playtime',
        kills: 'Kills',
        blocksMined: 'Blocks Mined',
        distanceTraveled: 'Distance (km)',
        deaths: 'Deaths'
    };
    
    statHeader.textContent = headerTexts[currentStat] || 'Stat';
}

// Get display value for current stat
function getStatDisplayValue(player, stat) {
    switch(stat) {
        case 'playtime':
            return formatTime(player.playtime);
        case 'distanceTraveled':
            return formatDistance(player.distanceTraveled);
        case 'kills':
        case 'deaths':
        case 'blocksMined':
            return (player[stat] || 0).toLocaleString();
        default:
            return player[stat] || 0;
    }
}

// Render leaderboard
function renderLeaderboard() {
    const sortedPlayers = sortPlayersByStat(currentStat);
    
    leaderboardList.innerHTML = '';
    
    sortedPlayers.forEach((player, index) => {
        const rank = index + 1;
        const row = document.createElement('div');
        row.className = `leaderboard-item ${rank <= 3 ? `rank-${rank}` : ''}`;
        
        // Get stat value for display
        const statValue = getStatDisplayValue(player, currentStat);
        
        // Rank badge for top 3
        let rankBadge = '';
        if (rank === 1) rankBadge = '👑';
        if (rank === 2) rankBadge = '🥈';
        if (rank === 3) rankBadge = '🥉';
        
        // Format player name to show at least 3 characters
        const displayName = formatPlayerName(player.name);
        
        row.innerHTML = `
            <div class="player-rank">
                ${rankBadge ? `<div class="rank-badge">${rankBadge}</div>` : ''}
                <div>#${rank}</div>
            </div>
            <div class="player-info">
                <img class="player-avatar" src="${getAvatarUrl(player.uuid, player.name, 80)}" alt="${player.name}'s avatar" loading="lazy">
                <div class="player-name-container">
                    <div class="player-name">${displayName}</div>
                    <div class="player-name-tooltip">${player.name}</div>
                </div>
            </div>
            <div class="player-stat">${statValue}</div>
        `;
        
        row.addEventListener('click', () => openPlayerModal(player, rank));
        leaderboardList.appendChild(row);
    });
}

// Open player modal
function openPlayerModal(player, rank) {
    const modal = document.getElementById('playerModal');
    const modalName = document.getElementById('modalName');
    const modalAvatar = document.getElementById('modalAvatar');
    const modalUid = document.getElementById('modalUid');
    const modalLastSeen = document.getElementById('modalLastSeen');
    const statRow = document.getElementById('statRow');
    const detailedStats = document.getElementById('detailedStats');
    const chartContainer = document.getElementById('chartContainer');
    
    // Set basic player info
    modalName.textContent = player.name;
    modalUid.textContent = `UUID: ${player.uuid}`;
    
    // Set avatar (use Steve for names starting with '.')
    modalAvatar.innerHTML = `<img src="${getAvatarUrl(player.uuid, player.name, 120)}" alt="${player.name}'s avatar" style="width:100%;height:100%;object-fit:cover">`;
    
    // Set last seen
    modalLastSeen.textContent = player.lastSeen ? new Date(player.lastSeen).toLocaleDateString() + ' ' + new Date(player.lastSeen).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Unknown';
    
    // Create stat badges (Summary section)
    const badges = [
        { label: 'Rank', value: `#${rank}` },
        { label: 'Playtime', value: formatTime(player.playtime) },
        { label: 'Health', value: `${player.hearts || 10} ❤️` },
        { label: 'Kills', value: player.kills || 0 },
        { label: 'Deaths', value: player.deaths || 0 },
        { label: 'KDR', value: calculateKDR(player.kills || 0, player.deaths || 0) },
        { label: 'Blocks Mined', value: (player.blocksMined || 0).toLocaleString() },
        { label: 'Distance', value: formatDistance(player.distanceTraveled) }
    ];
    
    statRow.innerHTML = badges.map(badge => `
        <div class="badge">
            <strong>${badge.value}</strong>
            <div>${badge.label}</div>
        </div>
    `).join('');
    
    // Create detailed stats with ALL data from players.json
    const detailedStatsData = [
        { label: 'Player Kills', value: player.playerKills || 0 },
        { label: 'Mob Kills', value: player.mobKills || 0 },
        { label: 'Total Kills', value: player.kills || 0 },
        { label: 'Deaths', value: player.deaths || 0 },
        { label: 'KDR', value: calculateKDR(player.kills || 0, player.deaths || 0) },
        { label: 'Items Used', value: (player.itemsUsed || 0).toLocaleString() },
        { label: 'Entities Killed', value: player.entitiesKilled || 0 },
        { label: 'Jumps', value: (player.jumps || 0).toLocaleString() },
        { label: 'Blocks Mined', value: (player.blocksMined || 0).toLocaleString() },
        { label: 'Distance Traveled', value: formatDistance(player.distanceTraveled) },
        { label: 'Health', value: `${player.hearts || 10} hearts` },
        { label: 'Playtime', value: formatTime(player.playtime) }
    ];
    
    // Add movement stats if available
    if (player.movement) {
        Object.entries(player.movement).forEach(([key, value]) => {
            if (key !== 'Total (blocks)') {
                detailedStatsData.push({ 
                    label: key, 
                    value: typeof value === 'number' ? value.toLocaleString() + ' blocks' : value 
                });
            }
        });
    }
    
    detailedStats.innerHTML = detailedStatsData.map(stat => `
        <div class="detailed-stat">
            <span class="detailed-stat-label">${stat.label}:</span>
            <span class="detailed-stat-value">${stat.value}</span>
        </div>
    `).join('');
    
    // Handle KDR chart
    if (player.kdrHistory && player.kdrHistory.length > 0) {
        chartContainer.classList.remove('hidden');
        renderKdrChart(player.kdrHistory);
    } else {
        chartContainer.classList.add('hidden');
        if (kdrChart) {
            kdrChart.destroy();
            kdrChart = null;
        }
    }
    
    // Show modal
    modal.classList.add('open');
    document.body.classList.add('modal-open');
    
    // Set up copy UUID button
    document.getElementById('copyUuidBtn').onclick = function() {
        navigator.clipboard.writeText(player.uuid).then(() => {
            const originalHtml = this.innerHTML;
            this.innerHTML = '<i class="fas fa-check"></i>';
            setTimeout(() => {
                this.innerHTML = originalHtml;
            }, 2000);
        });
    };
}

// Render KDR chart
function renderKdrChart(kdrHistory) {
    const ctx = document.getElementById('kdrChart').getContext('2d');
    
    // Destroy existing chart
    if (kdrChart) {
        kdrChart.destroy();
    }
    
    const labels = kdrHistory.map((entry, index) => `Day ${index + 1}`);
    const data = kdrHistory.map(entry => entry.kdr || entry);
    
    kdrChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'KDR History',
                data: data,
                borderColor: '#4CAF50',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                pointBackgroundColor: '#4CAF50',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#4CAF50',
                    borderWidth: 1
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)'
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)'
                    }
                }
            }
        }
    });
}

// Calculate and animate totals
function calculateTotals() {
    const totals = {
        players: players.length,
        playtime: players.reduce((sum, player) => sum + (player.playtime || 0), 0),
        deaths: players.reduce((sum, player) => sum + (player.deaths || 0), 0),
        blocks: players.reduce((sum, player) => sum + (player.blocksMined || 0), 0),
        distance: players.reduce((sum, player) => sum + (player.distanceTraveled || 0), 0)
    };
    
    // Animate totals
    animateValue(totalPlayersStat, 0, totals.players, 4500);
    animateValue(totalPlaytime, 0, totals.playtime, 4500, formatTime);
    animateValue(totalDeaths, 0, totals.deaths, 4500);
    animateValue(totalBlocks, 0, totals.blocks, 4500);
    animateValue(totalDistance, 0, totals.distance, 4500, (val) => formatDistance(val));
}

// Animate counter values
function animateValue(element, start, end, duration, formatter = null) {
    const startTime = performance.now();
    const step = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        
        const value = Math.floor(start + (end - start) * easeOutQuart);
        
        if (formatter) {
            element.textContent = formatter(value);
        } else {
            element.textContent = value.toLocaleString();
        }
        
        if (progress < 1) {
            requestAnimationFrame(step);
        } else {
            if (formatter) {
                element.textContent = formatter(end);
            } else {
                element.textContent = end.toLocaleString();
            }
        }
    };
    
    requestAnimationFrame(step);
}

// Close modal function
function closeModal() {
    const modal = document.getElementById('playerModal');
    modal.classList.remove('open');
    document.body.classList.remove('modal-open');
}

// Initialize the application
function init() {
    // Load player data
    fetch('players.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            players = data;
            calculateTotals();
            renderLeaderboard();
        })
        .catch(error => {
            console.error('Error loading player data:', error);
            leaderboardList.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted)">Error loading player data</div>';
        });
    
    // Set up tab click handlers
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Update current stat and re-render
            currentStat = tab.getAttribute('data-stat');
            updateStatHeader();
            renderLeaderboard();
        });
    });
    
    // Set up modal close handlers
    document.getElementById('closeModal').addEventListener('click', closeModal);
    document.getElementById('playerModal').addEventListener('click', function(e) {
        if (e.target === this) closeModal();
    });
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeModal();
    });
    
    // Set up IP copy button
    document.getElementById('joinBtn').addEventListener('click', function() {
        navigator.clipboard.writeText('Nepaldmkurl.aternos.me:26225').then(() => {
            const originalText = this.innerHTML;
            this.innerHTML = '<i class="fas fa-check"></i> Copied!';
            setTimeout(() => {
                this.innerHTML = originalText;
            }, 2000);
        });
    });
    
    // Initialize stat header
    updateStatHeader();
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init);