/* Stadium Button Fix */
// Ensure stadium button works - run after everything else
(function() {
  setTimeout(() => {
    
    // Check if stadium button exists and is working
    const stadiumBtn = document.getElementById('openStadiumBtn');
    if (stadiumBtn) {
      
      // Remove any existing handlers and add a fresh one
      const newBtn = stadiumBtn.cloneNode(true);
      stadiumBtn.parentNode.replaceChild(newBtn, stadiumBtn);
      
      newBtn.addEventListener('click', function(e) {
        e.preventDefault();
        if (typeof window.toggleStadiumPane === 'function') {
          window.toggleStadiumPane(true);
        } else {
          console.error('toggleStadiumPane function not found!');
        }
      });
      
    } else {
      
      // Try to find the HUD bar and add the button
      const hudBar = document.getElementById('hudBar');
      if (hudBar) {
        const btn = document.createElement('button');
        btn.id = 'openStadiumBtn';
        btn.textContent = '🏟️ Stadium';
        btn.style.marginLeft = '8px';
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          if (typeof window.toggleStadiumPane === 'function') {
            window.toggleStadiumPane(true);
          } else {
            console.error('toggleStadiumPane function not found!');
          }
        });
        hudBar.appendChild(btn);
      } else {
      }
    }
  }, 500); // Wait 500ms for everything to load
})();

// Fixtures Button Fix - similar to stadium button
(function() {
  setTimeout(() => {
    
    const fixturesBtn = document.getElementById('openFixturesBtn');
    if (fixturesBtn) {
      
      // Remove any existing handlers and add a fresh one
      const newBtn = fixturesBtn.cloneNode(true);
      fixturesBtn.parentNode.replaceChild(newBtn, fixturesBtn);
      
      newBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof window.toggleFixturesPane === 'function') {
          window.toggleFixturesPane(true);
        } else {
          console.error('toggleFixturesPane function not found!');
        }
      });
      
    } else {
    }
  }, 600); // Wait 600ms for everything to load (after stadium button)
})();


// Inventory button: opens the inventory pane (the one inventory UI)
(function wireInventoryButton(){
  const btn = document.getElementById('openInvBtn');
  if (!btn) return;
  btn.onclick = function(e) {
    e.preventDefault();
    e.stopPropagation();
    toggleInventoryPane(true);
  };
})();

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
      }
    };
  }
}

// Set up the fundraiser button with multiple fallbacks
setupFundraiserButton();
setTimeout(setupFundraiserButton, 1000);
setTimeout(setupFundraiserButton, 3000);
