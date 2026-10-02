/**
 * Apollo Ascent & Docking Simulator
 *
 * Physics Model:
 * - Gravity: Constant downward acceleration of 1.62 m/s² (scaled for gameplay).
 * - Inertia: Newtons First Law. Objects keep moving unless acted upon by a force.
 * - Thrust: Adds acceleration vectors to velocity. Main engine is stronger than RCS.
 * - Screen Wrap: Horizontal position wraps around 0-800 to simulate orbit.
 */


function safeStorageGet(key) {
    try { return (typeof localStorage !== 'undefined') ? safeStorageGet(key) : null; }
    catch (e) { return null; }
}
function safeStorageSet(key, value) {
    try { if (typeof localStorage !== 'undefined') safeStorageSet(key, value); }
    catch (e) {}
}
function safeStorageRemove(key) {
    try { if (typeof localStorage !== 'undefined') safeStorageRemove(key); }
    catch (e) {}
}

// ===== Configuration Constants =====

// Physics Constants (per-second values, multiplied by dt each frame)
const TARGET_FPS = 60;
const GRAVITY = 0.05 * TARGET_FPS;           // Downward acceleration per second
const MAIN_THRUST = 0.15 * TARGET_FPS;       // Up arrow force per second
const RCS_THRUST = 0.08 * TARGET_FPS;        // RCS force per second
const FUEL_MAIN_COST = 0.2 * TARGET_FPS;     // Fuel cost per second for main engine
const FUEL_RCS_COST = 0.05 * TARGET_FPS;     // Fuel cost per second for RCS

// Canvas & World Constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const GROUND_Y = 550;         // Surface level
const CSM_ORBIT_Y = 100;      // Height of CSM orbit
const CSM_SPEED = 0.7;        // Orbital speed of CSM (pixels per frame at 60fps, same unit as lm velocity)

// Threshold Constants
const DOCKING_VEL_THRESHOLD_X = 1.5;    // Max horizontal relative velocity for successful docking (increased)
const DOCKING_VEL_THRESHOLD_Y = 1.5;    // Max vertical relative velocity for successful docking (increased)
const CRASH_VEL_THRESHOLD = 2.0;        // Vertical velocity threshold for crash on landing
const FUEL_WARNING_THRESHOLD = 20;      // Fuel percentage to display warning color
const FUEL_CRITICAL_THRESHOLD = 10;     // Fuel percentage considered critical
const LANDING_FRICTION = 0.9;           // Friction multiplier on landing
const FUEL_DEPLETION_ALTITUDE_THRESHOLD = 50;  // Min altitude to trigger fuel depletion failure

// Rendering Constants
const PARTICLE_COUNT_PER_THRUST = 3;    // Number of particles spawned per thrust frame
const PARTICLE_MIN_LIFE = 20;           // Minimum particle lifespan in frames
const PARTICLE_MAX_LIFE = 40;           // Maximum particle lifespan in frames
const PARTICLE_ALPHA_DIVISOR = 30;      // Alpha calculation divisor for particle fade
const STAR_COUNT = 100;                 // Number of background stars
const LM_GHOST_THRESHOLD = 30;          // Distance from edge to show ghost LM (screen wrap)
const DOCKING_AIDS_RANGE = 400;         // Distance at which docking aids become visible
const TRAJECTORY_PREDICTION_STEPS = 60; // Number of frames to predict trajectory

// ===== Game State =====
// Note: Game state is managed locally within createGameController().
// These module-level variables exist only as default parameter values for createLM/createCSM.
const particles = [];

// ===== Scoring System =====
function calculateScore(fuelRemaining, timeElapsed, relVx, relVy) {
    const fuelScore = Math.floor(fuelRemaining * 10);  // Max 1000
    const timeBonus = Math.max(0, 500 - Math.floor(timeElapsed / 100)); // Faster = more points
    const precisionBonus = Math.floor((2 - relVx - relVy) * 250); // Max 500 for perfect approach
    return Math.max(0, fuelScore + timeBonus + precisionBonus);
}

// ===== Achievement System =====
const ACHIEVEMENTS = {
    first_dock: {
        id: 'first_dock',
        name: 'First Contact',
        description: 'Complete your first successful docking',
        icon: '🚀',
        check: (stats) => stats.totalDockings >= 1
    },
    perfect_dock: {
        id: 'perfect_dock',
        name: 'Perfect Docking',
        description: 'Dock with relative velocity under 0.5 m/s',
        icon: '🎯',
        check: (stats) => stats.relVx < 0.5 && stats.relVy < 0.5
    },
    fuel_miser: {
        id: 'fuel_miser',
        name: 'Fuel Miser',
        description: 'Complete docking with 60%+ fuel remaining',
        icon: '⛽',
        check: (stats) => stats.fuelRemaining >= 60
    },
    speed_runner: {
        id: 'speed_runner',
        name: 'Speed Runner',
        description: 'Dock in under 30 seconds',
        icon: '⚡',
        check: (stats) => stats.timeElapsed < 30000
    },
    close_call: {
        id: 'close_call',
        name: 'Close Call',
        description: 'Dock with less than 5% fuel remaining',
        icon: '😰',
        check: (stats) => stats.fuelRemaining < 5 && stats.fuelRemaining > 0
    },
    veteran: {
        id: 'veteran',
        name: 'Veteran Pilot',
        description: 'Complete 5 successful dockings',
        icon: '🎖️',
        check: (stats) => stats.totalDockings >= 5
    },
    ace: {
        id: 'ace',
        name: 'Ace Pilot',
        description: 'Complete 10 successful dockings',
        icon: '👨‍🚀',
        check: (stats) => stats.totalDockings >= 10
    },
    high_scorer: {
        id: 'high_scorer',
        name: 'High Scorer',
        description: 'Achieve a score of 1500 or higher',
        icon: '🏆',
        check: (stats) => stats.score >= 1500
    }
};

// Load achievements from localStorage
function loadAchievements() {
    const defaults = {
        unlocked: {},
        totalDockings: 0,
        bestScore: 0,
        bestTime: Infinity
    };
    if (typeof localStorage === 'undefined') {
        return defaults;
    }
    try {
        const saved = safeStorageGet('apolloAchievements');
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (e) {
        // Corrupt data — clear it and start fresh
        safeStorageRemove('apolloAchievements');
    }
    return defaults;
}

// Save achievements to localStorage
function saveAchievements(data) {
    if (typeof localStorage !== 'undefined') {
        safeStorageSet('apolloAchievements', JSON.stringify(data));
    }
}

// Achievement state is managed locally within createGameController().
// checkAchievements() accepts achievement data as a parameter.

// Check and unlock achievements
function checkAchievements(stats, currentAchievementData) {
    const newlyUnlocked = [];

    for (const key in ACHIEVEMENTS) {
        const achievement = ACHIEVEMENTS[key];
        if (!currentAchievementData.unlocked[achievement.id] && achievement.check(stats)) {
            currentAchievementData.unlocked[achievement.id] = {
                unlockedAt: Date.now()
            };
            newlyUnlocked.push(achievement);
        }
    }

    if (newlyUnlocked.length > 0) {
        saveAchievements(currentAchievementData);
    }

    return newlyUnlocked;
}

// ===== Campaign System =====

const CAMPAIGN_VERSION = 1;
const CAMPAIGN_MAX_LOG_ENTRIES = 15;
const CAMPAIGN_MIN_FUEL_BUDGET = 40;
const CAMPAIGN_MAX_SUPPLIES = 5;
const CAMPAIGN_INTEGRITY_PER_SUPPLY = 5;

const CAMPAIGN_MODIFIERS = [
    {
        id: 'normal',
        name: 'Standard Conditions',
        description: 'No special conditions today.',
        effects: {}
    },
    {
        id: 'thin-margins',
        name: 'Thin Margins',
        description: 'Docking tolerances are tighter today.',
        effects: { dockingThresholdScale: 0.75 }
    },
    {
        id: 'low-reserves',
        name: 'Low Reserves',
        description: 'Fuel allocation reduced for this mission.',
        effects: { fuelBudgetScale: 0.8 }
    },
    {
        id: 'drift-watch',
        name: 'Drift Watch',
        description: 'CSM orbit is faster today.',
        effects: { csmSpeedScale: 1.2 }
    },
    {
        id: 'cold-systems',
        name: 'Cold Systems',
        description: 'RCS thrusters are sluggish today.',
        effects: { rcsScale: 0.75 }
    },
    {
        id: 'stable-window',
        name: 'Stable Window',
        description: 'Conditions are favorable. A good day to recover.',
        effects: { dockingThresholdScale: 1.15 }
    }
];

function createDefaultCampaign() {
    return {
        version: CAMPAIGN_VERSION,
        day: 1,
        integrity: 100,
        supplies: 3,
        fuelBudget: 100,
        streak: 0,
        lastOutcome: null,
        activeModifier: null,
        missionLog: []
    };
}

function loadCampaign() {
    const defaults = createDefaultCampaign();
    if (typeof localStorage === 'undefined') return defaults;
    try {
        const saved = safeStorageGet('apolloCampaign');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed && parsed.version === CAMPAIGN_VERSION) {
                return parsed;
            }
        }
    } catch (e) {
        safeStorageRemove('apolloCampaign');
    }
    return defaults;
}

