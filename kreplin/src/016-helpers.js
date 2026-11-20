// ---------- helpers ----------
const money=n=>'£'+Number(n).toLocaleString('en-GB');
const rnd=(a,b)=>Math.floor(Math.random()*(b-a+1))+a;
const sample=arr=>arr[Math.floor(Math.random()*arr.length)];
const now=()=>new Date().toLocaleString();
const FEMALE_NAMES = ["Krogette","Beyonce","Dresdeny", "Disorderleigh", "Kretchen", "Felchette", "Cyste", "Lovely Laura", "Melonette", "Syrup", "Fanny", "Lioness", "Saintette", "Vanilla", "Kezril", "Sativa", "Autopsie", "Bertha", "Stampedette", "Banana", "Kush", "Seronda", "Trophie", "Lisa", "Beryl", "Fabulous Fanny", "Gruntette", "Squawkette", "Squiffy", "Injurie", "Kezza", "Mollor", "Swezzer", "Kate", "Crostina", "Belchetta", "Dragonfruit", "Da Female Chozen One", "Morag", "Jeggings", "Fergie", "Shagette", "Venus", "Kath", "Coffee Cake", "Kreblisa", "Cindy", "Peckish", "Crumpette", "Appetite", "Appetiser","Karen", "Flartennia", "Trumpence", "Tuppence", "Serendipitie", "Temperance", "Ribena", "Saltine", "Emily", "Statistique", "Dizney", "Princess", "Precious", "Plumpette", "Carrot", "Felchita", "Saliva", "Salvia", "Cannabette", "Ambrosia", "Wei-Ling", "Synthetique", "Briberie", "Finesse", "Massage", "Boggette", "Menage", "Sympathie", "Empathie", "Tuppence", "Eva", "Eternity", "Felicity", "Bolognese", "Yazzy", "Burkha", "Margherita", "Chocolette", "Repartee", "Partition", "Beaky", "Pandemonia", "Temptressa", "Charlotte", "Emma", "Missionarie", "Pepper", "Peppa Pig", "Tactile", "Ribbony", "Tiramisu", "Cream", "Fragrance", "Cardigan", "Viola", "Bouquet", "Rachel", "Nutella", "Tarantulette", "Gertrude", "Gerty", "Serviette", "Scandelle", "Fabrique", "Fluffette", "Aneurysme", "Dorothy", "Francine", "Padma", "Angel", "Lubricia", "Snetty", "Missionarie", "Angelique", "Guinevere", "Dialysis", "Cygerette", "Gertrude", "Gertie", "Celebritie", "Brandice", "Burghette", "Licorice", "Bruschetta", "Maybelline", "Lizzy", "Nativitie", "Sensitivitie", "Brownie", "Cavity", "Bustina", "Expedia", "Stella", "Pleazure", "Aphrodite", "Belladonna", "Cassiopeia", "Delilah", "Electra", "Fiona", "Gwendolyn", "Hecate", "Isadora", "Jezebel", "Kali", "Lilith", "Medusa", "Nyx", "Ophelia", "Persephone", "Quinn", "Raven", "Seraphina", "Tempest", "Ursula", "Valkyrie", "Wren"];
const MALE_NAMES   = ["Krelmor", "Hagrid", "Rhett", "Skunk", "Wezlow", "Crabon", "Gulch", "Milkus", "Scronson", "Kremon", "Kelmon", "Grotty", "Periwinkle", "Scrotto", "Drongus B.", "Lil Crongus", "Krog", "Skidmork", "Bertie", "Wilmor", "Silmor", "Terrence", "Kevin", "Clarence", "Dynamo", "Ronson", "Bronson", "Tackle", "Tom", "Robert", "Tobias", "Bazzard", "Krazil", "Oregano", "Timmy", "Jimmy", "Lazlow", "Ambrose", "Forrester", "Michael", "Tuppy", "Strategem", "Molty", "Andre", "Sonic", "Nigel", "Peregrine", "Deontay", "Malachi", "Godspeed", "Usain", "Kim-Jong", "Debonair", "Krezben","Krabbor", "Kritchell", "Grog", "Archimedes", "Rodney", "Chozen-One", "Sanjeev", "Radar", "Chieftan", "Chicago", "Belchmar", "Barles", "Brixton", "Hackney", "Krelbert", "Drongus", "Chiplin", "Crobley", "Stepney", "Scrombus", "Kreblis", "Malcolm", "Norman", "King Baxter", "Kendrick Lamar II", "Football", "Rooney", "Milner", "Bovril", "Basil", "Bestial", "Boggor", "Timmy", "Thomas", "Tyrone", "Ibram X", "Krodmar", "Blexmar", "Fraxmar", "Brelmar", "Conkreth", "Moborsh", "Dalton", "Deacon", "Krazy", "Krazed", "Litmus", "Stretch", "Mohammed", "Gutstank", "Irving", "Lil' Gluggy", "Willy", "Steamon", "Ernie", "Ernest", "Wonderful Willy", "Labrador", "Kidney", "Buster", "Nobby", "Nut", "Bolt", "Tech N9ne", "Wrench", "Gronald", "Kenneth", "Sledge", "Clench", "Swizzy", "Texan", "Aberdeen", "Big Mac", "Nugget", "Larry", "Lombar", "Bongo", "Fortune Favors Da Brave", "Jenko", "Tech", "Jupiter", "Chadmork", "Dante", "Flenky", "James", "Harry", "Charlie", "Mikey", "Jack", "Norfolk", "Squit", "Thump", "Drastic", "Vilnius", "Sclerosis", "Cave", "Salton", "Sheikh", "Grimblo", "Skepta", "Stroke", "Cartilidge", "Milbrook", "Morton", "Zaddius", "Dutty", "Terry", "Norris", "Tarbrus", "Brutus", "Da Illest", "Krevin", "Kravid", "Bozzer", "Krorge", "Krudgle", "Stomp", "Chaos", "Defcon", "Balthazar", "Mozart", "Chazon", "Peerless", "Anthony", "Rancid", "Bogus", "Shafty Rod", "Gronster","Dongle", "Stench", "Wankme", "Alexander", "Benjamin", "Christopher", "Daniel", "Edward", "Frederick", "Gabriel", "Henry", "Isaac"];
const SURNAMES     = ["Creltu","Scrozno", "Drywall", "Prostin", "Felch", "Mandrill", "Frelgu","Jumblin", "Drippin", "S. Grant", "Krenton", "Brenlus", "Lorris", "Norris", "Forsyth","Spain","Cheezit", "Techno", "McDonald","Johnson","Thompson","Walker","Cratchett","Krelmor", "Custard", "Krankmo", "Brongus","Borker","Braich", "Falconer", "Bell", "Cranch", "Willie", "Popper", "Softener", "Robber-Baron", "Wren", "Yang", "Krozno", "Seamen", "Weeper", "Hex", "Burgess","Tremblin", "Conker", "Dribbler", "Snugglepuff", "Moore","Mildew","Clark","Allen", "Bongo", "Crampon", "Krandall", "Bangsweth", "Crendu", "Snuffton", "Wankus", "Borgor", "Bagdai", "Gambler", "Onsley", "Tenderly", "Tendril", "Throbbin", "Onslaught", "Hammerbro", "Goldstein", "Wongstein", "Parcel", "Wrentham", "Springer", "Crimson", "Rotson", "Nevitt", "Brotwith", "Simpson", "Swiller", "Gooch", "Brunt", "Guzzlebum", "Cumming", "Treadmill", "Stiffie", "Roosevelt", "Kennedy", "Hardrod", "Crocku", "Cranstil", "Cronstil", "Morton", "Crandar", "Stillfrit", "Venables", "Trennith", "Trimbon", "Buxter", "Mezlow", "Voldon", "Maximum", "Choccu", "Pudding", "Pennis", "Chang", "Patel", "Richmond", "Angus", "Sashimi", "Fortune", "Jenkins", "Islam", "Wang", "Wong", "Cohen", "Sunak", "Wonkor", "Bongrip", "Butterworth", "Nutbust", "Cowlick", "Smith", "Pusher", "Flatus", "Jenkins", "Brinkley", "Titchmarsh", "Trickmeister", "Cockson", "Michaels", "Brezlin", "Brecht", "Drooblin", "Masher", "Troika", "Empath", "Clitte", "Gargle", "Gargler", "Trackanfield", "Creamer", "Troffley", "Truffle", "Flendon", "Quimstick", "Hounslow", "Gorping", "Masala", "Tremble", "Jones", "Skunt", "Onslow", "Bexley-Heath", "Baxter", "Tickle", "Belfrey", "Bogstein", "Kwale", "Kwamese", "Bumpstock", "Crimbo", "Tekken", "Fragmar", "Lizards", "Konguss", "Crongus", "Bigbum", "Chang", "Cohenberg", "Bingo", "Fragnor", "Moaning", "Griblis", "Creston", "Tenderly", "Winstanley", "Frenalty", "Muncher", "Bigbelly", "Johnson", "Stroker", "Singh", "Toaster", "Dorito", "Tungus", "Dangle", "Dongle", "Cockwood", "Nukem", "Kingfisher", "Spurting", "Beaker", "Failsafe", "Cronston", "Milmil", "Bangers", "Dribblin", "Scrottus", "Scrotton", "Leaker", "Bellhop", "Spaffing", "Wonkor", "Crapper", "Nicely", "Mudflap", "Stambus", "Krelford", "Kettler", "Paradise", "Grettle", "Gronston", "Grottler", "Throbber", "Febrielgus", "Silly", "Stuttgart", "Ronson", "Smellie", "Gagger", "Guzzler", "Anderson", "Blackwood"];

function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

// ---- Shared helpers for the drug / oversight systems (formerly re-declared per patch) ----
function actionsRoot(){
  return document.getElementById('actions') || document.getElementById('choices') || document.getElementById('choicesPanel') || document.body;
}
function moneyGBP(n){ return "£"+Number(Math.max(0,Math.round(n||0))).toLocaleString('en-GB'); }
function isInRehab(){ try{ return !!(S && S.suspensions && (S.suspensions.rehab_games|0) > 0); }catch(_){ return false; } }
function isInPrison(){ try{ return !!(S && S.suspensions && (S.suspensions.prison_games|0) > 0); }catch(_){ return false; } }
// Make sure the drug/addiction/suspension fields exist on S.
function ensureDrugCore(){
  window.S = window.S || {};
  const S = window.S;
  if (!S.inventory || typeof S.inventory !== 'object') S.inventory = { accolades: [], drugs: 0 };
  if (!Array.isArray(S.inventory.accolades)) S.inventory.accolades = [];
  if (typeof S.inventory.drugs !== 'number') S.inventory.drugs = 0;
  if (typeof S.drugs_unlocked !== 'boolean') S.drugs_unlocked = true;
  if (typeof S.drug_streak !== 'number') S.drug_streak = 0;
  if (typeof S.on_drugs_today !== 'boolean') S.on_drugs_today = false;
  if (!S.suspensions) S.suspensions = { rehab_games:0, prison_games:0, house_games:0 };
  if (typeof S.suspensions.prison_games !== 'number') S.suspensions.prison_games = 0;
  if (typeof S.suspensions.rehab_games !== 'number') S.suspensions.rehab_games = 0;
  if (!S.addictions || typeof S.addictions !== 'object') S.addictions = { people: {} };
  if (!S.record_simple) S.record_simple = {W:0,D:0,L:0};
  if (typeof S.fan_morale !== 'number') S.fan_morale = 60;
  if (typeof S.club_cash !== 'number') S.club_cash = 0;
  if (typeof S.chairman_cash !== 'number') S.chairman_cash = 0;
}




// --- MODERN MODAL SYSTEM ---
class ModernModal {
  constructor() {
    this.modal = null;
    this.resolve = null;
    this.reject = null;
  }

