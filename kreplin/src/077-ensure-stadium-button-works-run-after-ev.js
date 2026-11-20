// Ensure stadium button works - run after everything else
(function() {
  setTimeout(() => {
    console.log('Stadium button fix running...');
    
    // Check if stadium button exists and is working
    const stadiumBtn = document.getElementById('openStadiumBtn');
    if (stadiumBtn) {
      console.log('Stadium button found, checking if it has click handler...');
      
      // Remove any existing handlers and add a fresh one
      const newBtn = stadiumBtn.cloneNode(true);
      stadiumBtn.parentNode.replaceChild(newBtn, stadiumBtn);
      
      newBtn.addEventListener('click', function(e) {
        e.preventDefault();
        console.log('Stadium button clicked (fix handler)!');
        if (typeof window.toggleStadiumPane === 'function') {
          window.toggleStadiumPane(true);
        } else {
          console.error('toggleStadiumPane function not found!');
        }
      });
      
      console.log('Stadium button click handler added successfully');
    } else {
      console.log('Stadium button not found, attempting to create it...');
      
      // Try to find the HUD bar and add the button
      const hudBar = document.getElementById('hudBar');
      if (hudBar) {
        const btn = document.createElement('button');
        btn.id = 'openStadiumBtn';
        btn.textContent = '🏟️ Stadium';
        btn.style.marginLeft = '8px';
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          console.log('Created stadium button clicked!');
          if (typeof window.toggleStadiumPane === 'function') {
            window.toggleStadiumPane(true);
          } else {
            console.error('toggleStadiumPane function not found!');
          }
        });
        hudBar.appendChild(btn);
        console.log('Stadium button created and added to HUD');
      } else {
        console.log('HUD bar not found, cannot create stadium button');
      }
    }
  }, 500); // Wait 500ms for everything to load
})();

// Fixtures Button Fix - similar to stadium button
(function() {
  setTimeout(() => {
    console.log('Fixtures button fix running...');
    
    const fixturesBtn = document.getElementById('openFixturesBtn');
    if (fixturesBtn) {
      console.log('Fixtures button found, checking if it has click handler...');
      
      // Remove any existing handlers and add a fresh one
      const newBtn = fixturesBtn.cloneNode(true);
      fixturesBtn.parentNode.replaceChild(newBtn, fixturesBtn);
      
      newBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Fixtures button clicked (fix handler)!');
        if (typeof window.toggleFixturesPane === 'function') {
          window.toggleFixturesPane(true);
        } else {
          console.error('toggleFixturesPane function not found!');
        }
      });
      
      console.log('Fixtures button click handler added successfully');
    } else {
      console.log('Fixtures button not found');
    }
  }, 600); // Wait 600ms for everything to load (after stadium button)
})();

// Global state manager instance - will be initialized after page loads
let stateManager = null;