function saveCampaign(campaign) {
    if (typeof localStorage !== 'undefined') {
        safeStorageSet('apolloCampaign', JSON.stringify(campaign));
    }
}

function resetCampaign() {
    if (typeof localStorage !== 'undefined') {
        safeStorageRemove('apolloCampaign');
    }
    return createDefaultCampaign();
}

function selectCampaignModifier(campaign) {
    if (campaign.lastOutcome === 'severe_failure') {
        return CAMPAIGN_MODIFIERS.find(m => m.id === 'stable-window');
    }
    if (campaign.day <= 3) {
        return CAMPAIGN_MODIFIERS.find(m => m.id === 'normal');
    }
    const challenging = CAMPAIGN_MODIFIERS.filter(m => m.id !== 'stable-window' && m.id !== 'normal');
    const index = (campaign.day * 7 + campaign.streak * 3) % challenging.length;
    return challenging[index];
}

function createMissionConfigFromCampaign(campaign) {
    const modifier = campaign.activeModifier || { effects: {} };
    const effects = modifier.effects || {};

    // Integrity scales docking tolerance: 100 → normal, 0 → 70% of normal
    const integrityScale = 0.7 + 0.3 * (campaign.integrity / 100);

    const dockingThresholdScale = (effects.dockingThresholdScale || 1) * integrityScale;
    const fuelBudgetScale = effects.fuelBudgetScale || 1;
    const csmSpeedScale = effects.csmSpeedScale || 1;
    const rcsScale = effects.rcsScale || 1;

    return {
        startingFuel: Math.max(CAMPAIGN_MIN_FUEL_BUDGET, campaign.fuelBudget * fuelBudgetScale),
        dockingThresholdX: DOCKING_VEL_THRESHOLD_X * dockingThresholdScale,
        dockingThresholdY: DOCKING_VEL_THRESHOLD_Y * dockingThresholdScale,
        csmSpeed: CSM_SPEED * csmSpeedScale,
        rcsScale: rcsScale
    };
}

function resolveCampaignDay(campaign, missionOutcome) {
    const updated = Object.assign({}, campaign);
    const logEntry = {
        day: campaign.day,
        outcome: null,
        modifierId: campaign.activeModifier ? campaign.activeModifier.id : 'normal',
        fuelRemaining: Math.floor(missionOutcome.fuelRemaining || 0),
        integrityDelta: 0,
        fuelBudgetDelta: 0,
        suppliesDelta: 0
    };

    if (missionOutcome.success) {
        logEntry.outcome = 'success';
        logEntry.integrityDelta = Math.min(5, 100 - campaign.integrity);
        logEntry.fuelBudgetDelta = Math.min(5, 100 - campaign.fuelBudget);
        logEntry.suppliesDelta = campaign.supplies < CAMPAIGN_MAX_SUPPLIES ? 1 : 0;

        updated.integrity = Math.min(100, campaign.integrity + logEntry.integrityDelta);
        updated.fuelBudget = Math.min(100, campaign.fuelBudget + logEntry.fuelBudgetDelta);
        updated.supplies = Math.min(CAMPAIGN_MAX_SUPPLIES, campaign.supplies + logEntry.suppliesDelta);
        updated.streak = campaign.streak + 1;
        updated.lastOutcome = 'success';
    } else {
        const isSevere = missionOutcome.type === 'crashed' || missionOutcome.type === 'fuel_depleted';

        if (isSevere) {
            logEntry.outcome = 'severe_failure';
            logEntry.integrityDelta = -25;
            logEntry.fuelBudgetDelta = -20;
            logEntry.suppliesDelta = campaign.supplies > 0 ? -1 : 0;
        } else {
            logEntry.outcome = 'rough_failure';
            logEntry.integrityDelta = -15;
            logEntry.fuelBudgetDelta = -10;
            logEntry.suppliesDelta = campaign.supplies > 0 ? -1 : 0;
        }

        updated.integrity = Math.max(0, campaign.integrity + logEntry.integrityDelta);
        updated.fuelBudget = Math.max(CAMPAIGN_MIN_FUEL_BUDGET, campaign.fuelBudget + logEntry.fuelBudgetDelta);
        updated.supplies = Math.max(0, campaign.supplies + logEntry.suppliesDelta);
        updated.streak = 0;
        updated.lastOutcome = logEntry.outcome;
    }

    // Auto-repair from supplies between days
    if (updated.supplies > 0 && updated.integrity < 100) {
        const repairAmount = Math.min(CAMPAIGN_INTEGRITY_PER_SUPPLY, 100 - updated.integrity);
        updated.integrity += repairAmount;
        updated.supplies -= 1;
        logEntry.repairDelta = repairAmount;
    }

    // Advance day
    updated.day = campaign.day + 1;

    // Select modifier for next day
    updated.activeModifier = selectCampaignModifier(updated);

    // Append log (after repair so logEntry includes repairDelta)
    updated.missionLog = appendMissionLog(campaign.missionLog, logEntry);

    return { campaign: updated, logEntry };
}

function appendMissionLog(log, entry) {
    const newLog = (log || []).slice();
    newLog.push(entry);
    if (newLog.length > CAMPAIGN_MAX_LOG_ENTRIES) {
        return newLog.slice(newLog.length - CAMPAIGN_MAX_LOG_ENTRIES);
    }
    return newLog;
}

// ===== Particle System =====
class Particle {
    constructor(x, y, vx, vy, life, color) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.life = life;
        this.color = color;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.life / PARTICLE_ALPHA_DIVISOR;
        ctx.fillRect(this.x, this.y, 2, 2);
        ctx.globalAlpha = 1.0;
    }
}

function spawnExhaust(x, y, direction, particleArray = particles) {
    // direction: 'down' (main), 'up' (rcs-down), 'left' (rcs-right), 'right' (rcs-left)
    for(let i=0; i<PARTICLE_COUNT_PER_THRUST; i++) {
        let vx = (Math.random() - 0.5) * 1;
        let vy = (Math.random() - 0.5) * 1;
        let color = '#ffaa00'; // orange

        if (direction === 'down') {
            vy += 2;
            color = '#ffcc00'; // brighter for main
        } else if (direction === 'up') vy -= 1;
        else if (direction === 'left') vx -= 1;
        else if (direction === 'right') vx += 1;

        particleArray.push(new Particle(x, y, vx, vy, PARTICLE_MIN_LIFE + Math.random()*(PARTICLE_MAX_LIFE-PARTICLE_MIN_LIFE), color));
    }
}

// ===== Physics Utilities =====
function calculateDistance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

function calculateRelativeVelocityX(lmVx) {
    return lmVx - CSM_SPEED;
}

function calculateRelativeVelocityY(lmVy) {
    return Math.abs(lmVy);
}

function calculateAltitude(lmY) {
    return GROUND_Y - (lmY + 15);
}

function applyScreenWrap(x) {
    if (x > CANVAS_WIDTH) return x - CANVAS_WIDTH;
    if (x < 0) return x + CANVAS_WIDTH;
    return x;
}