  show({ title, message, type = 'text', options = {} }) {
    return new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
      this.createModal({ title, message, type, options });
    });
  }

  createModal({ title, message, type, options }) {
    // Remove existing modal
    if (this.modal) {
      this.modal.remove();
    }

    this.modal = document.createElement('div');
    this.modal.className = 'modern-modal-overlay';
    this.modal.innerHTML = `
      <div class="modern-modal" role="dialog" aria-labelledby="modal-title" aria-describedby="modal-message">
        <div class="modal-header">
          <h3 id="modal-title">${title}</h3>
          <button class="modal-close" aria-label="Close modal">&times;</button>
        </div>
        <div class="modal-body">
          <p id="modal-message">${message}</p>
          <div class="modal-input-container">
            ${this.createInput(type, options)}
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary modal-cancel">Cancel</button>
          <button class="btn btn-primary modal-confirm">Confirm</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.modal);
    this.setupEventListeners(type, options);
    
    // Focus management
    const input = this.modal.querySelector('input, textarea');
    if (input) {
      setTimeout(() => input.focus(), 100);
    }
  }

  createInput(type, options) {
    const { min = 0, max = Number.POSITIVE_INFINITY, step = 1, defaultValue = "" } = options;
    
    if (type === 'number') {
      return `
        <input type="number" 
               class="modal-input" 
               min="${min}" 
               max="${max === Number.POSITIVE_INFINITY ? '' : max}" 
               step="${step}" 
               value="${defaultValue}"
               placeholder="Enter number">
      `;
    }
    
    return `
      <input type="text" 
             class="modal-input" 
             value="${defaultValue}"
             placeholder="Enter text">
    `;
  }

  setupEventListeners(type, options) {
    const input = this.modal.querySelector('input');
    const confirmBtn = this.modal.querySelector('.modal-confirm');
    const cancelBtn = this.modal.querySelector('.modal-cancel');
    const closeBtn = this.modal.querySelector('.modal-close');

    const handleConfirm = () => {
      const value = input.value;
      if (type === 'number') {
        const n = Number(value);
        if (!Number.isFinite(n)) {
          this.showError('Please enter a valid number');
          return;
        }
        const { min = 0, max = Number.POSITIVE_INFINITY, step = 1 } = options;
        const clamped = Math.max(min, Math.min(max, n));
        const stepped = Math.round(clamped / step) * step;
        this.resolve(stepped);
      } else {
        this.resolve(value);
      }
      this.close();
    };

    const handleCancel = () => {
      this.resolve(null);
      this.close();
    };

    const handleKeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    };

    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
    closeBtn.addEventListener('click', handleCancel);
    input.addEventListener('keydown', handleKeydown);
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) handleCancel();
    });
  }

  showError(message) {
    const errorEl = document.createElement('div');
    errorEl.className = 'modal-error';
    errorEl.textContent = message;
    
    const container = this.modal.querySelector('.modal-input-container');
    const existingError = container.querySelector('.modal-error');
    if (existingError) existingError.remove();
    
    container.appendChild(errorEl);
    setTimeout(() => errorEl.remove(), 3000);
  }

  close() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }
}

// Global modal instance
const modal = new ModernModal();

// --- PERFORMANCE OPTIMIZATIONS ---
class PerformanceOptimizer {
  constructor() {
    this.debounceTimers = new Map();
    this.throttleTimers = new Map();
    this.observers = new Map();
  }

  debounce(func, delay, key = 'default') {
    return (...args) => {
      if (this.debounceTimers.has(key)) {
        clearTimeout(this.debounceTimers.get(key));
      }
      const timer = setTimeout(() => {
        func.apply(this, args);
        this.debounceTimers.delete(key);
      }, delay);
      this.debounceTimers.set(key, timer);
    };
  }

  throttle(func, delay, key = 'default') {
    return (...args) => {
      if (!this.throttleTimers.has(key)) {
        func.apply(this, args);
        const timer = setTimeout(() => {
          this.throttleTimers.delete(key);
        }, delay);
        this.throttleTimers.set(key, timer);
      }
    };
  }

  createVirtualScroller(container, items, itemHeight = 50, renderItem) {
    const visibleCount = Math.ceil(container.clientHeight / itemHeight) + 2;
    let scrollTop = 0;
    let startIndex = 0;
    let endIndex = Math.min(startIndex + visibleCount, items.length);

    const updateVisibleItems = () => {
      const startY = startIndex * itemHeight;
      const endY = endIndex * itemHeight;
      
      container.innerHTML = '';
      container.style.height = `${items.length * itemHeight}px`;
      
      const visibleContainer = document.createElement('div');
      visibleContainer.style.position = 'relative';
      visibleContainer.style.height = `${(endIndex - startIndex) * itemHeight}px`;
      visibleContainer.style.transform = `translateY(${startY}px)`;
      
      for (let i = startIndex; i < endIndex; i++) {
        const item = renderItem(items[i], i);
        item.style.position = 'absolute';
        item.style.top = `${(i - startIndex) * itemHeight}px`;
        item.style.height = `${itemHeight}px`;
        visibleContainer.appendChild(item);
      }
      
      container.appendChild(visibleContainer);
    };

    const handleScroll = this.throttle((e) => {
      scrollTop = e.target.scrollTop;
      const newStartIndex = Math.floor(scrollTop / itemHeight);
      const newEndIndex = Math.min(newStartIndex + visibleCount, items.length);
      
      if (newStartIndex !== startIndex || newEndIndex !== endIndex) {
        startIndex = newStartIndex;
        endIndex = newEndIndex;
        updateVisibleItems();
      }
    }, 16, 'virtual-scroll');

    container.addEventListener('scroll', handleScroll);
    updateVisibleItems();

    return {
      updateItems: (newItems) => {
        items = newItems;
        updateVisibleItems();
      },
      destroy: () => {
        container.removeEventListener('scroll', handleScroll);
      }
    };
  }

  createIntersectionObserver(callback, options = {}) {
    const observer = new IntersectionObserver(callback, {
      rootMargin: '50px',
      threshold: 0.1,
      ...options
    });
    return observer;
  }

  batchDOMUpdates(updates) {
    requestAnimationFrame(() => {
      updates.forEach(update => update());
    });
  }
}

// Global performance optimizer
const perfOptimizer = new PerformanceOptimizer();

// --- ACCESSIBILITY ENHANCEMENTS ---
class AccessibilityManager {
  constructor() {
    this.focusTrap = null;
    this.announcer = null;
    this.keyboardNavigation = true;
    this.highContrast = false;
    this.fontSize = 'normal';
    this.init();
  }

  init() {
    this.createAnnouncer();
    this.setupKeyboardNavigation();
    this.setupFocusManagement();
  }

  createAnnouncer() {
    this.announcer = document.createElement('div');
    this.announcer.setAttribute('aria-live', 'polite');
    this.announcer.setAttribute('aria-atomic', 'true');
    this.announcer.style.position = 'absolute';
    this.announcer.style.left = '-10000px';
    this.announcer.style.width = '1px';
    this.announcer.style.height = '1px';
    this.announcer.style.overflow = 'hidden';
    document.body.appendChild(this.announcer);
  }

  announce(message) {
    if (this.announcer) {
      this.announcer.textContent = message;
    }
  }

  setupKeyboardNavigation() {
    document.addEventListener('keydown', (e) => {
      if (!this.keyboardNavigation) return;

      // Tab navigation enhancement
      if (e.key === 'Tab') {
        this.handleTabNavigation(e);
      }

      // Arrow key navigation for game actions
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        this.handleArrowNavigation(e);
      }

      // Enter key for buttons
      if (e.key === 'Enter' && e.target.tagName === 'BUTTON') {
        e.target.click();
      }

      // Escape key for modals
      if (e.key === 'Escape') {
        this.handleEscapeKey(e);
      }
    });
  }

  handleTabNavigation(e) {
    const focusableElements = this.getFocusableElements();
    const currentIndex = focusableElements.indexOf(document.activeElement);
    
    if (e.shiftKey) {
      // Shift + Tab (backward)
      if (currentIndex <= 0) {
        e.preventDefault();
        focusableElements[focusableElements.length - 1]?.focus();
      }
    } else {
      // Tab (forward)
      if (currentIndex >= focusableElements.length - 1) {
        e.preventDefault();
        focusableElements[0]?.focus();
      }
    }
  }

  handleArrowNavigation(e) {
    const actions = document.querySelectorAll('#actions button');
    const currentIndex = Array.from(actions).indexOf(document.activeElement);
    
    if (currentIndex === -1) return;

    let newIndex = currentIndex;
    const columns = Math.ceil(actions.length / 3); // Assume 3 rows max

    switch (e.key) {
      case 'ArrowUp':
        newIndex = Math.max(0, currentIndex - columns);
        break;
      case 'ArrowDown':
        newIndex = Math.min(actions.length - 1, currentIndex + columns);
        break;
      case 'ArrowLeft':
        newIndex = Math.max(0, currentIndex - 1);
        break;
      case 'ArrowRight':
        newIndex = Math.min(actions.length - 1, currentIndex + 1);
        break;
    }

    if (newIndex !== currentIndex) {
      e.preventDefault();
      actions[newIndex]?.focus();
    }
  }

  handleEscapeKey(e) {
    const modal = document.querySelector('.modern-modal-overlay');
    if (modal) {
      const closeBtn = modal.querySelector('.modal-close');
      closeBtn?.click();
    }
  }

  getFocusableElements() {
    const selector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    return Array.from(document.querySelectorAll(selector))
      .filter(el => !el.disabled && !el.hidden);
  }

  setupFocusManagement() {
    // Focus management for modals
    document.addEventListener('focusin', (e) => {
      const modal = e.target.closest('.modern-modal');
      if (modal) {
        this.trapFocus(modal);
      }
    });
  }

  trapFocus(container) {
    const focusableElements = this.getFocusableElements().filter(el => 
      container.contains(el)
    );
    
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    firstElement.focus();
  }


  toggleKeyboardNavigation() {
    this.keyboardNavigation = !this.keyboardNavigation;
    document.body.classList.toggle('keyboard-nav', this.keyboardNavigation);
    this.announce(`Keyboard navigation ${this.keyboardNavigation ? 'enabled' : 'disabled'}`);
  }

  enhanceButton(button, label) {
    if (!button.getAttribute('aria-label') && !button.textContent.trim()) {
      button.setAttribute('aria-label', label);
    }
    button.setAttribute('role', 'button');
    button.setAttribute('tabindex', '0');
  }

  enhanceInput(input, label) {
    if (!input.getAttribute('aria-label')) {
      input.setAttribute('aria-label', label);
    }
  }
}

// Global accessibility manager
const a11y = new AccessibilityManager();

// --- SOCIAL FEATURES & DATA VISUALIZATION ---
class SocialManager {
  constructor() {
    this.achievements = [];
    this.leaderboard = [];
    this.shareData = null;
  }

  async shareGameState() {
    if (!navigator.share) {
      // Fallback to clipboard
      const shareText = this.generateShareText();
      await navigator.clipboard.writeText(shareText);
      a11y.announce('Game state copied to clipboard');
      return;
    }

    try {
      await navigator.share({
        title: 'Southampton Chairman Sim Progress',
        text: this.generateShareText(),
        url: window.location.href
      });
    } catch (error) {
    }
  }

  generateShareText() {
    if (!window.S) return 'No game data to share';
    
    const stats = {
      season: window.S.season || 1,
      games: window.S.matches_played || 0,
      wins: window.S.W || 0,
      points: window.S.points || 0,
      cash: window.S.club_cash || 0
    };

    return `🏆 Southampton Chairman Sim Progress:
Season ${stats.season} | Games: ${stats.games} | W:${stats.wins} | Points: ${stats.points} | Cash: £${stats.cash.toLocaleString()}

Play at: ${window.location.href}`;
  }

  async saveScreenshot() {
    try {
      const canvas = await html2canvas(document.body, {
        backgroundColor: '#0b1220',
        scale: 0.5
      });
      
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `saints-chairman-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
      });
    } catch (error) {
      console.error('Screenshot failed:', error);
    }
  }

  checkAchievements() {
    if (!window.S) return;
    
    const newAchievements = [];
    
    // Financial achievements - only trigger for meaningful milestones
    if (window.S.club_cash >= 50000000 && !this.achievements.find(a => a.id === 'millionaire')) {
      newAchievements.push({
        id: 'millionaire',
        title: 'Millionaire',
        description: 'Reached £50M in club cash',
        icon: '💰'
      });
    }
    
    // Performance achievements
    if (window.S.points >= 100 && !this.achievements.find(a => a.id === 'century')) {
      newAchievements.push({
        id: 'century',
        title: 'Century',
        description: 'Reached 100 points in a season',
        icon: '💯'
      });
    }
    
    // Manager achievements
    if (window.S.manager_fires >= 5 && !this.achievements.find(a => a.id === 'trigger_happy')) {
      newAchievements.push({
        id: 'trigger_happy',
        title: 'Trigger Happy',
        description: 'Fired 5 managers',
        icon: '🔫'
      });
    }

    // One-time achievements
    if (window.S.on_drugs_today && !this.achievements.find(a => a.id === 'took_drugs')) {
      newAchievements.push({
        id: 'took_drugs',
        title: 'Took Drugs',
        description: 'Took drugs',
        icon: '💊'
      });
    }

    if (window.S.referee_assaulted && !this.achievements.find(a => a.id === 'assaulted_someone')) {
      newAchievements.push({
        id: 'assaulted_someone',
        title: 'Assaulted Someone',
        description: 'Assaulted someone',
        icon: '👊'
      });
    }

    if ((window.S.bribe_log && window.S.bribe_log.length > 0) && !this.achievements.find(a => a.id === 'bribed_someone')) {
      newAchievements.push({
        id: 'bribed_someone',
        title: 'Bribed Someone',
        description: 'Bribed someone',
        icon: '💰'
      });
    }

    if ((window.S.wins || 0) > 0 && !this.achievements.find(a => a.id === 'won_match')) {
      newAchievements.push({
        id: 'won_match',
        title: 'Won a Match',
        description: 'Won a match',
        icon: '🏆'
      });
    }

    if ((window.S.affair_count || 0) > 0 && !this.achievements.find(a => a.id === 'had_sex')) {
      newAchievements.push({
        id: 'had_sex',
        title: 'Had Sex',
        description: 'Had sex',
        icon: '💋'
      });
    }

    if ((window.S.pregnancies || 0) > 0 && !this.achievements.find(a => a.id === 'got_someone_pregnant')) {
      newAchievements.push({
        id: 'got_someone_pregnant',
        title: 'Got Someone Pregnant',
        description: 'Got someone pregnant',
        icon: '🤰'
      });
    }

    if (window.S.std_state === 'untreated' && !this.achievements.find(a => a.id === 'got_std')) {
      newAchievements.push({
        id: 'got_std',
        title: 'Got an STD',
        description: 'Got an STD',
        icon: '🦠'
      });
    }

    if (window.S.very_bad_std_state === 'infected' && !this.achievements.find(a => a.id === 'got_hiv')) {
      newAchievements.push({
        id: 'got_hiv',
        title: 'Got HIV',
        description: 'Got HIV (when you get a very bad STD)',
        icon: '🩸'
      });
    }

    if (window.S.videoWatching && !this.achievements.find(a => a.id === 'watched_pornography')) {
      newAchievements.push({
        id: 'watched_pornography',
        title: 'Watched Pornography',
        description: 'Watched pornography (when you watch a naughty video)',
        icon: '📹'
      });
    }

    if ((window.S.press && window.S.press.lawsuits && window.S.press.lawsuits.length > 0) && !this.achievements.find(a => a.id === 'defamed_someone')) {
      newAchievements.push({
        id: 'defamed_someone',
        title: 'Defamed Someone in the Press',
        description: 'Defamed someone in the press',
        icon: '📰'
      });
    }

    if (window.S.stadium_burned && !this.achievements.find(a => a.id === 'stadium_destroyed')) {
      newAchievements.push({
        id: 'stadium_destroyed',
        title: 'Stadium Destroyed by Terrorists',
        description: 'Stadium destroyed by terrorists (the fire incident)',
        icon: '🔥'
      });
    }

    if (window.S.matches_played >= (window.S.season_matches || 16) && (window.S.points || 0) >= Math.floor((window.S.season_matches || 16) * 2.1) && !this.achievements.find(a => a.id === 'won_premier_league')) {
      newAchievements.push({
        id: 'won_premier_league',
        title: 'Won the Premier League',
        description: 'Won the premier league',
        icon: '🏆'
      });
    }

    newAchievements.forEach(achievement => {
      this.showAchievement(achievement);
    });
  }

  showAchievement(achievement) {
    // Prevent showing the same achievement multiple times in a short period
    const achievementKey = `achievement_${achievement.id}_shown`;
    const lastShown = localStorage.getItem(achievementKey);
    const now = Date.now();
    
    if (lastShown && (now - parseInt(lastShown)) < 60000) { // 1 minute cooldown
      return;
    }
    
    localStorage.setItem(achievementKey, now.toString());
    
    const notification = document.createElement('div');
    notification.className = 'achievement-notification';
    notification.innerHTML = `
      <div class="achievement-content">
        <div class="achievement-icon">${achievement.icon}</div>
        <div class="achievement-text">
          <div class="achievement-title">${achievement.title}</div>
          <div class="achievement-desc">${achievement.description}</div>
        </div>
      </div>
    `;

    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => notification.classList.add('show'), 100);
    
    // Auto remove
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 4000);

    a11y.announce(`Achievement unlocked: ${achievement.title}`);
  }
}