// --- MODERN SYSTEM INITIALIZATION ---
async function initializeModernSystems() {
  try {
    // Initialize state manager - check if GameStateManager is defined
    // Wait a bit if it's not immediately available (might be loading)
    if (typeof window.GameStateManager === 'undefined') {
      // Wait up to 1 second for GameStateManager to be defined
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        if (typeof window.GameStateManager !== 'undefined') {
          break;
        }
      }
      
      if (typeof window.GameStateManager === 'undefined') {
        console.error('GameStateManager is not defined after waiting. Skipping modern systems initialization.');
        return;
      }
    }
    stateManager = new window.GameStateManager();
    window.stateManager = stateManager; // Make it globally accessible
    // Initialize IndexedDB state management
    await stateManager.init();
    console.log('✅ State management initialized');

    // Check if reset was requested - if so, skip loading and clear the flag
    const resetFlag = localStorage.getItem('_reset_flag');
    if (resetFlag === 'true') {
      localStorage.removeItem('_reset_flag');
      console.log('✅ Reset flag detected - skipping state load');
      // Still clear IndexedDB to be safe
      await stateManager.clearGameState();
    } else {
      // Load existing game state if available
      const savedState = await stateManager.loadGameState();
      if (savedState && !window.S) {
        window.S = savedState;
        // CRITICAL: Ensure global S references the loaded state
        if (typeof S === 'undefined' || S === null) {
          S = window.S;
        }
        console.log('✅ Game state loaded from IndexedDB');
      } else if (savedState && window.S) {
        // State already exists, merge or ensure S references it
        window.S = savedState;
        S = window.S;
        console.log('✅ Game state reloaded from IndexedDB (state already existed)');
      }
    }
    
    // Ensure S exists (either from load or will be created in init())
    if (!window.S) {
      window.S = {};
    }
    
    console.log('DEBUG: Initializing rival system, window.S exists:', !!window.S);
    console.log('DEBUG: Current rival state:', {
      hasRival: !!window.S.rival,
      rivalEnabled: window.S.rival?.enabled,
      rivalName: window.S.rival?.name,
      SExists: typeof S !== 'undefined',
      SEqualsWindowS: typeof S !== 'undefined' && S === window.S
    });
    
    // Ensure rival system is initialized after state load (or before init creates new state)
    if (!window.S.rival) {
      console.log('DEBUG: Creating new rival object');
      window.S.rival = {
        name: "Delmor Krunchem",
        club: "Portsmouth",
        hatred: 0,
        lastEventTick: 0,
        enabled: true
      };
    } else {
      console.log('DEBUG: Normalizing existing rival state');
      // Normalize existing rival state
      if (typeof window.S.rival.hatred !== 'number') window.S.rival.hatred = 0;
      if (typeof window.S.rival.lastEventTick !== 'number') window.S.rival.lastEventTick = 0;
      if (typeof window.S.rival.enabled !== 'boolean') window.S.rival.enabled = true;
      if (!window.S.rival.name) window.S.rival.name = "Delmor Krunchem";
      if (!window.S.rival.club) window.S.rival.club = "Portsmouth";
    }
    
    // Ensure settings exist
    if (!window.S.settings) window.S.settings = {};
    if (typeof window.S.settings.rival_abuse_enabled !== 'boolean') {
      window.S.settings.rival_abuse_enabled = true;
    }
    
    // CRITICAL FIX: Ensure S (global) and window.S are the same object
    // If S exists but is different from window.S, sync the rival data
    if (typeof S !== 'undefined' && S !== window.S) {
      console.log('DEBUG: S and window.S are different objects! Syncing rival to S...');
      S.rival = window.S.rival;
      S.settings = window.S.settings;
    } else if (typeof S === 'undefined') {
      // If S doesn't exist yet, it will be created in init() and should reference window.S
      console.log('DEBUG: S is undefined, will be created in init()');
    } else {
      // S and window.S are the same, good!
      console.log('DEBUG: S and window.S are the same object');
    }
    
    console.log('✅ Rival system initialized', {
      rivalName: window.S.rival.name,
      enabled: window.S.rival.enabled,
      settingsEnabled: window.S.settings.rival_abuse_enabled,
      SHasRival: typeof S !== 'undefined' && !!S.rival
    });

    // Setup social feature event listeners
    setupSocialFeatures();

    // Setup achievement checking
    setupAchievementSystem();

    // Initialize PWA
    initializePWA();

    console.log('✅ All modern systems initialized');
  } catch (error) {
    console.error('❌ Failed to initialize modern systems:', error);
  }
}

// Note: initializeModernSystems will be called after GameStateManager is defined (see below)

function setupSocialFeatures() {
  // Achievement button removed to fix inventory button conflicts
}

function setupAchievementSystem() {
  // Check achievements less frequently to prevent spam
  setInterval(() => {
    socialManager.checkAchievements();
  }, 30000); // Check every 30 seconds instead of 10

  // Check achievements on game state changes (but less frequently)
  const originalLog = window.log;
  window.log = function(...args) {
    originalLog.apply(this, args);
    // Only check achievements after significant events, not every log
    if (args[0] && (args[0].includes('£') || args[0].includes('win') || args[0].includes('loss'))) {
      setTimeout(() => socialManager.checkAchievements(), 500);
    }
  };
}