// ===== Get approach status color based on relative velocity =====
function getApproachStatus(relVx, relVy, missionConfig) {
    const threshX = missionConfig ? missionConfig.dockingThresholdX : DOCKING_VEL_THRESHOLD_X;
    const threshY = missionConfig ? missionConfig.dockingThresholdY : DOCKING_VEL_THRESHOLD_Y;
    // Green: Both velocities safe for docking
    if (relVx < 0.5 && relVy < 0.5) return '#44ff44'; // Green
    // Yellow: At least one velocity in caution range
    if (relVx < threshX && relVy < threshY) return '#ffff44'; // Yellow
    // Red: Too fast for docking
    return '#ff4444'; // Red
}

// ===== LM Factory =====
function createLM(initialState = {}) {
    const rcsScale = (initialState.rcsScale != null ? initialState.rcsScale : 1);
    return {
        x: (initialState.x != null ? initialState.x : CANVAS_WIDTH / 2),
        y: (initialState.y != null ? initialState.y : GROUND_Y - 30),
        vx: (initialState.vx != null ? initialState.vx : 0),
        vy: (initialState.vy != null ? initialState.vy : 0),
        width: 30,
        height: 30,
        fuel: (initialState.fuel != null ? initialState.fuel : 100),

        update: function(currentKeys = {}, currentGameState = 'playing', callbacks = {}, dt = 1 / TARGET_FPS) {
            if (currentGameState !== 'playing') return;

            // Gravity
            this.vy += GRAVITY * dt;

            // Apply Thrust
            if (this.fuel > 0) {
                // Main Engine (Up Arrow -> Force Up)
                if (currentKeys['ArrowUp']) {
                    this.vy -= MAIN_THRUST * dt;
                    this.fuel -= FUEL_MAIN_COST * dt;
                    if (callbacks.onMainThrust) callbacks.onMainThrust(this.x, this.y + this.height/2);
                }
                // RCS Down (Down Arrow -> Force Down)
                if (currentKeys['ArrowDown']) {
                    this.vy += RCS_THRUST * rcsScale * dt;
                    this.fuel -= FUEL_RCS_COST * dt;
                    if (callbacks.onRcsThrust) callbacks.onRcsThrust(this.x, this.y - this.height/2, 'up');
                }
                // RCS Left (Left Arrow -> Force Left)
                if (currentKeys['ArrowLeft']) {
                    this.vx -= RCS_THRUST * rcsScale * dt;
                    this.fuel -= FUEL_RCS_COST * dt;
                    if (callbacks.onRcsThrust) callbacks.onRcsThrust(this.x + this.width/2, this.y, 'right');
                }
                // RCS Right (Right Arrow -> Force Right)
                if (currentKeys['ArrowRight']) {
                    this.vx += RCS_THRUST * rcsScale * dt;
                    this.fuel -= FUEL_RCS_COST * dt;
                    if (callbacks.onRcsThrust) callbacks.onRcsThrust(this.x - this.width/2, this.y, 'left');
                }
            }

            // Clamp fuel
            if (this.fuel < 0) this.fuel = 0;

            // Low fuel alarm
            if (this.fuel > 0 && this.fuel < FUEL_WARNING_THRESHOLD) {
                if (callbacks.onLowFuel) callbacks.onLowFuel();
            }

            // Apply movement
            this.x += this.vx * dt * TARGET_FPS;
            this.y += this.vy * dt * TARGET_FPS;

            // Screen Wrap
            this.x = applyScreenWrap(this.x);

            // Ground Collision
            if (this.y + this.height/2 >= GROUND_Y) {
                // Check impact speed
                if (this.vy > CRASH_VEL_THRESHOLD) {
                    if (callbacks.onCrash) callbacks.onCrash("Crashed into lunar surface!");
                    return 'crashed';
                } else {
                    // Landed safely (or waiting to launch)
                    this.y = GROUND_Y - this.height/2;
                    this.vy = 0;
                    this.vx *= LANDING_FRICTION;
                    return 'landed';
                }
            }

            // Fuel Depletion Check
            if (this.fuel <= 0) {
                const altitude = GROUND_Y - (this.y + 15);
                if (altitude > FUEL_DEPLETION_ALTITUDE_THRESHOLD) {
                    if (callbacks.onFuelDepleted) callbacks.onFuelDepleted();
                    return 'fuel_depleted';
                }
            }

            return 'flying';
        },

        draw: function(ctx) {
            drawLMAtPosition(ctx, this.x, this.y);
        }
    };
}

// ===== CSM Factory =====
function createCSM(initialState = {}) {
    return {
        x: (initialState.x != null ? initialState.x : Math.random() * CANVAS_WIDTH),
        y: (initialState.y != null ? initialState.y : CSM_ORBIT_Y),
        width: 50,
        height: 20,
        speed: (initialState.speed != null ? initialState.speed : CSM_SPEED),

        update: function(dt = 1 / TARGET_FPS) {
            this.x += this.speed * dt * TARGET_FPS;
            this.x = applyScreenWrap(this.x);
        },

        draw: function(ctx) {
            drawCSMAtPosition(ctx, this.x, this.y);
        }
    };
}

// ===== Collision Detection =====
function checkDockingCollision(lm, csm, missionConfig) {
    // LM bounds
    const lmLeft = lm.x - 15;
    const lmRight = lm.x + 15;
    const lmTop = lm.y - 15;
    const lmBottom = lm.y + 15;

    // CSM docking port zone (top of CSM, centered horizontally)
    const dockingZoneLeft = csm.x - 15;
    const dockingZoneRight = csm.x + 15;
    const dockingZoneTop = csm.y - 25;
    const dockingZoneBottom = csm.y - 5;

    // Check if LM is in docking zone (approaching from below)
    const inDockingZone = (lmRight > dockingZoneLeft && lmLeft < dockingZoneRight &&
                          lmBottom > dockingZoneTop && lmTop < dockingZoneBottom);

    // General CSM collision bounds (for crash detection)
    const csmLeft = csm.x - 20;
    const csmRight = csm.x + 25;
    const csmTop = csm.y - 10;
    const csmBottom = csm.y + 10;

    const generalCollision = (lmRight > csmLeft && lmLeft < csmRight &&
                             lmBottom > csmTop && lmTop < csmBottom);

    if (inDockingZone) {
        const csmSpeed = (csm.speed != null ? csm.speed : CSM_SPEED);
        const threshX = missionConfig ? missionConfig.dockingThresholdX : DOCKING_VEL_THRESHOLD_X;
        const threshY = missionConfig ? missionConfig.dockingThresholdY : DOCKING_VEL_THRESHOLD_Y;
        const relVx = Math.abs(lm.vx - csmSpeed);
        const relVy = Math.abs(lm.vy);

        if (relVx < threshX && relVy < threshY) {
            return { type: 'docking_success', relVx, relVy };
        } else {
            return { type: 'docking_failed_velocity', relVx, relVy };
        }
    } else if (generalCollision) {
        return { type: 'collision_wrong_angle' };
    }

    return { type: 'none' };
}

// ===== Rendering Functions =====
function drawLMAtPosition(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);

    // Main white pressure body
    ctx.fillStyle = '#f5f7fa';
    ctx.strokeStyle = '#c8cdd5';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-16, 13);
    ctx.lineTo(16, 13);
    ctx.lineTo(13, -7);
    ctx.lineTo(7, -16);
    ctx.lineTo(-7, -16);
    ctx.lineTo(-13, -7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Moscow Polytech red engineering band
    ctx.fillStyle = '#e51d2a';
    ctx.fillRect(-15, 4, 30, 6);

    // Window
    ctx.fillStyle = '#121722';
    ctx.beginPath();
    ctx.arc(0, -5, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5a6575';
    ctx.stroke();

    // Landing / RCS legs
    ctx.strokeStyle = '#b8bec8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, 12); ctx.lineTo(-18, 21); ctx.lineTo(-23, 21);
    ctx.moveTo(10, 12); ctx.lineTo(18, 21); ctx.lineTo(23, 21);
    ctx.stroke();

    // MP mark
    ctx.fillStyle = '#11141b';
    ctx.font = 'bold 7px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('MP', 0, 2);

    ctx.restore();
}

function drawCSMAtPosition(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);

    // Solar arrays
    ctx.fillStyle = '#183a66';
    ctx.strokeStyle = '#6fa1d2';
    ctx.lineWidth = 1;
    ctx.fillRect(-62, -13, 34, 26);
    ctx.strokeRect(-62, -13, 34, 26);
    ctx.fillRect(28, -13, 34, 26);
    ctx.strokeRect(28, -13, 34, 26);
    ctx.strokeStyle = 'rgba(255,255,255,.22)';
    for (var sx=-56; sx<=-34; sx+=7) { ctx.beginPath();ctx.moveTo(sx,-12);ctx.lineTo(sx,12);ctx.stroke(); }
    for (var sx2=34; sx2<=56; sx2+=7) { ctx.beginPath();ctx.moveTo(sx2,-12);ctx.lineTo(sx2,12);ctx.stroke(); }

    // Central orbital module
    ctx.fillStyle = '#eef1f5';
    ctx.strokeStyle = '#aeb5c0';
    ctx.lineWidth = 1.5;
    ctx.fillRect(-27, -12, 54, 24);
    ctx.strokeRect(-27, -12, 54, 24);

    ctx.fillStyle = '#e51d2a';
    ctx.fillRect(-27, 4, 54, 5);

    // Docking port below module (target approached from below)
    ctx.fillStyle = '#7c8591';
    ctx.fillRect(-7, 12, 14, 6);
    ctx.fillStyle = '#161922';
    ctx.fillRect(-4, 16, 8, 4);

    ctx.fillStyle = '#151820';
    ctx.font = 'bold 7px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('MP ORBIT', 0, -1);

    ctx.restore();
}

    // ===== Celebration Effects =====