class DataVisualization {
  constructor() {
    this.charts = new Map();
  }

  createFinancialChart(container, data) {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 200;
    container.appendChild(canvas);
    
    const ctx = canvas.getContext('2d');
    this.drawLineChart(ctx, data, {
      title: 'Financial Trend',
      xLabel: 'Time',
      yLabel: 'Cash (£)',
      color: '#60a5fa'
    });
  }

  createPerformanceChart(container, data) {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 200;
    container.appendChild(canvas);
    
    const ctx = canvas.getContext('2d');
    this.drawBarChart(ctx, data, {
      title: 'Season Performance',
      xLabel: 'Season',
      yLabel: 'Points',
      color: '#34d399'
    });
  }

  drawLineChart(ctx, data, options) {
    const { width, height } = ctx.canvas;
    const padding = 40;
    const chartWidth = width - 2 * padding;
    const chartHeight = height - 2 * padding;

    // Clear canvas
    ctx.fillStyle = 'var(--bg)';
    ctx.fillRect(0, 0, width, height);

    // Draw axes
    ctx.strokeStyle = 'var(--line)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

    if (data.length === 0) return;

    // Calculate scales
    const maxValue = Math.max(...data.map(d => d.value));
    const minValue = Math.min(...data.map(d => d.value));
    const valueRange = maxValue - minValue || 1;

    // Draw line
    ctx.strokeStyle = options.color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    data.forEach((point, index) => {
      const x = padding + (index / (data.length - 1)) * chartWidth;
      const y = height - padding - ((point.value - minValue) / valueRange) * chartHeight;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw points
    ctx.fillStyle = options.color;
    data.forEach((point, index) => {
      const x = padding + (index / (data.length - 1)) * chartWidth;
      const y = height - padding - ((point.value - minValue) / valueRange) * chartHeight;
      
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 2 * Math.PI);
      ctx.fill();
    });

    // Draw title
    ctx.fillStyle = 'var(--text)';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(options.title, width / 2, 20);
  }

  drawBarChart(ctx, data, options) {
    const { width, height } = ctx.canvas;
    const padding = 40;
    const chartWidth = width - 2 * padding;
    const chartHeight = height - 2 * padding;

    // Clear canvas
    ctx.fillStyle = 'var(--bg)';
    ctx.fillRect(0, 0, width, height);

    // Draw axes
    ctx.strokeStyle = 'var(--line)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

    if (data.length === 0) return;

    // Calculate scales
    const maxValue = Math.max(...data.map(d => d.value));
    const barWidth = chartWidth / data.length * 0.8;

    // Draw bars
    data.forEach((point, index) => {
      const x = padding + (index / data.length) * chartWidth + (chartWidth / data.length - barWidth) / 2;
      const barHeight = (point.value / maxValue) * chartHeight;
      const y = height - padding - barHeight;

      ctx.fillStyle = options.color;
      ctx.fillRect(x, y, barWidth, barHeight);

      // Draw value label
      ctx.fillStyle = 'var(--text)';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(point.value.toString(), x + barWidth / 2, y - 5);
    });

    // Draw title
    ctx.fillStyle = 'var(--text)';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(options.title, width / 2, 20);
  }
}

// Global instances
const socialManager = new SocialManager();
const dataViz = new DataVisualization();

// --- MODERN PROMPT HELPERS ---
function promptNumber(message, options = {}) {
  return modal.show({
    title: 'Enter Number',
    message: message,
    type: 'number',
    options: options
  });
}



function ensureFamilyNames(){
  const ln = (S.player_surname && S.player_surname.trim()) ? S.player_surname : pick(SURNAMES);

  // Wife
  if(!S.wife_name || !S.wife_name.trim()){
    S.wife_name = pick(FEMALE_NAMES) + " " + ln;
  } else if(!S.wife_name.endsWith(" " + ln)){
    const parts = S.wife_name.split(" ");
    parts[parts.length-1] = ln;
    S.wife_name = parts.join(" ");
  }

  // Children: force one son, one daughter
  if(!S.child1_name || !S.child1_name.trim()){
    S.child1_name = pick(MALE_NAMES) + " " + ln + " (son)";
  }
  if(!S.child2_name || !S.child2_name.trim()){
    S.child2_name = pick(FEMALE_NAMES) + " " + ln + " (daughter)";
  }

  if(!S.wives_count) S.wives_count = 1;
  if(!S.kids_count)  S.kids_count  = 2;
}
function addMoneyPersonal(amount){ S.chairman_cash = Math.max(0,(S.chairman_cash||0) + amount); }
function addMoneyClub(amount){     
  S.club_cash = Math.max(0,(S.club_cash||0) + amount); 
  try {
    if (!S.influence_policy) S.influence_policy = "standard";
    if (typeof S.lobby_tokens !== "number") S.lobby_tokens = 0;

    // Derive a simple policy multiplier
    let mult = 1;
    switch (S.influence_policy) {
      case "frugal":    mult = 0.5; break;
      case "standard":  mult = 1.0; break;
      case "aggressive":mult = 2.0; break;
      case "obsessed":  mult = 3.0; break;
      default:          mult = 1.0; break;
    }

    // Only skim a tiny slice of positive flows into Lobby Tokens
    if (amount > 0 && mult > 0) {
      const base = Math.floor(amount / 200000); // £200k ~= 1 token baseline
      const gained = Math.floor(base * mult);
      if (gained > 0) {
        S.lobby_tokens = (S.lobby_tokens|0) + gained;
        // Power heat rises a little any time you visibly divert cash into "donations"
        S.power_heat = Math.min(100, (S.power_heat|0) + (mult >= 2 ? 2 : 1));
      }
    }
  } catch(e){
    console.warn("Lobby token skim error:", e);
  }
}

// Helper function to add lobby tokens with logging
function addLobbyTokens(amount, reason) {
  if (!amount || amount <= 0) return;
  
  // Cap at 50 tokens per action
  const tokensToAdd = Math.min(amount, 50);
  
  // Initialize if needed
  if (typeof S.lobby_tokens !== "number") S.lobby_tokens = 0;
  
  const previousTotal = S.lobby_tokens;
  S.lobby_tokens = S.lobby_tokens + tokensToAdd;
  
  // Log the lobby token award
  log(`🎮 LOBBY TOKENS: +${tokensToAdd} (${reason || 'action'})`);
  log(`🎮 Total lobby tokens: ${previousTotal} → ${S.lobby_tokens}`);
  
  // Update HUD if function exists
  if (typeof updateHUD === 'function') {
    updateHUD();
  }
}

function mountPlayArea(){
  var dlg = document.getElementById('dialoguePanel');
  var cho = document.getElementById('choicesPanel');
  var logShell = document.getElementById('log');
  var feed = document.getElementById('feed');
  var actions = document.getElementById('actions');
  var footer = logShell ? logShell.querySelector('footer') : null;

  if (dlg && feed && feed.parentNode !== dlg) dlg.appendChild(feed);
  if (cho && actions && actions.parentNode !== cho) cho.appendChild(actions);
  if (dlg && footer && footer.parentNode !== dlg) dlg.appendChild(footer);

  if (logShell) logShell.style.display = 'none';
}
const fmt = (n)=>Number(n).toLocaleString('en-GB'); // optional; you already have money()


async function ensureSecretaryHired(){
  if(S.secretary_hired) return;
  if (typeof chooseSecretaryQuickHire === "function"){
    await chooseSecretaryQuickHire();
  }
}
function rng(n){ return Math.floor(Math.random()*n); }
function roll(min,max){ return min + Math.floor(Math.random()*(max-min+1)); }
if (typeof pick !== "function") { function pick(arr){ return arr[rng(arr.length)]; } }
function cryptoRandomId(){ return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function incrementRisk(reason, amt=1){
  S.police_risk = Math.max(0, (S.police_risk||0) + amt);
  // Optional: surface subtle hints only when high
  if(S.police_risk >= 8){ log("Rumors swirl: authorities are watching closely."); }
}

// SAFETY: random array picker (guarded so we don't double-define)
if (typeof window.pick !== 'function') {
  window.pick = function (arr) {
    if (!Array.isArray(arr) || arr.length === 0) return undefined;
    return arr[Math.floor(Math.random() * arr.length)];
  };
}

// --- Lightweight global world / relationship helpers (branchy flavour only) ---
function ensureWorldState(){
  if (!window.S) return;
  if (!S.worldFlags) {
    S.worldFlags = {
      corruptionScore: 0,
      refereeScandalActive: false,
      refereeScandalBranch: null,
      mediaScandal: false,
      sexWithSecretary: false,
      lastBribedRefId: null,
      transferVendettas: {},
      journalistEnemies: {}
    };
  }
  if (!S.relationships || typeof S.relationships !== 'object') {
    S.relationships = { fa: 0, media: 0, ultras: 0, board: 0 };
  }
  if (!S.secretaryState || typeof S.secretaryState !== 'object') {
    S.secretaryState = { loyalty: 0.5, resentment: 0, romance: 0, criminalBond: 0 };
  }
  if (!S.rivalStates || typeof S.rivalStates !== 'object') {
    S.rivalStates = {};
  }
  if (!Array.isArray(S.pendingWorldEvents)) {
    S.pendingWorldEvents = [];
  }
}

function getWorldFlags(){
  ensureWorldState();
  return S.worldFlags;
}

function getRelationships(){
  ensureWorldState();
  return S.relationships;
}

function adjustRelationship(target, delta){
  const rel = getRelationships();
  if (!Object.prototype.hasOwnProperty.call(rel, target)) return;
  rel[target] += delta;
}

function setWorldFlag(key, value){
  const wf = getWorldFlags();
  if (Object.prototype.hasOwnProperty.call(wf, key)) {
    wf[key] = value;
  }
}

function scheduleWorldEvent(type, delayMatches, data){
  if (!window.S) return;
  ensureWorldState();
  const current = S.matches_played | 0;
  const when = current + Math.max(1, (delayMatches | 0) || 1);
  S.pendingWorldEvents.push({
    match: when,
    type,
    data: data || {}
  });
}

async function processWorldEvents(){
  if (!window.S) return;
  ensureWorldState();
  const current = S.matches_played | 0;
  const queue = Array.isArray(S.pendingWorldEvents) ? S.pendingWorldEvents : [];
  const due = queue.filter(ev => (ev && (ev.match || 0) <= current));
  S.pendingWorldEvents = queue.filter(ev => !ev || (ev.match || 0) > current);
  for (const ev of due){
    try{
      await handleWorldEvent(ev);
    }catch(e){
      console.error && console.error('Error in world event', e, ev);
    }
  }
}

async function handleWorldEvent(ev){
  const wf = getWorldFlags();
  const rel = getRelationships();
  switch(ev.type){
    case 'refereeShortFallout':
      await handleRefereeShortFallout(ev, wf, rel);
      break;
    case 'refereeBranchChoice':
      await handleRefereeBranchChoice(ev, wf, rel);
      break;
    case 'refereeBranchFollow_deny':
    case 'refereeBranchFollow_doubleDown':
    case 'refereeBranchFollow_confess':
      await handleRefereeBranchFollow(ev, wf, rel);
      break;
    case 'secretarySexFallout':
      await handleSecretarySexFallout(ev, wf, rel);
      break;
    case 'journalistVendettaStart':
    case 'journalistHitPiece':
      await handleJournalistVendettaEvent(ev, wf, rel);
      break;
    case 'transferVendetta':
      await handleTransferVendettaEvent(ev, wf, rel);
      break;
    default:
      // Unknown world event – safely ignore
      break;
  }
}

// --- Referee bribery → scandal short fallout ---
async function handleRefereeShortFallout(ev, wf, rel){
  const side = ev && ev.data && ev.data.side ? ev.data.side : 'us';
  const currentWeek = S.matches_played | 0;
  const snippets = [
    "Whispers circulate that today’s referee has suddenly upgraded his kitchen to \"Dubai marble\".",
    "A disgruntled linesman is overheard muttering about \"envelopes\" and \"South Coast hospitality\".",
    "Local radio phone‑in spends three hours on whether today’s ref winked at your technical area.",
    "Mystery man in a suit spotted handing over a Sports Direct bag outside the officials’ entrance."
  ];
  log(pick(snippets));
  if (typeof addPaper === 'function'){
    addPaper('FA sources: \"Quiet inquiries\" into Southampton match officials', 10);
  }
  // Nudge relationships – FA suspicious, ultras delighted by shithousery
  adjustRelationship('fa', -1);
  adjustRelationship('ultras', +1);
  wf.corruptionScore = (wf.corruptionScore || 0) + 1;
  wf.lastBribedRefId = wf.lastBribedRefId || ('ref_match_' + currentWeek + '_' + side);

  // Chance that the inquiry becomes an on‑the‑record scandal that forces a stance
  if (!wf.refereeScandalActive && Math.random() < 0.4){
    scheduleWorldEvent('refereeBranchChoice', 1 + Math.floor(Math.random()*2), { source: 'quietInquiry' });
  } else if (wf.refereeScandalActive && wf.refereeScandalBranch){
    // Already in a scandal arc – schedule another beat in the same branch
    scheduleWorldEvent('refereeBranchFollow_' + wf.refereeScandalBranch, 2 + Math.floor(Math.random()*3), { from: 'quietInquiry' });
  }
}

// Let the player decide how to spin the referee scandal once it breaks properly
async function handleRefereeBranchChoice(ev, wf, rel){
  if (wf.refereeScandalBranch){
    // Already chosen; nothing to do
    return;
  }
  const prompt = 'Back pages explode: \"REFEREE PAYOFF SHOCK ON SOUTH COAST\".\nHow do you respond?';
  const choice = await choose([
    { key:'deny',       label:'Deny everything and blame \"rogue elements\"', variant:'warn' },
    { key:'doubleDown', label:'Double down – accuse the FA of a witch hunt', variant:'bad' },
    { key:'confess',    label:'Confess tearfully on live TV', variant:'sensual' }
  ], prompt);
  if (!choice) return;

  wf.refereeScandalActive = true;
  wf.refereeScandalBranch = choice;

  if (choice === 'deny'){
    adjustRelationship('media', -1);
    adjustRelationship('fa', -1);
    if (typeof addPaper === 'function'){
      addPaper('Chairman issues furious denial over referee allegations', 14);
    }
    log('Fans chant “WE WANT JUSTICE!” while you pretend not to hear.');
  } else if (choice === 'doubleDown'){
    adjustRelationship('ultras', +3);
    adjustRelationship('fa', -2);
    if (typeof addPaper === 'function'){
      addPaper('Chairman brands FA \"corrupt cartel\" in astonishing presser', 18);
    }
    log('A new banner appears in the home end: “INTEGRITY IS FOR RELEGATED CLUBS”.');
  } else if (choice === 'confess'){
    adjustRelationship('fa', +1);
    adjustRelationship('board', -2);
    setWorldFlag('mediaScandal', true);
    if (typeof addPaper === 'function'){
      addPaper('Tearful confession: Southampton chairman admits bribing officials', 20);
    }
    log('Local MP goes on breakfast TV to call your honesty “refreshing and deeply worrying”.');
  }

  // Schedule a branch‑specific follow‑up beat
  scheduleWorldEvent('refereeBranchFollow_' + choice, 2 + Math.floor(Math.random()*3), { firstBeat:true });
}

async function handleRefereeBranchFollow(ev, wf, rel){
  const branch = wf.refereeScandalBranch || (
    ev.type === 'refereeBranchFollow_deny' ? 'deny' :
    ev.type === 'refereeBranchFollow_doubleDown' ? 'doubleDown' :
    ev.type === 'refereeBranchFollow_confess' ? 'confess' : null
  );
  if (!branch) return;

  const corruption = wf.corruptionScore || 0;

  if (branch === 'deny'){
    log('Tabloids double‑spread: “IF HE’S INNOCENT, WHY IS HE SO SWEATY?”');
    adjustRelationship('media', -1);
    S.compliance_risk = clamp((S.compliance_risk || 0) + 4, 0, 100);
    if (corruption > 3 && Math.random() < 0.4){
      if (typeof addPaper === 'function'){
        addPaper('Parliamentary committee moots lifetime ban for \"serial cheats\"', 22);
      }
      log('A backbench MP discovers a love of camera time at your expense.');
    }
  } else if (branch === 'doubleDown'){
    log('Your most deranged supporters unfurl a tifosi of you handing a brown envelope to God.');
    adjustRelationship('ultras', +1);
    adjustRelationship('fa', -1);
    S.fa_risk = clamp((S.fa_risk || 0) + 6, 0, 100);
    if (typeof addPaper === 'function'){
      addPaper('Referees’ union threatens walk‑out over “toxic abuse from Southampton hierarchy”', 19);
    }
  } else if (branch === 'confess'){
    log('Players look at you differently in the tunnel. Not better. Just differently.');
    adjustRelationship('board', -1);
    S.morale = clamp((S.morale || 0) - 3, -100, 100);
    if (typeof addPaper === 'function'){
      addPaper('Sponsors quietly pause \"values‑led\" partnership with club', 16);
    }
  }

  // Low‑rate long tail while corruption stays high
  if (corruption > 4 && Math.random() < 0.25){
    scheduleWorldEvent('refereeBranchFollow_' + branch, 3 + Math.floor(Math.random()*4), { from:'longTail' });
  }
}

// --- Sex / relationships fallout ---
async function handleSecretarySexFallout(ev, wf, rel){
  const partnerName = (ev && ev.data && ev.data.partnerName) || 'your secretary';
  const role = (ev && ev.data && ev.data.role) || 'Secretary';

  setWorldFlag('mediaScandal', true);
  adjustRelationship('media', +1);
  adjustRelationship('board', -2);

  if (typeof addPaper === 'function'){
    addPaper(`Affair allegations: Chairman and ${role.toLowerCase()} spotted in executive box`, 15);
  }
  log(`Rumours swirl that you and ${partnerName} have been “working late on set‑pieces” in the office.`);

  // Secretary’s internal state shifts depending on how criminal this feels
  ensureWorldState();
  S.secretaryState.romance = (S.secretaryState.romance || 0) + 0.2;
  S.secretaryState.criminalBond = (S.secretaryState.criminalBond || 0) + 0.1;

  // One‑off terrace reaction
  if (Math.random() < 0.6){
    log('Matchday soundtrack: “HE SH*GS WHO HE WANTS” echoing from the away end for 90 straight minutes.');
  }
}

// --- Journalist vendetta after being insulted in a presser ---
async function handleJournalistVendettaEvent(ev, wf, rel){
  ensureWorldState();
  wf.journalistEnemies = wf.journalistEnemies || {};
  const journoId = (ev && ev.data && ev.data.journoId) || 'local_hack';

  if (ev.type === 'journalistVendettaStart'){
    const untilWeek = (S.matches_played | 0) + 6;
    wf.journalistEnemies[journoId] = { vendetta:true, untilWeek };
    adjustRelationship('media', -2);
    adjustRelationship('ultras', +2);
    if (typeof addPaper === 'function'){
      addPaper('Local journalist vows to \"hold grotesque chairman to account\"', 11);
    }
    log('Back at the pub, the ultras are already printing a tifo of you calling him a clown.');

    // Queue a few hit pieces over the next run of matches
    const beats = 3 + Math.floor(Math.random()*2);
    for (let i = 1; i <= beats; i++){
      scheduleWorldEvent('journalistHitPiece', i, { journoId, index: i });
    }
    return;
  }

  // Hit piece beat
  const idx = ev.data && ev.data.index || 1;
  const line = idx === 1
    ? 'Column today: \"SOUTHAMPTON CHAIRMAN A DANGER TO DEMOCRACY AND BASIC ETIQUETTE\".'
    : idx === 2
    ? 'Feature piece describes you as \"a man who looks like he Googles himself during penalties\".'
    : 'Sunday supplement runs a photo of you eating a pie under the headline “CORRUPTION IN ITS FINAL FORM”.';
  log(line);
  adjustRelationship('media', -1);

  if (typeof addPaper === 'function' && Math.random() < 0.5){
    addPaper('Media pile‑on continues over chairman’s bizarre press antics', 9);
  }

  // Occasionally, the vendetta causes real‑world trouble
  if (Math.random() < 0.25){
    log('A masked supporter \"accidentally\" barges the journalist down the tunnel steps. An inquiry is opened.');
    S.police_risk = clamp((S.police_risk || 0) + 5, 0, 100);
    adjustRelationship('fa', -1);
  }
}

// --- Rival / transfer vendetta beat ---
async function handleTransferVendettaEvent(ev, wf, rel){
  const clubId = ev && ev.data && ev.data.clubId;
  if (!clubId) return;
  const vendetta = wf.transferVendettas && wf.transferVendettas[clubId];
  const anger = vendetta && typeof vendetta.anger === 'number' ? vendetta.anger : 1;

  if (anger >= 3){
    log(`${clubId} are openly briefing that your recent transfers smell \"state‑sponsored\".`);
    S.compliance_risk = clamp((S.compliance_risk || 0) + 4, 0, 100);
    adjustRelationship('fa', -1);
    if (typeof addPaper === 'function'){
      addPaper(`${clubId} sources hint at \"systemic match‑fixing\" in Premier League corridors`, 17);
    }
  } else {
    log(`${clubId} chairman is spotted in a Sky Sports segment archly raising an eyebrow about your transfer dealings.`);
    if (typeof addPaper === 'function' && Math.random() < 0.5){
      addPaper(`${clubId} grumble about being \"asset‑stripped\" by Southampton`, 8);
    }
  }

  // Low chance to keep the feud simmering
  if (anger > 1 && Math.random() < 0.35){
    scheduleWorldEvent('transferVendetta', 3 + Math.floor(Math.random()*3), { clubId });
  }
}

function clamp(n, lo, hi){ return Math.max(lo, Math.min(hi, n)); }



const POSITIONS = ["GK","DF","MF","FW"];

// Special real-world players that can occasionally appear in transfer market
const SPECIAL_PLAYERS = [
  {name: "Cristiano Ronaldo", pos: "FW", rating: 100, price: 5000000, wage: 3000, tier: "legendary", noUnpaid: true},
  {name: "Lionel Messi", pos: "FW", rating: 100, price: 5000000, wage: 3000, tier: "legendary", noUnpaid: true},
  {name: "Terry Butterworth", pos: "FW", rating: 99, price: 4500000, wage: 2800, tier: "legendary"},
  {name: "Ronaldo Nazário", pos: "FW", rating: 98, price: 1800000, wage: 1300, tier: "legendary"},
  {name: "Kylian Mbappé", pos: "FW", rating: 96, price: 1600000, wage: 1200, tier: "legendary"},
  {name: "Erling Haaland", pos: "FW", rating: 95, price: 1500000, wage: 1100, tier: "legendary"},
  {name: "Harry Kane", pos: "FW", rating: 92, price: 1200000, wage: 1000, tier: "elite"},
  {name: "Kevin De Bruyne", pos: "MF", rating: 94, price: 1400000, wage: 1000, tier: "elite"},
  {name: "Virgil van Dijk", pos: "DF", rating: 93, price: 1300000, wage: 950, tier: "elite"},
  {name: "Manuel Neuer", pos: "GK", rating: 92, price: 1200000, wage: 900, tier: "elite"},
  {name: "Luka Modrić", pos: "MF", rating: 91, price: 1100000, wage: 850, tier: "elite"},
  {name: "Robert Lewandowski", pos: "FW", rating: 90, price: 1000000, wage: 800, tier: "elite"},
  {name: "Neymar Jr", pos: "FW", rating: 89, price: 95000, wage: 750, tier: "elite"},
  {name: "Sergio Ramos", pos: "DF", rating: 88, price: 90000, wage: 700, tier: "elite"},
  {name: "Gareth Bale", pos: "MF", rating: 87, price: 85000, wage: 650, tier: "elite"},
  {name: "Eden Hazard", pos: "MF", rating: 86, price: 80000, wage: 600, tier: "excellent"},
  {name: "Paul Pogba", pos: "MF", rating: 85, price: 75000, wage: 550, tier: "excellent"},
  {name: "Antoine Griezmann", pos: "FW", rating: 84, price: 70000, wage: 500, tier: "excellent"},
  {name: "Raheem Sterling", pos: "FW", rating: 83, price: 65000, wage: 450, tier: "excellent"},
  // Premier League Legends & Stars (2000-present)
  {name: "Thierry Henry", pos: "FW", rating: 95, price: 1400000, wage: 1100, tier: "legendary"},
  {name: "Wayne Rooney", pos: "FW", rating: 93, price: 1250000, wage: 1000, tier: "elite"},
  {name: "Steven Gerrard", pos: "MF", rating: 92, price: 1200000, wage: 950, tier: "elite"},
  {name: "Frank Lampard", pos: "MF", rating: 91, price: 1150000, wage: 900, tier: "elite"},
  {name: "John Terry", pos: "DF", rating: 90, price: 1100000, wage: 850, tier: "elite"},
  {name: "Rio Ferdinand", pos: "DF", rating: 89, price: 1050000, wage: 800, tier: "elite"},
  {name: "David Beckham", pos: "MF", rating: 88, price: 1000000, wage: 750, tier: "elite"},
  {name: "Alan Shearer", pos: "FW", rating: 92, price: 1200000, wage: 950, tier: "elite"},
  {name: "Paul Scholes", pos: "MF", rating: 91, price: 1150000, wage: 900, tier: "elite"},
  {name: "Ryan Giggs", pos: "MF", rating: 90, price: 1100000, wage: 850, tier: "elite"},
  {name: "Patrick Vieira", pos: "MF", rating: 89, price: 1050000, wage: 800, tier: "elite"},
  {name: "Dennis Bergkamp", pos: "FW", rating: 91, price: 1150000, wage: 900, tier: "elite"},
  {name: "Roy Keane", pos: "MF", rating: 88, price: 1000000, wage: 750, tier: "elite"},
  {name: "Sol Campbell", pos: "DF", rating: 87, price: 95000, wage: 700, tier: "elite"},
  {name: "Ashley Cole", pos: "DF", rating: 86, price: 90000, wage: 650, tier: "excellent"},
  {name: "Gary Neville", pos: "DF", rating: 85, price: 85000, wage: 600, tier: "excellent"},
  {name: "Jamie Carragher", pos: "DF", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Michael Owen", pos: "FW", rating: 88, price: 1000000, wage: 750, tier: "elite"},
  {name: "Fernando Torres", pos: "FW", rating: 87, price: 95000, wage: 700, tier: "elite"},
  {name: "Didier Drogba", pos: "FW", rating: 89, price: 1050000, wage: 800, tier: "elite"},
  {name: "Cesc Fàbregas", pos: "MF", rating: 88, price: 1000000, wage: 750, tier: "elite"},
  {name: "Robin van Persie", pos: "FW", rating: 87, price: 95000, wage: 700, tier: "elite"},
  {name: "Luis Suárez", pos: "FW", rating: 90, price: 1100000, wage: 850, tier: "elite"},
  {name: "Sergio Agüero", pos: "FW", rating: 91, price: 1150000, wage: 900, tier: "elite"},
  {name: "Yaya Touré", pos: "MF", rating: 88, price: 1000000, wage: 750, tier: "elite"},
  {name: "David Silva", pos: "MF", rating: 89, price: 1050000, wage: 800, tier: "elite"},
  {name: "Vincent Kompany", pos: "DF", rating: 87, price: 95000, wage: 700, tier: "elite"},
  {name: "Petr Čech", pos: "GK", rating: 90, price: 1100000, wage: 850, tier: "elite"},
  {name: "Edwin van der Sar", pos: "GK", rating: 89, price: 1050000, wage: 800, tier: "elite"},
  {name: "Gianluigi Buffon", pos: "GK", rating: 92, price: 1200000, wage: 950, tier: "elite"},
  {name: "Mohamed Salah", pos: "FW", rating: 93, price: 1250000, wage: 1000, tier: "elite"},
  {name: "Sadio Mané", pos: "FW", rating: 90, price: 1100000, wage: 850, tier: "elite"},
  {name: "Roberto Firmino", pos: "FW", rating: 86, price: 90000, wage: 650, tier: "excellent"},
  {name: "Philippe Coutinho", pos: "MF", rating: 87, price: 95000, wage: 700, tier: "elite"},
  {name: "Jordan Henderson", pos: "MF", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "James Milner", pos: "MF", rating: 82, price: 70000, wage: 500, tier: "excellent"},
  {name: "Trent Alexander-Arnold", pos: "DF", rating: 88, price: 1000000, wage: 750, tier: "elite"},
  {name: "Andrew Robertson", pos: "DF", rating: 85, price: 85000, wage: 600, tier: "excellent"},
  {name: "Alisson", pos: "GK", rating: 91, price: 1150000, wage: 900, tier: "elite"},
  {name: "Son Heung-min", pos: "FW", rating: 89, price: 1050000, wage: 800, tier: "elite"},
  {name: "Bukayo Saka", pos: "FW", rating: 87, price: 95000, wage: 700, tier: "elite"},
  {name: "Phil Foden", pos: "MF", rating: 88, price: 1000000, wage: 750, tier: "elite"},
  {name: "Jude Bellingham", pos: "MF", rating: 90, price: 1100000, wage: 850, tier: "elite"},
  {name: "Declan Rice", pos: "MF", rating: 86, price: 90000, wage: 650, tier: "excellent"},
  {name: "Jack Grealish", pos: "MF", rating: 85, price: 85000, wage: 600, tier: "excellent"},
  {name: "Marcus Rashford", pos: "FW", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Mason Mount", pos: "MF", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "Jadon Sancho", pos: "FW", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Reece James", pos: "DF", rating: 85, price: 85000, wage: 600, tier: "excellent"},
  {name: "Ben Chilwell", pos: "DF", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "Kyle Walker", pos: "DF", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "John Stones", pos: "DF", rating: 85, price: 85000, wage: 600, tier: "excellent"},
  {name: "Harry Maguire", pos: "DF", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Luke Shaw", pos: "DF", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Jordan Pickford", pos: "GK", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "Aaron Ramsdale", pos: "GK", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Nick Pope", pos: "GK", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Emiliano Martínez", pos: "GK", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Ederson", pos: "GK", rating: 89, price: 1050000, wage: 800, tier: "elite"},
  {name: "David de Gea", pos: "GK", rating: 87, price: 95000, wage: 700, tier: "elite"},
  {name: "Hugo Lloris", pos: "GK", rating: 85, price: 85000, wage: 600, tier: "excellent"},
  {name: "Thibaut Courtois", pos: "GK", rating: 90, price: 1100000, wage: 850, tier: "elite"},
  {name: "N'Golo Kanté", pos: "MF", rating: 88, price: 1000000, wage: 750, tier: "elite"},
  {name: "Nemanja Matić", pos: "MF", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Mousa Dembélé", pos: "MF", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "Moussa Sissoko", pos: "MF", rating: 78, price: 50000, wage: 350, tier: "average"},
  {name: "Christian Eriksen", pos: "MF", rating: 86, price: 90000, wage: 650, tier: "excellent"},
  {name: "Dele Alli", pos: "MF", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Eric Dier", pos: "DF", rating: 79, price: 55000, wage: 380, tier: "average"},
  {name: "Danny Rose", pos: "DF", rating: 80, price: 60000, wage: 420, tier: "average"},
  {name: "Kieran Trippier", pos: "DF", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "Danny Welbeck", pos: "FW", rating: 76, price: 45000, wage: 300, tier: "mediocre"},
  {name: "Theo Walcott", pos: "FW", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Alex Oxlade-Chamberlain", pos: "MF", rating: 79, price: 55000, wage: 380, tier: "average"},
  {name: "Calum Chambers", pos: "DF", rating: 75, price: 40000, wage: 280, tier: "mediocre"},
  {name: "Jack Wilshere", pos: "MF", rating: 80, price: 60000, wage: 420, tier: "average"},
  {name: "Aaron Ramsey", pos: "MF", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Gareth Barry", pos: "MF", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "James Milner", pos: "MF", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Glen Johnson", pos: "DF", rating: 78, price: 50000, wage: 350, tier: "average"},
  {name: "Jermain Defoe", pos: "FW", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "Peter Crouch", pos: "FW", rating: 78, price: 50000, wage: 350, tier: "average"},
  {name: "Robbie Keane", pos: "FW", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Dimitar Berbatov", pos: "FW", rating: 85, price: 85000, wage: 600, tier: "excellent"},
  {name: "Carlos Tevez", pos: "FW", rating: 86, price: 90000, wage: 650, tier: "excellent"},
  {name: "Robinho", pos: "FW", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Elano", pos: "MF", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Yaya Touré", pos: "MF", rating: 88, price: 1000000, wage: 750, tier: "elite"},
  {name: "Samir Nasri", pos: "MF", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "Emmanuel Adebayor", pos: "FW", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Gervinho", pos: "FW", rating: 79, price: 55000, wage: 380, tier: "average"},
  {name: "Marouane Chamakh", pos: "FW", rating: 76, price: 45000, wage: 300, tier: "mediocre"},
  {name: "Olivier Giroud", pos: "FW", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "Mesut Özil", pos: "MF", rating: 87, price: 95000, wage: 700, tier: "elite"},
  {name: "Alexis Sánchez", pos: "FW", rating: 88, price: 1000000, wage: 750, tier: "elite"},
  {name: "Santi Cazorla", pos: "MF", rating: 85, price: 85000, wage: 600, tier: "excellent"},
  {name: "Mikel Arteta", pos: "MF", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Per Mertesacker", pos: "DF", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "Laurent Koscielny", pos: "DF", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Bacary Sagna", pos: "DF", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Nacho Monreal", pos: "DF", rating: 80, price: 60000, wage: 420, tier: "average"},
  {name: "Wojciech Szczęsny", pos: "GK", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Lukasz Fabianski", pos: "GK", rating: 78, price: 50000, wage: 350, tier: "average"},
  {name: "Petr Čech", pos: "GK", rating: 90, price: 1100000, wage: 850, tier: "elite"},
  {name: "Gary Cahill", pos: "DF", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "Branislav Ivanović", pos: "DF", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "César Azpilicueta", pos: "DF", rating: 85, price: 85000, wage: 600, tier: "excellent"},
  {name: "Marcos Alonso", pos: "DF", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "N'Golo Kanté", pos: "MF", rating: 88, price: 1000000, wage: 750, tier: "elite"},
  {name: "Mateo Kovačić", pos: "MF", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Jorginho", pos: "MF", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "Mason Mount", pos: "MF", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "Kai Havertz", pos: "FW", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Timo Werner", pos: "FW", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Romelu Lukaku", pos: "FW", rating: 86, price: 90000, wage: 650, tier: "excellent"},
  {name: "Álvaro Morata", pos: "FW", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Diego Costa", pos: "FW", rating: 85, price: 85000, wage: 600, tier: "excellent"},
  {name: "Eden Hazard", pos: "MF", rating: 86, price: 90000, wage: 650, tier: "excellent"},
  {name: "Juan Mata", pos: "MF", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Oscar", pos: "MF", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "Willian", pos: "FW", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Pedro", pos: "FW", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "André Schürrle", pos: "FW", rating: 80, price: 60000, wage: 420, tier: "average"},
  {name: "Fernando Torres", pos: "FW", rating: 87, price: 95000, wage: 700, tier: "elite"},
  {name: "Andy Carroll", pos: "FW", rating: 77, price: 48000, wage: 330, tier: "mediocre"},
  {name: "Stewart Downing", pos: "MF", rating: 78, price: 50000, wage: 350, tier: "average"},
  {name: "Joe Cole", pos: "MF", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Ashley Young", pos: "MF", rating: 80, price: 60000, wage: 420, tier: "average"},
  {name: "Antonio Valencia", pos: "DF", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "Nani", pos: "MF", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Anderson", pos: "MF", rating: 79, price: 55000, wage: 380, tier: "average"},
  {name: "Darren Fletcher", pos: "MF", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Michael Carrick", pos: "MF", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Owen Hargreaves", pos: "MF", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Dimitar Berbatov", pos: "FW", rating: 85, price: 85000, wage: 600, tier: "excellent"},
  {name: "Carlos Tevez", pos: "FW", rating: 86, price: 90000, wage: 650, tier: "excellent"},
  {name: "Patrice Evra", pos: "DF", rating: 85, price: 85000, wage: 600, tier: "excellent"},
  {name: "Nemanja Vidić", pos: "DF", rating: 88, price: 1000000, wage: 750, tier: "elite"},
  {name: "Edwin van der Sar", pos: "GK", rating: 89, price: 1050000, wage: 800, tier: "elite"},
  {name: "Tomasz Kuszczak", pos: "GK", rating: 78, price: 50000, wage: 350, tier: "average"},
  {name: "Ben Foster", pos: "GK", rating: 79, price: 55000, wage: 380, tier: "average"},
  {name: "Tim Howard", pos: "GK", rating: 80, price: 60000, wage: 420, tier: "average"},
  {name: "Jussi Jääskeläinen", pos: "GK", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Brad Friedel", pos: "GK", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Mark Schwarzer", pos: "GK", rating: 80, price: 60000, wage: 420, tier: "average"},
  {name: "Shay Given", pos: "GK", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "Pepe Reina", pos: "GK", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "José Reina", pos: "GK", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Jussi Jääskeläinen", pos: "GK", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Thomas Sørensen", pos: "GK", rating: 79, price: 55000, wage: 380, tier: "average"},
  {name: "Marcus Hahnemann", pos: "GK", rating: 77, price: 48000, wage: 330, tier: "mediocre"},
  {name: "Robert Green", pos: "GK", rating: 78, price: 50000, wage: 350, tier: "average"},
  {name: "David James", pos: "GK", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Paul Robinson", pos: "GK", rating: 80, price: 60000, wage: 420, tier: "average"},
  {name: "Scott Carson", pos: "GK", rating: 76, price: 45000, wage: 300, tier: "mediocre"},
  {name: "Chris Kirkland", pos: "GK", rating: 75, price: 40000, wage: 280, tier: "mediocre"},
  {name: "Richard Wright", pos: "GK", rating: 74, price: 38000, wage: 260, tier: "mediocre"},
  {name: "Ian Walker", pos: "GK", rating: 73, price: 36000, wage: 240, tier: "mediocre"},
  {name: "Nigel Martyn", pos: "GK", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  // Infamous English Players
  {name: "Adam Johnson", pos: "MF", rating: 45, price: 2000, wage: 30, tier: "shit"},
  {name: "Ched Evans", pos: "FW", rating: 48, price: 2500, wage: 35, tier: "shit"},
  {name: "Joey Barton", pos: "MF", rating: 72, price: 35000, wage: 250, tier: "mediocre"},
  {name: "Lee Bowyer", pos: "MF", rating: 75, price: 40000, wage: 280, tier: "mediocre"},
  {name: "Jonathan Woodgate", pos: "DF", rating: 78, price: 50000, wage: 350, tier: "average"},
  {name: "Jermaine Pennant", pos: "MF", rating: 74, price: 38000, wage: 260, tier: "mediocre"},
  {name: "Kieron Dyer", pos: "MF", rating: 76, price: 45000, wage: 300, tier: "mediocre"},
  {name: "Craig Bellamy", pos: "FW", rating: 80, price: 60000, wage: 420, tier: "average"},
  {name: "El Hadji Diouf", pos: "FW", rating: 77, price: 48000, wage: 330, tier: "mediocre"},
  {name: "Mario Balotelli", pos: "FW", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Adel Taarabt", pos: "MF", rating: 78, price: 50000, wage: 350, tier: "average"},
  {name: "Emmanuel Frimpong", pos: "MF", rating: 70, price: 30000, wage: 200, tier: "mediocre"},
  {name: "Ravel Morrison", pos: "MF", rating: 73, price: 36000, wage: 240, tier: "mediocre"},
  {name: "Carlton Cole", pos: "FW", rating: 74, price: 38000, wage: 260, tier: "mediocre"},
  {name: "Danny Simpson", pos: "DF", rating: 75, price: 40000, wage: 280, tier: "mediocre"},
  {name: "Fabrice Muamba", pos: "MF", rating: 76, price: 45000, wage: 300, tier: "mediocre"},
  {name: "Shaun Wright-Phillips", pos: "MF", rating: 78, price: 50000, wage: 350, tier: "average"},
  {name: "Darius Vassell", pos: "FW", rating: 75, price: 40000, wage: 280, tier: "mediocre"},
  {name: "Emile Heskey", pos: "FW", rating: 76, price: 45000, wage: 300, tier: "mediocre"},
  {name: "Kevin Phillips", pos: "FW", rating: 79, price: 55000, wage: 380, tier: "average"},
  {name: "Marcus Bent", pos: "FW", rating: 72, price: 35000, wage: 250, tier: "mediocre"},
  {name: "Darren Bent", pos: "FW", rating: 80, price: 60000, wage: 420, tier: "average"},
  {name: "Jermain Defoe", pos: "FW", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "Robbie Keane", pos: "FW", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Dimitar Berbatov", pos: "FW", rating: 85, price: 85000, wage: 600, tier: "excellent"},
  {name: "Carlos Tevez", pos: "FW", rating: 86, price: 90000, wage: 650, tier: "excellent"},
  {name: "Robinho", pos: "FW", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Elano", pos: "MF", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Yaya Touré", pos: "MF", rating: 88, price: 1000000, wage: 750, tier: "elite"},
  {name: "Samir Nasri", pos: "MF", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "Emmanuel Adebayor", pos: "FW", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Gervinho", pos: "FW", rating: 79, price: 55000, wage: 380, tier: "average"},
  {name: "Marouane Chamakh", pos: "FW", rating: 76, price: 45000, wage: 300, tier: "mediocre"},
  {name: "Olivier Giroud", pos: "FW", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "Mesut Özil", pos: "MF", rating: 87, price: 95000, wage: 700, tier: "elite"},
  {name: "Alexis Sánchez", pos: "FW", rating: 88, price: 1000000, wage: 750, tier: "elite"},
  {name: "Santi Cazorla", pos: "MF", rating: 85, price: 85000, wage: 600, tier: "excellent"},
  {name: "Mikel Arteta", pos: "MF", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Per Mertesacker", pos: "DF", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "Laurent Koscielny", pos: "DF", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Bacary Sagna", pos: "DF", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Nacho Monreal", pos: "DF", rating: 80, price: 60000, wage: 420, tier: "average"},
  {name: "Wojciech Szczęsny", pos: "GK", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Lukasz Fabianski", pos: "GK", rating: 78, price: 50000, wage: 350, tier: "average"},
  {name: "Petr Čech", pos: "GK", rating: 90, price: 1100000, wage: 850, tier: "elite"},
  {name: "Gary Cahill", pos: "DF", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "Branislav Ivanović", pos: "DF", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "César Azpilicueta", pos: "DF", rating: 85, price: 85000, wage: 600, tier: "excellent"},
  {name: "Marcos Alonso", pos: "DF", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "N'Golo Kanté", pos: "MF", rating: 88, price: 1000000, wage: 750, tier: "elite"},
  {name: "Mateo Kovačić", pos: "MF", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Jorginho", pos: "MF", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "Mason Mount", pos: "MF", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "Kai Havertz", pos: "FW", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Timo Werner", pos: "FW", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Romelu Lukaku", pos: "FW", rating: 86, price: 90000, wage: 650, tier: "excellent"},
  {name: "Álvaro Morata", pos: "FW", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Diego Costa", pos: "FW", rating: 85, price: 85000, wage: 600, tier: "excellent"},
  {name: "Eden Hazard", pos: "MF", rating: 86, price: 90000, wage: 650, tier: "excellent"},
  {name: "Juan Mata", pos: "MF", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Oscar", pos: "MF", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "Willian", pos: "FW", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Pedro", pos: "FW", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "André Schürrle", pos: "FW", rating: 80, price: 60000, wage: 420, tier: "average"},
  {name: "Fernando Torres", pos: "FW", rating: 87, price: 95000, wage: 700, tier: "elite"},
  {name: "Andy Carroll", pos: "FW", rating: 77, price: 48000, wage: 330, tier: "mediocre"},
  {name: "Stewart Downing", pos: "MF", rating: 78, price: 50000, wage: 350, tier: "average"},
  {name: "Joe Cole", pos: "MF", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Ashley Young", pos: "MF", rating: 80, price: 60000, wage: 420, tier: "average"},
  {name: "Antonio Valencia", pos: "DF", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "Nani", pos: "MF", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Anderson", pos: "MF", rating: 79, price: 55000, wage: 380, tier: "average"},
  {name: "Darren Fletcher", pos: "MF", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Michael Carrick", pos: "MF", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Owen Hargreaves", pos: "MF", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Dimitar Berbatov", pos: "FW", rating: 85, price: 85000, wage: 600, tier: "excellent"},
  {name: "Carlos Tevez", pos: "FW", rating: 86, price: 90000, wage: 650, tier: "excellent"},
  {name: "Patrice Evra", pos: "DF", rating: 85, price: 85000, wage: 600, tier: "excellent"},
  {name: "Nemanja Vidić", pos: "DF", rating: 88, price: 1000000, wage: 750, tier: "elite"},
  {name: "Edwin van der Sar", pos: "GK", rating: 89, price: 1050000, wage: 800, tier: "elite"},
  {name: "Tomasz Kuszczak", pos: "GK", rating: 78, price: 50000, wage: 350, tier: "average"},
  {name: "Ben Foster", pos: "GK", rating: 79, price: 55000, wage: 380, tier: "average"},
  {name: "Tim Howard", pos: "GK", rating: 80, price: 60000, wage: 420, tier: "average"},
  {name: "Jussi Jääskeläinen", pos: "GK", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Brad Friedel", pos: "GK", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Mark Schwarzer", pos: "GK", rating: 80, price: 60000, wage: 420, tier: "average"},
  {name: "Shay Given", pos: "GK", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "Pepe Reina", pos: "GK", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "José Reina", pos: "GK", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Jussi Jääskeläinen", pos: "GK", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Thomas Sørensen", pos: "GK", rating: 79, price: 55000, wage: 380, tier: "average"},
  {name: "Marcus Hahnemann", pos: "GK", rating: 77, price: 48000, wage: 330, tier: "mediocre"},
  {name: "Robert Green", pos: "GK", rating: 78, price: 50000, wage: 350, tier: "average"},
  {name: "David James", pos: "GK", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Paul Robinson", pos: "GK", rating: 80, price: 60000, wage: 420, tier: "average"},
  {name: "Scott Carson", pos: "GK", rating: 76, price: 45000, wage: 300, tier: "mediocre"},
  {name: "Chris Kirkland", pos: "GK", rating: 75, price: 40000, wage: 280, tier: "mediocre"},
  {name: "Richard Wright", pos: "GK", rating: 74, price: 38000, wage: 260, tier: "mediocre"},
  {name: "Ian Walker", pos: "GK", rating: 73, price: 36000, wage: 240, tier: "mediocre"},
  {name: "Nigel Martyn", pos: "GK", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "David Seaman", pos: "GK", rating: 85, price: 85000, wage: 600, tier: "excellent"},
  // Additional Premier League & International Legends
  {name: "Ruud van Nistelrooy", pos: "FW", rating: 92, price: 1200000, wage: 950, tier: "elite"},
  {name: "Edgar Davids", pos: "MF", rating: 88, price: 1000000, wage: 750, tier: "elite"},
  {name: "James Beattie", pos: "FW", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Diego Forlán", pos: "FW", rating: 86, price: 90000, wage: 650, tier: "excellent"},
  {name: "Marc-Vivien Foé", pos: "MF", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  // More Premier League Stars (2000-2025)
  {name: "Andrés Iniesta", pos: "MF", rating: 94, price: 1400000, wage: 1100, tier: "legendary"},
  {name: "Xavi Hernández", pos: "MF", rating: 93, price: 1300000, wage: 1000, tier: "elite"},
  {name: "Carles Puyol", pos: "DF", rating: 91, price: 1150000, wage: 900, tier: "elite"},
  {name: "Gerard Piqué", pos: "DF", rating: 88, price: 1000000, wage: 750, tier: "elite"},
  {name: "Sergio Busquets", pos: "MF", rating: 89, price: 1050000, wage: 800, tier: "elite"},
  {name: "Pedri", pos: "MF", rating: 88, price: 1000000, wage: 750, tier: "elite"},
  {name: "Gavi", pos: "MF", rating: 86, price: 90000, wage: 650, tier: "excellent"},
  {name: "Frenkie de Jong", pos: "MF", rating: 87, price: 95000, wage: 700, tier: "elite"},
  {name: "Ronaldinho", pos: "MF", rating: 96, price: 1500000, wage: 1200, tier: "legendary"},
  {name: "Zinedine Zidane", pos: "MF", rating: 98, price: 1800000, wage: 1300, tier: "legendary"},
  {name: "Andrea Pirlo", pos: "MF", rating: 91, price: 1150000, wage: 900, tier: "elite"},
  {name: "Paolo Maldini", pos: "DF", rating: 94, price: 1400000, wage: 1100, tier: "legendary"},
  {name: "Alessandro Nesta", pos: "DF", rating: 92, price: 1250000, wage: 1000, tier: "elite"},
  {name: "Fabio Cannavaro", pos: "DF", rating: 90, price: 1100000, wage: 850, tier: "elite"},
  {name: "Francesco Totti", pos: "FW", rating: 93, price: 1300000, wage: 1000, tier: "elite"},
  {name: "Alessandro Del Piero", pos: "FW", rating: 92, price: 1200000, wage: 950, tier: "elite"},
  {name: "Filippo Inzaghi", pos: "FW", rating: 88, price: 1000000, wage: 750, tier: "elite"},
  {name: "Andriy Shevchenko", pos: "FW", rating: 91, price: 1150000, wage: 900, tier: "elite"},
  {name: "Kaká", pos: "MF", rating: 92, price: 1200000, wage: 950, tier: "elite"},
  {name: "Iker Casillas", pos: "GK", rating: 93, price: 1300000, wage: 1000, tier: "elite"},
  {name: "Raúl", pos: "FW", rating: 91, price: 1150000, wage: 900, tier: "elite"},
  {name: "Fernando Hierro", pos: "DF", rating: 89, price: 1050000, wage: 800, tier: "elite"},
  {name: "Xabi Alonso", pos: "MF", rating: 88, price: 1000000, wage: 750, tier: "elite"},
  {name: "Sergio Ramos", pos: "DF", rating: 90, price: 1100000, wage: 850, tier: "elite"},
  {name: "Luka Modrić", pos: "MF", rating: 91, price: 1150000, wage: 900, tier: "elite"},
  {name: "Toni Kroos", pos: "MF", rating: 89, price: 1050000, wage: 800, tier: "elite"},
  {name: "Karim Benzema", pos: "FW", rating: 92, price: 1250000, wage: 1000, tier: "elite"},
  {name: "Gareth Bale", pos: "FW", rating: 88, price: 1000000, wage: 750, tier: "elite"},
  {name: "Vinícius Júnior", pos: "FW", rating: 89, price: 1050000, wage: 800, tier: "elite"},
  {name: "Rodrygo", pos: "FW", rating: 86, price: 90000, wage: 650, tier: "excellent"},
  {name: "Eduardo Camavinga", pos: "MF", rating: 85, price: 85000, wage: 600, tier: "excellent"},
  {name: "Aurélien Tchouaméni", pos: "MF", rating: 86, price: 90000, wage: 650, tier: "excellent"},
  {name: "Thibaut Courtois", pos: "GK", rating: 90, price: 1100000, wage: 850, tier: "elite"},
  {name: "Manuel Neuer", pos: "GK", rating: 92, price: 1200000, wage: 950, tier: "elite"},
  {name: "Thomas Müller", pos: "FW", rating: 88, price: 1000000, wage: 750, tier: "elite"},
  {name: "Robert Lewandowski", pos: "FW", rating: 90, price: 1100000, wage: 850, tier: "elite"},
  {name: "Franck Ribéry", pos: "FW", rating: 89, price: 1050000, wage: 800, tier: "elite"},
  {name: "Arjen Robben", pos: "FW", rating: 90, price: 1100000, wage: 850, tier: "elite"},
  {name: "Bastian Schweinsteiger", pos: "MF", rating: 88, price: 1000000, wage: 750, tier: "elite"},
  {name: "Philipp Lahm", pos: "DF", rating: 91, price: 1150000, wage: 900, tier: "elite"},
  {name: "Mats Hummels", pos: "DF", rating: 87, price: 95000, wage: 700, tier: "elite"},
  {name: "Marco Reus", pos: "FW", rating: 86, price: 90000, wage: 650, tier: "excellent"},
  {name: "Erling Haaland", pos: "FW", rating: 95, price: 1500000, wage: 1100, tier: "legendary"},
  {name: "Jadon Sancho", pos: "FW", rating: 85, price: 85000, wage: 600, tier: "excellent"},
  {name: "Jude Bellingham", pos: "MF", rating: 90, price: 1100000, wage: 850, tier: "elite"},
  {name: "Jamal Musiala", pos: "MF", rating: 87, price: 95000, wage: 700, tier: "elite"},
  {name: "Florian Wirtz", pos: "MF", rating: 86, price: 90000, wage: 650, tier: "excellent"},
  {name: "Kylian Mbappé", pos: "FW", rating: 96, price: 1600000, wage: 1200, tier: "legendary"},
  {name: "Antoine Griezmann", pos: "FW", rating: 88, price: 1000000, wage: 750, tier: "elite"},
  {name: "Paul Pogba", pos: "MF", rating: 86, price: 90000, wage: 650, tier: "excellent"},
  {name: "N'Golo Kanté", pos: "MF", rating: 88, price: 1000000, wage: 750, tier: "elite"},
  {name: "Olivier Giroud", pos: "FW", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Hugo Lloris", pos: "GK", rating: 86, price: 90000, wage: 650, tier: "excellent"},
  {name: "Raphaël Varane", pos: "DF", rating: 87, price: 95000, wage: 700, tier: "elite"},
  {name: "Aurelien Tchouameni", pos: "MF", rating: 85, price: 85000, wage: 600, tier: "excellent"},
  {name: "Eduardo Camavinga", pos: "MF", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Ousmane Dembélé", pos: "FW", rating: 85, price: 85000, wage: 600, tier: "excellent"},
  {name: "Kingsley Coman", pos: "FW", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Lucas Hernández", pos: "DF", rating: 85, price: 85000, wage: 600, tier: "excellent"},
  {name: "Theo Hernández", pos: "DF", rating: 86, price: 90000, wage: 650, tier: "excellent"},
  {name: "Mike Maignan", pos: "GK", rating: 87, price: 95000, wage: 700, tier: "elite"},
  {name: "Rafael Leão", pos: "FW", rating: 87, price: 95000, wage: 700, tier: "elite"},
  {name: "Sandro Tonali", pos: "MF", rating: 85, price: 85000, wage: 600, tier: "excellent"},
  {name: "Fikayo Tomori", pos: "DF", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Ismaël Bennacer", pos: "MF", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "Theo Walcott", pos: "FW", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Alex Oxlade-Chamberlain", pos: "MF", rating: 80, price: 60000, wage: 420, tier: "average"},
  {name: "Calum Chambers", pos: "DF", rating: 78, price: 50000, wage: 350, tier: "average"},
  {name: "Nathaniel Clyne", pos: "DF", rating: 79, price: 55000, wage: 380, tier: "average"},
  {name: "Morgan Schneiderlin", pos: "MF", rating: 80, price: 60000, wage: 420, tier: "average"},
  {name: "Victor Wanyama", pos: "MF", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Dusan Tadic", pos: "FW", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Graziano Pellè", pos: "FW", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Sadio Mané", pos: "FW", rating: 90, price: 1100000, wage: 850, tier: "elite"},
  {name: "Virgil van Dijk", pos: "DF", rating: 93, price: 1300000, wage: 1000, tier: "elite"},
  {name: "Alisson", pos: "GK", rating: 91, price: 1150000, wage: 900, tier: "elite"},
  {name: "Fabinho", pos: "MF", rating: 85, price: 85000, wage: 600, tier: "excellent"},
  {name: "Georginio Wijnaldum", pos: "MF", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Alex Oxlade-Chamberlain", pos: "MF", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Naby Keïta", pos: "MF", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Thiago Alcântara", pos: "MF", rating: 87, price: 95000, wage: 700, tier: "elite"},
  {name: "Diogo Jota", pos: "FW", rating: 85, price: 85000, wage: 600, tier: "excellent"},
  {name: "Luis Díaz", pos: "FW", rating: 86, price: 90000, wage: 650, tier: "excellent"},
  {name: "Darwin Núñez", pos: "FW", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Cody Gakpo", pos: "FW", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "Dominik Szoboszlai", pos: "MF", rating: 85, price: 85000, wage: 600, tier: "excellent"},
  {name: "Alexis Mac Allister", pos: "MF", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Ryan Gravenberch", pos: "MF", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Wataru Endo", pos: "MF", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Ibrahima Konaté", pos: "DF", rating: 85, price: 85000, wage: 600, tier: "excellent"},
  {name: "Joël Matip", pos: "DF", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "Joe Gomez", pos: "DF", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Kostas Tsimikas", pos: "DF", rating: 80, price: 60000, wage: 420, tier: "average"},
  {name: "Harvey Elliott", pos: "MF", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Curtis Jones", pos: "MF", rating: 80, price: 60000, wage: 420, tier: "average"},
  {name: "Stefan Bajcetic", pos: "MF", rating: 78, price: 50000, wage: 350, tier: "average"},
  {name: "Kaoru Mitoma", pos: "FW", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Evan Ferguson", pos: "FW", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Pervis Estupiñán", pos: "DF", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "Alexis Mac Allister", pos: "MF", rating: 85, price: 85000, wage: 600, tier: "excellent"},
  {name: "Moisés Caicedo", pos: "MF", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Enzo Fernández", pos: "MF", rating: 85, price: 85000, wage: 600, tier: "excellent"},
  {name: "Mykhailo Mudryk", pos: "FW", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Nicolas Jackson", pos: "FW", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Cole Palmer", pos: "FW", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Conor Gallagher", pos: "MF", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Levi Colwill", pos: "DF", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "Malo Gusto", pos: "DF", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Christopher Nkunku", pos: "FW", rating: 85, price: 85000, wage: 600, tier: "excellent"},
  {name: "Raheem Sterling", pos: "FW", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Noni Madueke", pos: "FW", rating: 80, price: 60000, wage: 420, tier: "average"},
  {name: "Armando Broja", pos: "FW", rating: 79, price: 55000, wage: 380, tier: "average"},
  {name: "Ian Maatsen", pos: "DF", rating: 78, price: 50000, wage: 350, tier: "average"},
  {name: "Bukayo Saka", pos: "FW", rating: 88, price: 1000000, wage: 750, tier: "elite"},
  {name: "Gabriel Martinelli", pos: "FW", rating: 85, price: 85000, wage: 600, tier: "excellent"},
  {name: "Martin Ødegaard", pos: "MF", rating: 87, price: 95000, wage: 700, tier: "elite"},
  {name: "Declan Rice", pos: "MF", rating: 86, price: 90000, wage: 650, tier: "excellent"},
  {name: "Kai Havertz", pos: "FW", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Gabriel Jesus", pos: "FW", rating: 85, price: 85000, wage: 600, tier: "excellent"},
  {name: "Leandro Trossard", pos: "FW", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "Emile Smith Rowe", pos: "MF", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Fabio Vieira", pos: "MF", rating: 80, price: 60000, wage: 420, tier: "average"},
  {name: "William Saliba", pos: "DF", rating: 86, price: 90000, wage: 650, tier: "excellent"},
  {name: "Gabriel Magalhães", pos: "DF", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Ben White", pos: "DF", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "Oleksandr Zinchenko", pos: "DF", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Takehiro Tomiyasu", pos: "DF", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Jakub Kiwior", pos: "DF", rating: 80, price: 60000, wage: 420, tier: "average"},
  {name: "Jurriën Timber", pos: "DF", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "David Raya", pos: "GK", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "Aaron Ramsdale", pos: "GK", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Bruno Guimarães", pos: "MF", rating: 85, price: 85000, wage: 600, tier: "excellent"},
  {name: "Alexander Isak", pos: "FW", rating: 86, price: 90000, wage: 650, tier: "excellent"},
  {name: "Anthony Gordon", pos: "FW", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "Joelinton", pos: "MF", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "Miguel Almirón", pos: "FW", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Callum Wilson", pos: "FW", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "Sven Botman", pos: "DF", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Fabian Schär", pos: "DF", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Kieran Trippier", pos: "DF", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Dan Burn", pos: "DF", rating: 80, price: 60000, wage: 420, tier: "average"},
  {name: "Nick Pope", pos: "GK", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "James Maddison", pos: "MF", rating: 85, price: 85000, wage: 600, tier: "excellent"},
  {name: "Yves Bissouma", pos: "MF", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "Pape Matar Sarr", pos: "MF", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Rodrigo Bentancur", pos: "MF", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Pierre-Emile Højbjerg", pos: "MF", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Dejan Kulusevski", pos: "FW", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Richarlison", pos: "FW", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Brennan Johnson", pos: "FW", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Cristian Romero", pos: "DF", rating: 85, price: 85000, wage: 600, tier: "excellent"},
  {name: "Micky van de Ven", pos: "DF", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "Destiny Udogie", pos: "DF", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Pedro Porro", pos: "DF", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "Guglielmo Vicario", pos: "GK", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "Erling Haaland", pos: "FW", rating: 95, price: 1500000, wage: 1100, tier: "legendary"},
  {name: "Kevin De Bruyne", pos: "MF", rating: 94, price: 1400000, wage: 1100, tier: "legendary"},
  {name: "Phil Foden", pos: "MF", rating: 88, price: 1000000, wage: 750, tier: "elite"},
  {name: "Jack Grealish", pos: "MF", rating: 85, price: 85000, wage: 600, tier: "excellent"},
  {name: "Bernardo Silva", pos: "MF", rating: 87, price: 95000, wage: 700, tier: "elite"},
  {name: "Riyad Mahrez", pos: "FW", rating: 86, price: 90000, wage: 650, tier: "excellent"},
  {name: "İlkay Gündoğan", pos: "MF", rating: 86, price: 90000, wage: 650, tier: "excellent"},
  {name: "Rodri", pos: "MF", rating: 89, price: 1050000, wage: 800, tier: "elite"},
  {name: "Rúben Dias", pos: "DF", rating: 88, price: 1000000, wage: 750, tier: "elite"},
  {name: "John Stones", pos: "DF", rating: 85, price: 85000, wage: 600, tier: "excellent"},
  {name: "Nathan Aké", pos: "DF", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "Kyle Walker", pos: "DF", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "João Cancelo", pos: "DF", rating: 85, price: 85000, wage: 600, tier: "excellent"},
  {name: "Aymeric Laporte", pos: "DF", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Ederson", pos: "GK", rating: 89, price: 1050000, wage: 800, tier: "elite"},
  {name: "Julian Álvarez", pos: "FW", rating: 85, price: 85000, wage: 600, tier: "excellent"},
  {name: "Jeremy Doku", pos: "FW", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Matheus Nunes", pos: "MF", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Mateo Kovačić", pos: "MF", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Josko Gvardiol", pos: "DF", rating: 85, price: 85000, wage: 600, tier: "excellent"},
  {name: "Marcus Rashford", pos: "FW", rating: 85, price: 85000, wage: 600, tier: "excellent"},
  {name: "Bruno Fernandes", pos: "MF", rating: 87, price: 95000, wage: 700, tier: "elite"},
  {name: "Casemiro", pos: "MF", rating: 86, price: 90000, wage: 650, tier: "excellent"},
  {name: "Christian Eriksen", pos: "MF", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Mason Mount", pos: "MF", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "Antony", pos: "FW", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Jadon Sancho", pos: "FW", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Alejandro Garnacho", pos: "FW", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Rasmus Højlund", pos: "FW", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Lisandro Martínez", pos: "DF", rating: 85, price: 85000, wage: 600, tier: "excellent"},
  {name: "Raphaël Varane", pos: "DF", rating: 86, price: 90000, wage: 650, tier: "excellent"},
  {name: "Harry Maguire", pos: "DF", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Luke Shaw", pos: "DF", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "Diogo Dalot", pos: "DF", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Aaron Wan-Bissaka", pos: "DF", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "André Onana", pos: "GK", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "David de Gea", pos: "GK", rating: 87, price: 95000, wage: 700, tier: "elite"},
  {name: "Ollie Watkins", pos: "FW", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Leon Bailey", pos: "FW", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Moussa Diaby", pos: "FW", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "John McGinn", pos: "MF", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "Douglas Luiz", pos: "MF", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Boubacar Kamara", pos: "MF", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Youri Tielemans", pos: "MF", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "Pau Torres", pos: "DF", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Ezri Konsa", pos: "DF", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Tyrone Mings", pos: "DF", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Lucas Digne", pos: "DF", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Matty Cash", pos: "DF", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Emiliano Martínez", pos: "GK", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Ivan Toney", pos: "FW", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Bryan Mbeumo", pos: "FW", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "Yoane Wissa", pos: "FW", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Mathias Jensen", pos: "MF", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Vitaly Janelt", pos: "MF", rating: 80, price: 60000, wage: 420, tier: "average"},
  {name: "Christian Nørgaard", pos: "MF", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Rico Henry", pos: "DF", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Ethan Pinnock", pos: "DF", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Ben Mee", pos: "DF", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Aaron Hickey", pos: "DF", rating: 80, price: 60000, wage: 420, tier: "average"},
  {name: "Mark Flekken", pos: "GK", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Dominic Solanke", pos: "FW", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "Antoine Semenyo", pos: "FW", rating: 80, price: 60000, wage: 420, tier: "average"},
  {name: "Justin Kluivert", pos: "FW", rating: 79, price: 55000, wage: 380, tier: "average"},
  {name: "Ryan Christie", pos: "MF", rating: 80, price: 60000, wage: 420, tier: "average"},
  {name: "Lewis Cook", pos: "MF", rating: 79, price: 55000, wage: 380, tier: "average"},
  {name: "Alex Scott", pos: "MF", rating: 78, price: 50000, wage: 350, tier: "average"},
  {name: "Marcos Senesi", pos: "DF", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Lloyd Kelly", pos: "DF", rating: 80, price: 60000, wage: 420, tier: "average"},
  {name: "Milos Kerkez", pos: "DF", rating: 79, price: 55000, wage: 380, tier: "average"},
  {name: "Max Aarons", pos: "DF", rating: 79, price: 55000, wage: 380, tier: "average"},
  {name: "Neto", pos: "GK", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Eberechi Eze", pos: "MF", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Michael Olise", pos: "FW", rating: 85, price: 85000, wage: 600, tier: "excellent"},
  {name: "Odsonne Édouard", pos: "FW", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Jean-Philippe Mateta", pos: "FW", rating: 80, price: 60000, wage: 420, tier: "average"},
  {name: "Cheick Doucouré", pos: "MF", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Jefferson Lerma", pos: "MF", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Will Hughes", pos: "MF", rating: 79, price: 55000, wage: 380, tier: "average"},
  {name: "Marc Guéhi", pos: "DF", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "Joachim Andersen", pos: "DF", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Tyrick Mitchell", pos: "DF", rating: 80, price: 60000, wage: 420, tier: "average"},
  {name: "Nathaniel Clyne", pos: "DF", rating: 79, price: 55000, wage: 380, tier: "average"},
  {name: "Joel Ward", pos: "DF", rating: 78, price: 50000, wage: 350, tier: "average"},
  {name: "Sam Johnstone", pos: "GK", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Vicente Guaita", pos: "GK", rating: 80, price: 60000, wage: 420, tier: "average"},
  {name: "Dwight McNeil", pos: "FW", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Alex Iwobi", pos: "MF", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Abdoulaye Doucouré", pos: "MF", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Idrissa Gueye", pos: "MF", rating: 80, price: 60000, wage: 420, tier: "average"},
  {name: "Amadou Onana", pos: "MF", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "James Garner", pos: "MF", rating: 79, price: 55000, wage: 380, tier: "average"},
  {name: "Dominic Calvert-Lewin", pos: "FW", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Beto", pos: "FW", rating: 80, price: 60000, wage: 420, tier: "average"},
  {name: "Youssef Chermiti", pos: "FW", rating: 77, price: 48000, wage: 330, tier: "mediocre"},
  {name: "James Tarkowski", pos: "DF", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Jarrad Branthwaite", pos: "DF", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Vitalii Mykolenko", pos: "DF", rating: 80, price: 60000, wage: 420, tier: "average"},
  {name: "Nathan Patterson", pos: "DF", rating: 78, price: 50000, wage: 350, tier: "average"},
  {name: "Seamus Coleman", pos: "DF", rating: 79, price: 55000, wage: 380, tier: "average"},
  {name: "Jordan Pickford", pos: "GK", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "João Palhinha", pos: "MF", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Tom Cairney", pos: "MF", rating: 80, price: 60000, wage: 420, tier: "average"},
  {name: "Harrison Reed", pos: "MF", rating: 79, price: 55000, wage: 380, tier: "average"},
  {name: "Andreas Pereira", pos: "MF", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Bobby De Cordova-Reid", pos: "FW", rating: 79, price: 55000, wage: 380, tier: "average"},
  {name: "Willian", pos: "FW", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Raúl Jiménez", pos: "FW", rating: 80, price: 60000, wage: 420, tier: "average"},
  {name: "Carlos Vinicius", pos: "FW", rating: 78, price: 50000, wage: 350, tier: "average"},
  {name: "Antonee Robinson", pos: "DF", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Tim Ream", pos: "DF", rating: 80, price: 60000, wage: 420, tier: "average"},
  {name: "Tosin Adarabioyo", pos: "DF", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Issa Diop", pos: "DF", rating: 80, price: 60000, wage: 420, tier: "average"},
  {name: "Kenny Tete", pos: "DF", rating: 79, price: 55000, wage: 380, tier: "average"},
  {name: "Bernd Leno", pos: "GK", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Pablo Sarabia", pos: "FW", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Pedro Neto", pos: "FW", rating: 84, price: 80000, wage: 550, tier: "excellent"},
  {name: "Hwang Hee-chan", pos: "FW", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Matheus Cunha", pos: "FW", rating: 83, price: 75000, wage: 500, tier: "excellent"},
  {name: "Fábio Silva", pos: "FW", rating: 79, price: 55000, wage: 380, tier: "average"},
  {name: "Mario Lemina", pos: "MF", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "João Gomes", pos: "MF", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Tommy Doyle", pos: "MF", rating: 78, price: 50000, wage: 350, tier: "average"},
  {name: "Rayan Aït-Nouri", pos: "DF", rating: 82, price: 70000, wage: 450, tier: "excellent"},
  {name: "Max Kilman", pos: "DF", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "Craig Dawson", pos: "DF", rating: 80, price: 60000, wage: 420, tier: "average"},
  {name: "Santiago Bueno", pos: "DF", rating: 79, price: 55000, wage: 380, tier: "average"},
  {name: "Nelson Semedo", pos: "DF", rating: 81, price: 65000, wage: 400, tier: "excellent"},
  {name: "José Sá", pos: "GK", rating: 82, price: 70000, wage: 450, tier: "excellent"}
];

function ensureTransferState(){
  if(!Array.isArray(S.transfer_market)) S.transfer_market = [];
  if(!Array.isArray(S.unpaid_transfers)) S.unpaid_transfers = [];
  if(!S.transfer_flags) S.transfer_flags = {seasonOpened:false, midOpened:false};
}

function makePlayer(nameOverride){
  const name = nameOverride || (pick(typeof MALE_NAMES!=="undefined"?MALE_NAMES:["John","Mark","David","Paul","James","Michael","Robert","William","Richard","Thomas"]) + " " + pick(typeof SURNAMES!=="undefined"?SURNAMES:["Smith","Jones","Brown"]));
  const pos = pick(POSITIONS);
  const tierPick = pick(["elite","excellent","average","mediocre","shit","average","mediocre","average"]);
  let rating=0, price=0, wage=0;
  if(tierPick==="elite"){ rating=95; price=roll(1000000,2000000); wage=roll(650,1200); }
  else if(tierPick==="excellent"){ rating=85; price=roll(55000,95000); wage=roll(400,800); }
  else if(tierPick==="average"){ rating=75; price=roll(20000,45000); wage=roll(200,400); }
  else if(tierPick==="mediocre"){ rating=65; price=roll(7000,16000); wage=roll(80,180); }
  else { rating=55; price=roll(1500,5500); wage=roll(30,70); }
  // Lightweight relationship-flavoured fields (hidden but useful for later checks)
  const player = {
    id:cryptoRandomId(),
    name,
    pos,
    rating,
    price,
    wage,
    tier:tierPick
  };
  // Initialise soft fields only if not already present
  if (player.loyalty === undefined) player.loyalty = 0.3 + Math.random() * 0.5; // 0.3–0.8
  if (player.fear === undefined) player.fear = 0;
  if (player.morale === undefined) player.morale = 50;
  if (player.spite === undefined) player.spite = 0;
  if (player.greed === undefined) player.greed = Math.random() * 0.5;
  if (player.beliefInCorruption === undefined) player.beliefInCorruption = 0;
  return player;
}

function makeSpecialPlayer(){
  const specialPlayer = pick(SPECIAL_PLAYERS);
  return {
    id: cryptoRandomId(),
    name: specialPlayer.name,
    pos: specialPlayer.pos,
    rating: specialPlayer.rating,
    price: specialPlayer.price,
    wage: specialPlayer.wage,
    tier: specialPlayer.tier,
    isSpecial: true,
    loyalty: 0.3 + Math.random() * 0.5,
    fear: 0,
    morale: 60,
    spite: 0,
    greed: Math.random() * 0.5,
    beliefInCorruption: 0
  };
}

// Tunables