function showAchievementsModal() {
  modal.show({
    title: '🏆 Achievements',
    message: 'Your unlocked achievements will appear here.',
    type: 'text',
    options: { defaultValue: 'Achievement system active!' }
  });
}

function initializePWA() {
  if ('serviceWorker' in navigator) {
    const swCode = `
      const CACHE_NAME = 'saints-chairman-v1';
      const urlsToCache = [
        '/',
        '/kreplin.html'
      ];

      self.addEventListener('install', (event) => {
        event.waitUntil(
          caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(urlsToCache))
        );
      });

      self.addEventListener('fetch', (event) => {
        event.respondWith(
          caches.match(event.request)
            .then((response) => {
              if (response) {
                return response;
              }
              return fetch(event.request);
            }
          )
        );
      });
    `;
    
    const blob = new Blob([swCode], { type: 'application/javascript' });
    const swUrl = URL.createObjectURL(blob);
    
    navigator.serviceWorker.register(swUrl)
      .then((registration) => {
        console.log('✅ Service Worker registered:', registration);
      })
      .catch((registrationError) => {
        console.log('❌ Service Worker registration failed:', registrationError);
      });
  }
}

// Initialize everything when DOM is ready - moved to after GameStateManager definition

// SIMPLE INVENTORY BUTTON SETUP - FINAL SOLUTION
function setupSimpleInventoryButton() {
  console.log('Setting up simple inventory button...');
  
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupSimpleInventoryButton);
    return;
  }
  
  const btn = document.getElementById('openInvBtn');
  if (btn) {
    // Remove any existing event listeners by cloning
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    
    // Add simple click handler using onclick (most reliable)
    newBtn.onclick = function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log('Inventory button clicked!');
      
      // Ensure inventory pane exists first
      if (typeof ensureInventoryPane === 'function') {
        ensureInventoryPane();
      }
      
      // Then toggle it open and render content
      if (typeof window.toggleInventoryPane === 'function') {
        window.toggleInventoryPane(true);
      } else {
        console.log('toggleInventoryPane not available, trying direct approach');
        const pane = document.getElementById('inventoryPane');
        if (pane) {
          pane.style.display = 'block';
          if (typeof window.renderInventory === 'function') {
            console.log('Calling renderInventory...');
            // Ensure inventory data exists
            if (!window.S) window.S = {};
            if (!window.S.inventory) window.S.inventory = { accolades: [], drugs: 0, items: [] };
            console.log('Inventory data before render:', window.S.inventory);
            window.renderInventory();
            console.log('renderInventory called, checking inventory data:', window.S?.inventory);
          } else {
            console.log('renderInventory function not available');
          }
        } else {
          console.log('Inventory pane not found in DOM');
        }
      }
    };
    
    console.log('Simple inventory button setup complete');
  } else {
    console.log('Inventory button not found in DOM');
  }
}

// Set up the button with multiple fallbacks
setupSimpleInventoryButton();
setTimeout(setupSimpleInventoryButton, 1000);
setTimeout(setupSimpleInventoryButton, 3000);

// Set up fundraiser button
function setupFundraiserButton() {
  const btn = document.getElementById('fundraiserBtn');
  if (btn) {
    // Remove any existing event listeners by cloning
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    
    // Add click handler
    newBtn.onclick = function(e) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof openFundraiserModal === 'function') {
        openFundraiserModal();
      } else {
        console.log('openFundraiserModal function not available');
      }
    };
  }
}

// Set up the fundraiser button with multiple fallbacks
setupFundraiserButton();
setTimeout(setupFundraiserButton, 1000);
setTimeout(setupFundraiserButton, 3000);