function spawnCelebration(x, y, targetArray = celebrationParticles) {
    const colors = ['#e51d2a', '#ffffff', '#ff6b74', '#d7dce4', '#44ff88'];
    for (let i = 0; i < 50; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 4;
        targetArray.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 60 + Math.random() * 40,
            color: colors[Math.floor(Math.random() * colors.length)],
            size: 2 + Math.random() * 3
        });
    }
}

function updateCelebrationParticles(targetArray = celebrationParticles) {
    for (let i = targetArray.length - 1; i >= 0; i--) {
        const p = targetArray[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05; // Gravity
        p.life--;
        if (p.life <= 0) targetArray.splice(i, 1);
    }
}

// ===== Audio System (Web Audio API) =====
let audioCtx = null;

function initAudio() {
    if (typeof window === 'undefined') return null;
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
}

function getAudioContext() {
    return audioCtx;
}

function setAudioContext(ctx) {
    audioCtx = ctx;
}

function playSound(type) {
    try {
        const ctx = initAudio();
        if (!ctx) return;
        if (ctx.state === 'suspended') ctx.resume();

        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        const now = ctx.currentTime;

        switch(type) {
            case 'thrust':
                oscillator.type = 'sawtooth';
                oscillator.frequency.setValueAtTime(80, now);
                oscillator.frequency.exponentialRampToValueAtTime(60, now + 0.1);
                gainNode.gain.setValueAtTime(0.08, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                oscillator.start(now);
                oscillator.stop(now + 0.1);
                break;

            case 'rcs':
                oscillator.type = 'square';
                oscillator.frequency.setValueAtTime(200, now);
                gainNode.gain.setValueAtTime(0.03, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
                oscillator.start(now);
                oscillator.stop(now + 0.05);
                break;

            case 'dock_success':
                // Play a nice chord
                [523, 659, 784].forEach((freq, i) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, now);
                    gain.gain.setValueAtTime(0.15, now + i * 0.1);
                    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8 + i * 0.1);
                    osc.start(now + i * 0.1);
                    osc.stop(now + 1 + i * 0.1);
                });
                return;

            case 'collision':
                oscillator.type = 'sawtooth';
                oscillator.frequency.setValueAtTime(150, now);
                oscillator.frequency.exponentialRampToValueAtTime(30, now + 0.3);
                gainNode.gain.setValueAtTime(0.3, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                oscillator.start(now);
                oscillator.stop(now + 0.3);
                break;

            case 'alarm':
                oscillator.type = 'square';
                oscillator.frequency.setValueAtTime(440, now);
                oscillator.frequency.setValueAtTime(880, now + 0.15);
                oscillator.frequency.setValueAtTime(440, now + 0.3);
                gainNode.gain.setValueAtTime(0.1, now);
                gainNode.gain.setValueAtTime(0.1, now + 0.3);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
                oscillator.start(now);
                oscillator.stop(now + 0.45);
                break;
        }
    } catch(e) {
        // Audio not supported, fail silently
    }
}

function playAchievementSound() {
    try {
        const ctx = initAudio();
        if (!ctx) return;
        if (ctx.state === 'suspended') ctx.resume();

        const now = ctx.currentTime;

        // Play ascending arpeggio
        [880, 1100, 1320, 1760].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + i * 0.08);
            gain.gain.setValueAtTime(0.1, now + i * 0.08);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3 + i * 0.08);
            osc.start(now + i * 0.08);
            osc.stop(now + 0.4 + i * 0.08);
        });
    } catch(e) {
        // Audio not supported
    }
}

// Sound throttling
let lastThrustSound = 0;
let lastRcsSound = 0;
let lastAlarmSound = 0;

function playThrustSound() {
    const now = Date.now();
    if (now - lastThrustSound > 100) {
        playSound('thrust');
        lastThrustSound = now;
    }
}

function playRcsSound() {
    const now = Date.now();
    if (now - lastRcsSound > 80) {
        playSound('rcs');
        lastRcsSound = now;
    }
}

function playAlarmSound() {
    const now = Date.now();
    if (now - lastAlarmSound > 500) {
        playSound('alarm');
        lastAlarmSound = now;
    }
}

// ===== Game Controller =====
function createGameController(options = {}) {
    // DOM elements - initialized lazily
    let canvas, ctx;
    let uiAltitude, uiVVel, uiHVel, uiFuel;
    let uiDistanceCSM, uiRelVx, uiRelVy, uiVxHint, uiVyHint;
    let msgOverlay, msgTitle, msgDetail;
    let pauseOverlay, tutorialOverlay, trophyOverlay;
    let touchControls, touchButtons;
    let achievementNotification, achievementName, achievementDesc;
    let trophyGrid, trophyStats;
    let campaignStartOverlay, campaignDayNumber, campaignCondition;
    let campaignFuelBudget, campaignSupplies, campaignModifier;

    // Campaign state
    let localCampaign = loadCampaign();
    let localMissionConfig = null;
    let localOutcomeType = null;

    // Game objects
    let lm = createLM();
    let csm = createCSM();
    let starList = [];
    let localGameState = 'campaign_start';
    let localKeys = {};
    let localGameStartTime = Date.now();
    let localScreenShake = 0;
    let localParticles = [];
    let localCelebrationParticles = [];
    let localAchievementData = loadAchievements();
    let localPendingNotifications = [];
    let localNotificationTimeout = null;

    function initDOM() {
        if (typeof document === 'undefined') return false;

        canvas = document.getElementById('gameCanvas');
        if (!canvas) return false;
        ctx = canvas.getContext('2d');

        uiAltitude = document.getElementById('altitude');
        uiVVel = document.getElementById('v-vel');
        uiHVel = document.getElementById('h-vel');
        uiFuel = document.getElementById('fuel');
        uiDistanceCSM = document.getElementById('distance-csm');
        uiRelVx = document.getElementById('rel-vx');
        uiRelVy = document.getElementById('rel-vy');
        uiVxHint = document.getElementById('vx-hint');
        uiVyHint = document.getElementById('vy-hint');
        msgOverlay = document.getElementById('message-overlay');
        msgTitle = document.getElementById('msg-title');
        msgDetail = document.getElementById('msg-detail');
        pauseOverlay = document.getElementById('pause-overlay');
        tutorialOverlay = document.getElementById('tutorial-overlay');
        trophyOverlay = document.getElementById('trophy-overlay');
        touchControls = document.getElementById('touch-controls');
        touchButtons = Array.prototype.slice.call(document.querySelectorAll('.touch-btn'));
        achievementNotification = document.getElementById('achievement-notification');
        achievementName = document.getElementById('achievement-name');
        achievementDesc = document.getElementById('achievement-desc');
        trophyGrid = document.getElementById('trophy-grid');
        trophyStats = document.getElementById('trophy-stats');
        campaignStartOverlay = document.getElementById('campaign-start-overlay');
        campaignDayNumber = document.getElementById('campaign-day-number');
        campaignCondition = document.getElementById('campaign-condition');
        campaignFuelBudget = document.getElementById('campaign-fuel-budget');
        campaignSupplies = document.getElementById('campaign-supplies');
        campaignModifier = document.getElementById('campaign-modifier');

        // Generate stars with twinkle properties
        for(let i=0; i<STAR_COUNT; i++) {
            starList.push({
                x: Math.random() * CANVAS_WIDTH,
                y: Math.random() * CANVAS_HEIGHT,
                size: Math.random() * 2,
                phase: Math.random() * Math.PI * 2,
                speed: 0.5 + Math.random() * 2
            });
        }

        return true;
    }

    function initInputHandlers() {
        if (typeof window === 'undefined') return;

        window.addEventListener('keydown', (e) => {
            localKeys[e.key] = true;

            // Dismiss tutorial on any key
            if (tutorialOverlay && tutorialOverlay.style.display === 'block') {
                tutorialOverlay.style.display = 'none';
                safeStorageSet('apolloTutorialShown', 'true');
                e.preventDefault();
                return;
            }

            // Toggle help with ?
            if (e.key === '?' && localGameState === 'playing') {
                toggleHelp();
                e.preventDefault();
                return;
            }

            // Toggle trophy room with T
            if ((e.key === 't' || e.key === 'T') && localGameState !== 'won' && localGameState !== 'lost') {
                if (tutorialOverlay) tutorialOverlay.style.display = 'none';
                if (pauseOverlay) pauseOverlay.style.display = 'none';
                toggleTrophyRoom();
                e.preventDefault();
                return;
            }

            // Pause/Resume with P or ESC
            if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && (localGameState === 'playing' || localGameState === 'paused')) {
                if (trophyOverlay && trophyOverlay.style.display === 'block') {
                    toggleTrophyRoom();
                    e.preventDefault();
                    return;
                }
                togglePause();
                e.preventDefault();
            }

            // Restart with SPACE
            if (e.code === 'Space') {
                if (localGameState === 'campaign_start') {
                    startDay();
                    e.preventDefault();
                } else if (localGameState === 'won' || localGameState === 'lost') {
                    advanceToNextDay();
                    e.preventDefault();
                }
            }
        });

        window.addEventListener('keyup', (e) => {
            localKeys[e.key] = false;
        });

        // New Campaign event from overlay button
        if (typeof document !== 'undefined') {
            document.addEventListener('newCampaign', () => {
                localCampaign = resetCampaign();
                localMissionConfig = null;
                showCampaignStart();
            });
        }

        // Touch controls
        initTouchControls();
    }

    function initTouchControls() {
        if (typeof window === 'undefined' || !touchControls) return;

        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        if (isTouchDevice) {
            touchControls.style.display = 'block';

            touchButtons.forEach(button => {
                const key = button.getAttribute('data-key');

                button.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    localKeys[key] = true;
                });

                button.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    localKeys[key] = false;
                });

                button.addEventListener('touchcancel', (e) => {
                    e.preventDefault();
                    localKeys[key] = false;
                });
            });
        }
    }

    function showAchievementNotification(achievement) {
        if (!achievementNotification || !achievementName || !achievementDesc) return;

        achievementName.textContent = `${achievement.icon} ${achievement.name}`;
        achievementDesc.textContent = achievement.description;

        achievementNotification.style.display = 'block';
        achievementNotification.style.animation = 'none';
        achievementNotification.offsetHeight;
        achievementNotification.style.animation = 'slideIn 0.5s ease-out, glow 1.5s ease-in-out infinite';

        playAchievementSound();

        if (localNotificationTimeout) clearTimeout(localNotificationTimeout);
        localNotificationTimeout = setTimeout(() => {
            achievementNotification.style.display = 'none';
            if (localPendingNotifications.length > 0) {
                const next = localPendingNotifications.shift();
                setTimeout(() => showAchievementNotification(next), 300);
            }
        }, 3000);
    }

    function queueAchievementNotification(achievement) {
        if (!achievementNotification) return;
        if (achievementNotification.style.display === 'block') {
            localPendingNotifications.push(achievement);
        } else {
            showAchievementNotification(achievement);
        }
    }

    function localCheckAchievements(stats) {
        const newlyUnlocked = [];

        for (const key in ACHIEVEMENTS) {
            const achievement = ACHIEVEMENTS[key];
            if (!localAchievementData.unlocked[achievement.id] && achievement.check(stats)) {
                localAchievementData.unlocked[achievement.id] = {
                    unlockedAt: Date.now()
                };
                newlyUnlocked.push(achievement);
            }
        }

        if (newlyUnlocked.length > 0) {
            saveAchievements(localAchievementData);
            newlyUnlocked.forEach(a => queueAchievementNotification(a));
        }

        return newlyUnlocked;
    }

    function renderTrophyRoom() {
        if (!trophyGrid || !trophyStats) return;

        trophyGrid.innerHTML = '';

        for (const key in ACHIEVEMENTS) {
            const achievement = ACHIEVEMENTS[key];
            const isUnlocked = localAchievementData.unlocked[achievement.id];

            const item = document.createElement('div');
            item.className = `trophy-item ${isUnlocked ? 'unlocked' : 'locked'}`;

            item.innerHTML = `
                <div class="trophy-icon">${isUnlocked ? achievement.icon : '🔒'}</div>
                <div class="trophy-name">${isUnlocked ? achievement.name : '???'}</div>
                <div class="trophy-description">${isUnlocked ? achievement.description : 'Keep playing to unlock'}</div>
            `;

            trophyGrid.appendChild(item);
        }

        const totalAchievements = Object.keys(ACHIEVEMENTS).length;
        const unlockedCount = Object.keys(localAchievementData.unlocked).length;
        const percentage = Math.floor((unlockedCount / totalAchievements) * 100);

        trophyStats.innerHTML = `
            ${unlockedCount}/${totalAchievements} Achievements (${percentage}%)<br>
            Total Dockings: ${localAchievementData.totalDockings} | Best Score: ${localAchievementData.bestScore}
        `;
    }

    function toggleTrophyRoom() {
        if (!trophyOverlay) return;
        if (trophyOverlay.style.display === 'block') {
            trophyOverlay.style.display = 'none';
            if (localGameState === 'paused') {
                localGameState = 'playing';
            }
        } else {
            renderTrophyRoom();
            trophyOverlay.style.display = 'block';
            if (localGameState === 'playing') {
                localGameState = 'paused';
            }
        }
    }

    function togglePause() {
        if (localGameState === 'playing') {
            localGameState = 'paused';
            if (pauseOverlay) pauseOverlay.style.display = 'block';
        } else if (localGameState === 'paused') {
            localGameState = 'playing';
            if (pauseOverlay) pauseOverlay.style.display = 'none';
        }
    }

    function toggleHelp() {
        if (!tutorialOverlay) return;
        if (tutorialOverlay.style.display === 'block') {
            tutorialOverlay.style.display = 'none';
            if (localGameState === 'paused') {
                localGameState = 'playing';
            }
        } else {
            tutorialOverlay.style.display = 'block';
            if (localGameState === 'playing') {
                localGameState = 'paused';
            }
        }
    }

    function showTutorialIfFirstVisit() {
        if (typeof localStorage === 'undefined' || !tutorialOverlay) return;
        const tutorialShown = safeStorageGet('apolloTutorialShown');
        if (!tutorialShown) {
            tutorialOverlay.style.display = 'block';
        }
    }

    function prepareCampaignDay() {
        localMissionConfig = {
            startingFuel: 100,
            dockingThresholdX: 1.35,
            dockingThresholdY: 1.35,
            csmSpeed: 0.58,
            rcsScale: 1
        };
    }

    function showCampaignStart() {
        if (!campaignStartOverlay) return;
        prepareCampaignDay();

        if (campaignDayNumber) campaignDayNumber.innerText = "МИССИЯ MP-02";
        if (campaignCondition) {
            campaignCondition.innerText = "ГОТОВ К СТАРТУ";
            campaignCondition.style.color = "#44ff88";
        }
        if (campaignFuelBudget) campaignFuelBudget.innerText = "100%";
        if (campaignSupplies) campaignSupplies.innerText = "—";

        if (campaignModifier) {
            while (campaignModifier.firstChild) campaignModifier.removeChild(campaignModifier.firstChild);
            var titleElement = document.createElement('strong');
            titleElement.textContent = "Цель: орбитальная стыковка";
            campaignModifier.appendChild(titleElement);
            campaignModifier.appendChild(document.createElement('br'));
            campaignModifier.appendChild(document.createTextNode(
                "Подними аппарат, синхронизируй скорость с орбитальным модулем и выполни мягкую стыковку."
            ));
        }

        campaignStartOverlay.style.display = 'block';
        localGameState = 'campaign_start';
        var phaseName = document.getElementById('phase-name');
        var phaseHint = document.getElementById('phase-hint');
        var phaseProgress = document.getElementById('phase-progress');
        if (phaseName) phaseName.innerText = "ПОДГОТОВКА";
        if (phaseHint) phaseHint.innerText = "Запусти миссию";
        if (phaseProgress) phaseProgress.innerText = "0 / 3";
    }

    function startDay() {
        if (campaignStartOverlay) campaignStartOverlay.style.display = 'none';
        if (tutorialOverlay) tutorialOverlay.style.display = 'none';
        if (!localMissionConfig) prepareCampaignDay();

        lm = createLM({
            x: 245,
            y: GROUND_Y - 30,
            vx: 0,
            vy: 0,
            fuel: localMissionConfig.startingFuel,
            rcsScale: localMissionConfig.rcsScale
        });
        csm = createCSM({
            x: 590,
            y: CSM_ORBIT_Y,
            speed: localMissionConfig.csmSpeed
        });
        localParticles.length = 0;
        localCelebrationParticles.length = 0;
        localScreenShake = 0;
        localOutcomeType = null;
        localGameStartTime = Date.now();
        lastFrameTime = 0;
        localGameState = 'playing';
    }

    function advanceToNextDay() {
        if (msgOverlay) msgOverlay.style.display = 'none';

        // Resolve campaign day
        const timeElapsed = Date.now() - localGameStartTime;
        const csmSpeed = (csm.speed != null ? csm.speed : CSM_SPEED);
        const relVx = Math.abs(lm.vx - csmSpeed);
        const relVy = Math.abs(lm.vy);
        const score = calculateScore(lm.fuel, timeElapsed, relVx, relVy);

        const missionOutcome = {
            success: localGameState === 'won',
            type: localOutcomeType || (localGameState === 'won' ? 'docking_success' : 'unknown'),
            fuelRemaining: lm.fuel,
            relVx,
            relVy,
            score
        };

        const result = resolveCampaignDay(localCampaign, missionOutcome);
        localCampaign = result.campaign;
        saveCampaign(localCampaign);

        // Reset for next day
        localParticles.length = 0;
        localCelebrationParticles.length = 0;
        localScreenShake = 0;
        localMissionConfig = null;

        showCampaignStart();
    }

    function endGame(success, message, outcomeType) {
        if (localGameState === 'won' || localGameState === 'lost') return;
        localGameState = success ? 'won' : 'lost';
        localOutcomeType = outcomeType || null;

        var timeElapsed = Date.now() - localGameStartTime;
        var csmSpeedNow = (csm.speed != null ? csm.speed : CSM_SPEED);
        var relVxNow = Math.abs(lm.vx - csmSpeedNow);
        var relVyNow = Math.abs(lm.vy);
        var score = calculateScore(lm.fuel, timeElapsed, relVxNow, relVyNow);

        if (msgTitle) {
            msgTitle.innerText = success ? "СТЫКОВКА ВЫПОЛНЕНА" : "МИССИЯ НЕ ВЫПОЛНЕНА";
            msgTitle.style.color = success ? "#44ff88" : "#ff5a64";
        }
        if (msgDetail) {
            var detail = message;
            detail += "\n\nВремя: " + (timeElapsed / 1000).toFixed(1) + " с";
            detail += "\nТопливо: " + Math.max(0, Math.floor(lm.fuel)) + "%";
            if (success) {
                detail += "\nТочность сближения: ΔVx " + (relVxNow * 10).toFixed(1) + " · ΔVy " + (relVyNow * 10).toFixed(1);
                detail += "\nРейтинг миссии: " + score;
            } else {
                detail += "\nПопробуй ещё раз — управлять нужно короткими импульсами.";
            }
            msgDetail.innerText = detail;
        }

        var phaseName = document.getElementById('phase-name');
        var phaseHint = document.getElementById('phase-hint');
        var phaseProgress = document.getElementById('phase-progress');
        if (phaseName) phaseName.innerText = success ? "МИССИЯ ВЫПОЛНЕНА" : "МИССИЯ ПРЕРВАНА";
        if (phaseHint) phaseHint.innerText = success ? "Орбитальные модули состыкованы" : "Можно повторить попытку";
        if (phaseProgress) phaseProgress.innerText = success ? "3 / 3" : "—";

        if (success) {
            playSound('dock_success');
            spawnCelebration(lm.x, lm.y, localCelebrationParticles);
        } else {
            playSound('collision');
            localScreenShake = 12;
        }

        if (msgOverlay) msgOverlay.style.display = 'block';
    }

    function resetGame() {
        localGameState = 'campaign_start';
        localGameStartTime = Date.now();
        if (msgOverlay) msgOverlay.style.display = 'none';
        if (pauseOverlay) pauseOverlay.style.display = 'none';

        lm = createLM();
        csm = createCSM();
        localParticles.length = 0;
        localCelebrationParticles.length = 0;
        localScreenShake = 0;
        lastFrameTime = 0;
        localMissionConfig = null;
        showCampaignStart();
    }

    function checkCollisions() {
        const result = checkDockingCollision(lm, csm, localMissionConfig);

        switch (result.type) {
            case 'docking_success':
                endGame(true, "Стыковка выполнена!", 'docking_success');
                break;
            case 'docking_failed_velocity':
                endGame(false, "Стыковка сорвана: слишком высокая относительная скорость.\nСнизь скорость сближения и выровняй движение по горизонтали.", 'docking_failed_velocity');
                break;
            case 'collision_wrong_angle':
                endGame(false, "Столкновение: неверный заход.\nПодходи к стыковочному узлу снизу и на малой скорости.", 'collision_wrong_angle');
                break;
        }
    }

    function updateMissionPhase(distance, relVxRaw, relVyRaw) {
        var phaseName = document.getElementById('phase-name');
        var phaseHint = document.getElementById('phase-hint');
        var phaseProgress = document.getElementById('phase-progress');
        if (!phaseName || !phaseHint || !phaseProgress) return;

        var altitudeNow = Math.max(0, GROUND_Y - (lm.y + 15));
        var relX = Math.abs(relVxRaw);
        var relY = Math.abs(relVyRaw);

        if (altitudeNow < 300) {
            phaseName.innerText = "ЭТАП 1 · ВЗЛЁТ";
            phaseHint.innerText = "Набери высоту до орбитального коридора. Используй ↑ короткими или длинными импульсами.";
            phaseProgress.innerText = "1 / 3";
        } else if (distance > 175 || relX > 0.7) {
            phaseName.innerText = "ЭТАП 2 · СИНХРОНИЗАЦИЯ";
            phaseHint.innerText = relVxRaw < -0.15 ? "Орбитальный модуль уходит вперёд — добавь →" :
                                 relVxRaw > 0.15 ? "Ты быстрее модуля — погаси скорость ←" :
                                 "Скорости близки. Сокращай дистанцию и держи высоту.";
            phaseProgress.innerText = "2 / 3";
        } else {
            phaseName.innerText = "ЭТАП 3 · СТЫКОВКА";
            phaseHint.innerText = (relX < 0.5 && relY < 0.5) ?
                "ЗЕЛЁНЫЙ КОРИДОР: мягко подведи аппарат к стыковочному узлу." :
                "Снизь ΔV по обеим осям. Для финального контакта нужны зелёные значения.";
            phaseProgress.innerText = "3 / 3";
        }
    }

    function updateUI() {
        if (!uiAltitude) return;
        var missionTimeEl = document.getElementById('mission-time');
        if (localGameState === 'playing') {
            var missionElapsed = Date.now() - localGameStartTime;
            var secondsLeft = Math.max(0, 90 - Math.floor(missionElapsed / 1000));
            if (missionTimeEl) missionTimeEl.innerText = secondsLeft;
            if (missionElapsed >= 90000) {
                endGame(false, "Время миссии истекло. Попробуй ещё раз и точнее рассчитай манёвр.", 'time_expired');
                return;
            }
        } else if (missionTimeEl) {
            missionTimeEl.innerText = "90";
        }

        uiAltitude.innerText = Math.max(0, Math.floor(GROUND_Y - (lm.y + 15)));
        uiVVel.innerText = (-lm.vy * 10).toFixed(1);
        uiHVel.innerText = (lm.vx * 10).toFixed(1);
        uiFuel.innerText = Math.floor(lm.fuel);

        const dx = csm.x - lm.x;
        const dy = csm.y - lm.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        uiDistanceCSM.innerText = Math.floor(distance);

        const csmSpeed = (csm.speed != null ? csm.speed : CSM_SPEED);
        const relVxRaw = lm.vx - csmSpeed;
        const relVx = Math.abs(relVxRaw);
        const relVyRaw = lm.vy;
        const relVy = Math.abs(relVyRaw);

        updateMissionPhase(distance, relVxRaw, relVyRaw);

        uiRelVx.innerText = (relVx * 10).toFixed(1);
        uiRelVy.innerText = (relVy * 10).toFixed(1);

        if (relVx > 0.5) {
            uiVxHint.innerText = relVxRaw < 0 ? '→' : '←';
            uiVxHint.style.color = '#ffaa00';
        } else {
            uiVxHint.innerText = '✓';
            uiVxHint.style.color = '#44ff44';
        }

        if (relVy > 0.5) {
            uiVyHint.innerText = relVyRaw > 0 ? '↑' : '↓';
            uiVyHint.style.color = '#ffaa00';
        } else {
            uiVyHint.innerText = '✓';
            uiVyHint.style.color = '#44ff44';
        }

        const threshX = localMissionConfig ? localMissionConfig.dockingThresholdX : DOCKING_VEL_THRESHOLD_X;
        const threshY = localMissionConfig ? localMissionConfig.dockingThresholdY : DOCKING_VEL_THRESHOLD_Y;
        uiRelVx.style.color = relVx < 0.5 ? '#44ff44' : (relVx < threshX ? '#ffff44' : '#ff4444');
        uiRelVy.style.color = relVy < 0.5 ? '#44ff44' : (relVy < threshY ? '#ffff44' : '#ff4444');

        if (lm.fuel < FUEL_WARNING_THRESHOLD) uiFuel.style.color = 'red';
        else uiFuel.style.color = 'white';
    }

    function drawFuelGauge() {
        const barX = CANVAS_WIDTH - 25;
        const barY = 40;
        const barW = 12;
        const barH = 150;
        const fuelPct = Math.max(0, lm.fuel) / 100;

        ctx.save();

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX - 2, barY - 2, barW + 4, barH + 4);

        // Fuel fill — green to yellow to red
        const fillH = barH * fuelPct;
        const fillY = barY + barH - fillH;
        let r, g;
        if (fuelPct > 0.5) {
            r = Math.floor(255 * (1 - (fuelPct - 0.5) * 2));
            g = 255;
        } else {
            r = 255;
            g = Math.floor(255 * fuelPct * 2);
        }

        // Pulse when below warning threshold
        let alpha = 0.9;
        if (lm.fuel < FUEL_WARNING_THRESHOLD && lm.fuel > 0) {
            alpha = 0.5 + 0.4 * Math.abs(Math.sin(Date.now() / 150));
        }

        ctx.fillStyle = `rgba(${r}, ${g}, 0, ${alpha})`;
        ctx.fillRect(barX, fillY, barW, fillH);

        // Label
        ctx.fillStyle = '#aaa';
        ctx.font = '9px "Courier New"';
        ctx.textAlign = 'center';
        ctx.fillText('FUEL', barX + barW / 2, barY - 6);

        ctx.restore();
    }

    function drawBackground() {
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        var g = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
        g.addColorStop(0, '#050812');
        g.addColorStop(0.58, '#0a1020');
        g.addColorStop(1, '#161622');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        var now = Date.now() / 1000;
        for (var si = 0; si < starList.length; si++) {
            var star = starList[si];
            var alpha = 0.32 + 0.68 * ((Math.sin(now * star.speed + star.phase) + 1) / 2);
            ctx.fillStyle = 'rgba(255,255,255,' + alpha + ')';
            ctx.fillRect(star.x, star.y, star.size, star.size);
        }

        // Distant Earth glow to give the scene depth.
        var earthGlow = ctx.createRadialGradient(690, 540, 25, 690, 540, 170);
        earthGlow.addColorStop(0, 'rgba(80,145,220,.26)');
        earthGlow.addColorStop(0.55, 'rgba(31,77,130,.12)');
        earthGlow.addColorStop(1, 'rgba(20,50,90,0)');
        ctx.fillStyle = earthGlow;
        ctx.beginPath();
        ctx.arc(690, 540, 170, 0, Math.PI * 2);
        ctx.fill();

        // Lunar surface
        var lunar = ctx.createLinearGradient(0, GROUND_Y, 0, CANVAS_HEIGHT);
        lunar.addColorStop(0, '#555964');
        lunar.addColorStop(1, '#292c35');
        ctx.fillStyle = lunar;
        ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y);

        // Horizon glow / launch site
        ctx.fillStyle = 'rgba(229,29,42,.17)';
        ctx.fillRect(180, GROUND_Y - 3, 135, 3);

        ctx.fillStyle = '#3b3f49';
        ctx.beginPath();
        ctx.arc(95, GROUND_Y + 24, 34, 0, Math.PI*2);
        ctx.arc(340, GROUND_Y + 42, 54, 0, Math.PI*2);
        ctx.arc(655, GROUND_Y + 17, 26, 0, Math.PI*2);
        ctx.fill();

        ctx.fillStyle = 'rgba(255,255,255,.23)';
        ctx.font = '10px Arial';
        ctx.fillText('ПУСКОВАЯ ПЛОЩАДКА MP-02', 190, GROUND_Y + 20);
    }

    function drawCSMIndicator() {
        let dx = csm.x - lm.x;
        if (Math.abs(dx) > CANVAS_WIDTH / 2) {
            dx = dx > 0 ? dx - CANVAS_WIDTH : dx + CANVAS_WIDTH;
        }
        const dy = csm.y - lm.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const isLeft = dx < 0;

        ctx.save();
        ctx.fillStyle = distance < 150 ? '#44ff44' : '#aaaaaa';
        ctx.font = '12px "Courier New"';
        ctx.textAlign = 'center';
        ctx.globalAlpha = 0.8;

        const distText = `МОДУЛЬ: ${Math.floor(distance)} м`;
        ctx.fillText(distText, CANVAS_WIDTH / 2, 20);

        if (Math.abs(dx) > 100) {
            const arrowX = CANVAS_WIDTH / 2 + (isLeft ? -50 : 50);
            ctx.beginPath();
            if (isLeft) {
                ctx.moveTo(arrowX + 8, 17);
                ctx.lineTo(arrowX, 17);
                ctx.lineTo(arrowX + 4, 13);
                ctx.moveTo(arrowX, 17);
                ctx.lineTo(arrowX + 4, 21);
            } else {
                ctx.moveTo(arrowX - 8, 17);
                ctx.lineTo(arrowX, 17);
                ctx.lineTo(arrowX - 4, 13);
                ctx.moveTo(arrowX, 17);
                ctx.lineTo(arrowX - 4, 21);
            }
            ctx.strokeStyle = ctx.fillStyle;
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        ctx.restore();

        const isOffScreen = csm.x < 0 || csm.x > CANVAS_WIDTH;
        if (isOffScreen || Math.abs(dx) > CANVAS_WIDTH / 3) {
            const arrowX = isLeft ? 20 : CANVAS_WIDTH - 20;
            const arrowY = 80;

            ctx.save();
            ctx.fillStyle = distance < 150 ? '#44ff44' : '#aaaaaa';
            ctx.strokeStyle = ctx.fillStyle;
            ctx.lineWidth = 2;

            if (distance < 100) {
                const pulse = Math.sin(Date.now() / 200) * 0.2 + 0.8;
                ctx.globalAlpha = pulse;
            }

            ctx.beginPath();
            if (isLeft) {
                ctx.moveTo(arrowX + 10, arrowY);
                ctx.lineTo(arrowX, arrowY - 8);
                ctx.lineTo(arrowX, arrowY + 8);
            } else {
                ctx.moveTo(arrowX - 10, arrowY);
                ctx.lineTo(arrowX, arrowY - 8);
                ctx.lineTo(arrowX, arrowY + 8);
            }
            ctx.closePath();
            ctx.fill();

            ctx.restore();
        }
    }

    function drawDockingTarget(x, y, isAligned) {
        const flashRate = Math.sin(Date.now() / 200) * 0.5 + 0.5;

        ctx.save();
        ctx.translate(x, y);

        if (isAligned) {
            ctx.strokeStyle = '#44ff44';
            ctx.fillStyle = '#44ff44';
        } else {
            ctx.strokeStyle = '#00aaff';
            ctx.fillStyle = '#00aaff';
        }

        ctx.globalAlpha = 0.4 + flashRate * 0.4;
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(0, -20);
        ctx.lineTo(0, -40);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-6, -28);
        ctx.lineTo(0, -20);
        ctx.lineTo(6, -28);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, -12, 12, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }

    function drawTrajectoryPrediction() {
        ctx.save();
        ctx.strokeStyle = '#666666';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.5;
        ctx.setLineDash([3, 6]);

        ctx.beginPath();
        ctx.moveTo(lm.x, lm.y);

        let predX = lm.x;
        let predY = lm.y;
        let predVx = lm.vx;
        let predVy = lm.vy;
        const stepDt = 1 / TARGET_FPS;

        for (let i = 0; i < TRAJECTORY_PREDICTION_STEPS; i++) {
            predVy += GRAVITY * stepDt;
            predX += predVx * stepDt * TARGET_FPS;
            predY += predVy * stepDt * TARGET_FPS;

            if (predX > CANVAS_WIDTH) predX -= CANVAS_WIDTH;
            if (predX < 0) predX += CANVAS_WIDTH;

            if (predY > GROUND_Y) {
                ctx.lineTo(predX, GROUND_Y);
                break;
            }

            ctx.lineTo(predX, predY);
        }

        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    function drawDockingAids() {
        const dx = csm.x - lm.x;
        const dy = csm.y - lm.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        ctx.save();
        ctx.strokeStyle = '#336699';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.4;
        ctx.setLineDash([10, 10]);
        ctx.beginPath();
        ctx.moveTo(0, CSM_ORBIT_Y);
        ctx.lineTo(CANVAS_WIDTH, CSM_ORBIT_Y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#336699';
        ctx.font = '10px "Courier New"';
        ctx.globalAlpha = 0.6;
        ctx.fillText('ОРБИТА MP', CANVAS_WIDTH - 70, CSM_ORBIT_Y - 5);
        ctx.restore();

        drawTrajectoryPrediction();

        const csmSpeed = (csm.speed != null ? csm.speed : CSM_SPEED);
        const relVx = Math.abs(lm.vx - csmSpeed);
        const relVy = Math.abs(lm.vy);
        const statusColor = getApproachStatus(relVx, relVy, localMissionConfig);
        const isAligned = (statusColor === '#44ff44');

        drawDockingTarget(csm.x, csm.y, isAligned);

        if (distance < DOCKING_AIDS_RANGE) {
            ctx.save();
            ctx.strokeStyle = isAligned ? '#44ff44' : '#00aaff';
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.3;
            ctx.setLineDash([5, 10]);

            ctx.beginPath();
            ctx.moveTo(csm.x - 20, csm.y - 25);
            ctx.lineTo(csm.x - 40, csm.y + 100);
            ctx.moveTo(csm.x + 20, csm.y - 25);
            ctx.lineTo(csm.x + 40, csm.y + 100);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();

            if (distance < 300) {
                ctx.save();
                ctx.strokeStyle = statusColor;
                ctx.lineWidth = 1;
                ctx.setLineDash([5, 5]);
                ctx.globalAlpha = 0.6;
                ctx.beginPath();
                ctx.moveTo(lm.x, lm.y);
                ctx.lineTo(csm.x, csm.y - 15);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.restore();
            }

            ctx.save();
            ctx.strokeStyle = '#44ff44';
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.arc(csm.x, csm.y - 15, 25, 0, Math.PI * 2);
            ctx.stroke();
            ctx.strokeStyle = '#ffff44';
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.3;
            ctx.beginPath();
            ctx.arc(csm.x, csm.y - 15, 50, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    }

    function drawCelebrationParticles() {
        localCelebrationParticles.forEach(p => {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life / 60;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        });
    }

    let lastFrameTime = 0;

    function loop(timestamp) {
        if (!lastFrameTime) lastFrameTime = timestamp;
        const rawDt = (timestamp - lastFrameTime) / 1000;
        // Clamp dt to avoid spiral of death on tab-switch
        const dt = Math.min(rawDt, 0.1);
        lastFrameTime = timestamp;

        if (localGameState === 'playing') {
            const callbacks = {
                onMainThrust: (x, y) => {
                    spawnExhaust(x, y, 'down', localParticles);
                    playThrustSound();
                },
                onRcsThrust: (x, y, dir) => {
                    spawnExhaust(x, y, dir, localParticles);
                    playRcsSound();
                },
                onLowFuel: () => playAlarmSound(),
                onCrash: (msg) => endGame(false, msg, 'crashed'),
                onFuelDepleted: () => endGame(false, "Топливо закончилось. Управление аппаратом потеряно.", 'fuel_depleted')
            };

            const status = lm.update(localKeys, localGameState, callbacks, dt);
            csm.update(dt);

            if (status === 'flying') {
                checkCollisions();
            }

            for (let i = localParticles.length - 1; i >= 0; i--) {
                localParticles[i].update();
                if (localParticles[i].life <= 0) localParticles.splice(i, 1);
            }
        }

        updateCelebrationParticles(localCelebrationParticles);

        ctx.save();
        if (localScreenShake > 0) {
            const shakeX = (Math.random() - 0.5) * localScreenShake;
            const shakeY = (Math.random() - 0.5) * localScreenShake;
            ctx.translate(shakeX, shakeY);
            localScreenShake *= 0.9;
            if (localScreenShake < 0.5) localScreenShake = 0;
        }

        drawBackground();
        drawCSMIndicator();
        drawDockingAids();

        localParticles.forEach(p => p.draw(ctx));

        csm.draw(ctx);
        lm.draw(ctx);

        if (lm.x < LM_GHOST_THRESHOLD) {
            drawLMAtPosition(ctx, lm.x + CANVAS_WIDTH, lm.y);
        } else if (lm.x > CANVAS_WIDTH - LM_GHOST_THRESHOLD) {
            drawLMAtPosition(ctx, lm.x - CANVAS_WIDTH, lm.y);
        }

        drawCelebrationParticles();
        drawFuelGauge();

        ctx.restore();

        updateUI();

        requestAnimationFrame(loop);
    }

    // Public API
    return {
        init: function() {
            if (!initDOM()) {
                if (typeof process === 'undefined') {
                    console.error('Failed to initialize DOM elements');
                }
                return false;
            }
            initInputHandlers();
            showTutorialIfFirstVisit();
            prepareCampaignDay();
            showCampaignStart();
            return true;
        },
        start: function() {
            lastFrameTime = 0;
            requestAnimationFrame(loop);
        },
        getLM: () => lm,
        getCSM: () => csm,
        getGameState: () => localGameState,
        setGameState: (state) => { localGameState = state; },
        resetGame,
        togglePause,
        toggleTrophyRoom,
        toggleHelp,
        getCampaign: () => localCampaign,
        getMissionConfig: () => localMissionConfig,
        startDay,
        newCampaign: function() {
            localCampaign = resetCampaign();
            localMissionConfig = null;
            showCampaignStart();
        }
    };
}

// ===== Auto-initialization for browser =====
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    function bootMPDockingGame() {
        var game = createGameController();
        if (game.init()) {
            window.mpDockingGame = game;
            window.mpDockingStart = function() { game.startDay(); };
            window.mpDockingReset = function() { game.resetGame(); };
            window.mpDockingHideTutorial = function() {
                var overlay = document.getElementById('tutorial-overlay');
                if (overlay) overlay.style.display = 'none';
                safeStorageSet('apolloTutorialShown', 'true');
            };
            game.start();
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootMPDockingGame);
    } else {
        bootMPDockingGame();
    }
}
