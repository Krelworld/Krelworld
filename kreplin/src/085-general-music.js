/* === General Music System === */
(function(){

  // General music tracks list (using direct download links)
  const generalMusicTracks = [
    'https://www.dropbox.com/scl/fi/25y3k21gr285p5tikl2xz/general12.mp3?rlkey=o799ct9g9vrm0g766pv9g2twp&st=lx2co5ee&dl=1',
    'https://www.dropbox.com/scl/fi/vc41qr2gbx9ft3gk7qf0m/general11.mp3?rlkey=pi19udb44u652fqmz7xweavml&st=dvjeqzxf&dl=1',
    'https://www.dropbox.com/scl/fi/pmj9kwnq44mmmdzcu8a15/general9.mp3?rlkey=0d9fltevnej0slu5oglh8ygol&st=3rv8a71h&dl=1',
    'https://www.dropbox.com/scl/fi/1ym67zaflpatzuwcw8jj1/general8.mp3?rlkey=pl4k60p8su5fg3loxgvam7y4w&st=tg0igws9&dl=1',
    'https://www.dropbox.com/scl/fi/0z6koe33xtbpmty0s2xzd/general7.mp3?rlkey=tkaycmkenkg04ajtm6b5u9wcx&st=dhozj58f&dl=1',
    'https://www.dropbox.com/scl/fi/ldbfz56wi3zcklxdc1a4j/geberal6.mp3?rlkey=zsbaa851ul3zx3pdwvkyvd0mp&st=pw8pam0z&dl=1',
    'https://www.dropbox.com/scl/fi/8aargajhl55dj0vi9va0u/gebeeal5.mp3?rlkey=drs9ctaxm8tlfcv5bggo6pq25&st=55oxelzq&dl=1',
    'https://www.dropbox.com/scl/fi/e320jh4a98p5950tdai3p/general4.mp3?rlkey=5ggkuetqzhlnn71camqpol0fb&st=byoycr22&dl=1',
    'https://www.dropbox.com/scl/fi/p2id7aq51wtz3gjmml4as/geberal3.mp3?rlkey=6hwa1x3prbrgo6o9noiwq1u73&st=cm3jce0r&dl=1',
    'https://www.dropbox.com/scl/fi/2mylevgpy04dqd8px3g29/general2.mp3?rlkey=584gkvnz7ep4jx1alcof1d03j&st=lsfrslut&dl=1',
    'https://www.dropbox.com/scl/fi/p2tgzj8745tczp8p6t7h7/general.mp3?rlkey=9g01h0h98o9mju9sacin3hhz6&st=o4df3fmd&dl=1',
    'https://www.dropbox.com/scl/fi/x8ded7mh6onog9pf6nsuw/gane.mp3?rlkey=db0nt2u5cjukndg6fm7yogxqo&st=mhojqlkv&dl=1',
    'https://www.dropbox.com/scl/fi/dwh9fx2uc8af9opuuo42r/menu.mp3?rlkey=cktx8nyo7rs97bt3qrzcqofnb&st=pbfsdawp&dl=1'
  ];

  // General music state
  let generalMusicAudio = null;
  let generalMusicEnabled = false;
  let lastPlayedTrackIndex = -1;
  let failedTracks = new Set(); // Track indices that have failed
  let consecutiveFailures = 0; // Count consecutive failures
  let maxConsecutiveFailures = 5; // Stop retrying after this many failures
  let isRetrying = false; // Prevent multiple simultaneous retries
  let musicVolume = 0.6; // Default volume (0.0 to 1.0)
  let musicMuted = false; // Track if music is muted

  // Function to get a random track (excluding the last played one and failed tracks)
  function getRandomTrack() {
    // Get available tracks (excluding failed ones)
    const availableTracks = generalMusicTracks
      .map((url, index) => index)
      .filter(index => !failedTracks.has(index));
    
    if (availableTracks.length === 0) {
      // All tracks failed, reset failed tracks and try again
      failedTracks.clear();
      consecutiveFailures = 0;
      return Math.floor(Math.random() * generalMusicTracks.length);
    }
    
    if (availableTracks.length === 1) return availableTracks[0];
    
    // Filter out the last played track if possible
    const candidates = availableTracks.filter(index => index !== lastPlayedTrackIndex);
    const pool = candidates.length > 0 ? candidates : availableTracks;
    
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // Function to stop general music
  function stopGeneralMusic() {
    if (generalMusicAudio) {
      try {
        generalMusicAudio.pause();
        generalMusicAudio.currentTime = 0;
        generalMusicAudio = null;
      } catch(e) {
        console.warn('Error stopping general music:', e);
      }
    }
    generalMusicEnabled = false;
  }

  // Function to start general music
  function startGeneralMusic() {
    // Don't start if already playing or if disabled
    if (generalMusicAudio && !generalMusicAudio.paused) {
      return;
    }

    // Check if other music is playing
    const openingMusic = document.getElementById('openingMusic');
    if (openingMusic && !openingMusic.paused) {
      // Intro music still playing, don't start general music yet
      return;
    }

    if (window.juiceSongAudio && !window.juiceSongAudio.paused) {
      // Juice music is playing, don't start general music
      return;
    }

    // Check for epilogue audio
    const epilogueOverlays = document.querySelectorAll('.epilogue-overlay');
    for (let overlay of epilogueOverlays) {
      if (overlay._epilogueAudio && !overlay._epilogueAudio.paused) {
        // Epilogue music is playing, don't start general music
        return;
      }
    }
    
    // Also check if any epilogue music is actively playing (fallback)
    const allAudioElements = document.querySelectorAll('audio');
    for (let audio of allAudioElements) {
      if (audio.src && audio.src.includes('epilogue.mp3') && !audio.paused) {
        // Epilogue music is playing, don't start general music
        return;
      }
    }

    // Check for end-of-season presentation audio
    const eosOverlays = document.querySelectorAll('.eos-presentation-overlay');
    for (let overlay of eosOverlays) {
      if (overlay._presentationAudio && !overlay._presentationAudio.paused) {
        // End-of-season presentation music is playing, don't start general music
        return;
      }
    }

    generalMusicEnabled = true;
    playNextGeneralTrack();
  }

  // Function to play the next general music track
  function playNextGeneralTrack() {
    if (!generalMusicEnabled) return;
    
    // Prevent infinite retry loops
    if (isRetrying) return;
    
    // Stop retrying if too many consecutive failures
    if (consecutiveFailures >= maxConsecutiveFailures) {
      console.warn('General music: Too many consecutive failures, stopping retries.');
      generalMusicEnabled = false;
      return;
    }

    // Stop current track if playing
    if (generalMusicAudio) {
      try {
        generalMusicAudio.pause();
        generalMusicAudio.onerror = null;
        generalMusicAudio.onended = null;
        generalMusicAudio = null;
      } catch(e) {}
    }

    // Get random track
    const trackIndex = getRandomTrack();
    lastPlayedTrackIndex = trackIndex;
    const trackUrl = generalMusicTracks[trackIndex];

    // Create new audio element
    const audio = new Audio(trackUrl);
    audio.volume = 0.6; // Set reasonable volume
    audio.preload = 'auto';
    
    let errorHandled = false; // Prevent duplicate error messages

    // When track ends, play next random track
    audio.onended = () => {
      consecutiveFailures = 0; // Reset failure count on success
      if (generalMusicEnabled) {
        playNextGeneralTrack();
      }
    };

    // Handle loading/playback errors
    const handleError = (errorType, error) => {
      if (errorHandled) return; // Only log once
      errorHandled = true;
      
      consecutiveFailures++;
      failedTracks.add(trackIndex);
      
      // Only log first few errors to avoid spam
      if (consecutiveFailures <= 3) {
        console.warn(`General music: ${errorType} for track ${trackIndex + 1}/${generalMusicTracks.length}`, error?.message || error);
      }
      
      // Clean up audio element
      try {
        audio.pause();
        audio.onerror = null;
        audio.onended = null;
      } catch(e) {}
      
      // Try next track after a delay, but only if we haven't exceeded max failures
      if (generalMusicEnabled && consecutiveFailures < maxConsecutiveFailures) {
        isRetrying = true;
        setTimeout(() => {
          isRetrying = false;
          playNextGeneralTrack();
        }, 2000); // Increased delay to reduce spam
      } else if (consecutiveFailures >= maxConsecutiveFailures) {
        console.warn('General music: Stopped after multiple failures. Music may be unavailable.');
        generalMusicEnabled = false;
      }
    };

    audio.onerror = (e) => {
      handleError('Error loading track', e);
    };

    // Attempt to play
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          consecutiveFailures = 0; // Reset failure count on success
          generalMusicAudio = audio;
        })
        .catch(err => {
          handleError('Could not play track', err);
        });
    } else {
      // Fallback for older browsers
      generalMusicAudio = audio;
    }
  }

  // Function to set music volume (0.0 to 1.0)
  function setMusicVolume(volume) {
    musicVolume = Math.max(0, Math.min(1, volume));
    if (generalMusicAudio) {
      generalMusicAudio.volume = musicMuted ? 0 : musicVolume;
    }
    // Save to localStorage
    localStorage.setItem('_musicVolume', musicVolume.toString());
  }

  // Function to get music volume
  function getMusicVolume() {
    return musicVolume;
  }

  // Function to toggle music mute
  function toggleMusicMute() {
    musicMuted = !musicMuted;
    if (generalMusicAudio) {
      generalMusicAudio.volume = musicMuted ? 0 : musicVolume;
    }
    // Save to localStorage
    localStorage.setItem('_musicMuted', musicMuted.toString());
    return musicMuted;
  }

  // Function to check if music is muted
  function isMusicMuted() {
    return musicMuted;
  }

  // Load saved volume and mute state
  const savedVolume = localStorage.getItem('_musicVolume');
  if (savedVolume !== null) {
    musicVolume = parseFloat(savedVolume);
  }
  const savedMuted = localStorage.getItem('_musicMuted');
  if (savedMuted !== null) {
    musicMuted = savedMuted === 'true';
  }

  // Expose start function for mainGameLoop to call
  window._startGeneralMusic = startGeneralMusic;

  // Expose stop function for cutscenes to call
  window._stopGeneralMusic = stopGeneralMusic;

  // Expose volume control functions
  window._setMusicVolume = setMusicVolume;
  window._getMusicVolume = getMusicVolume;
  window._toggleMusicMute = toggleMusicMute;
  window._isMusicMuted = isMusicMuted;

  // Hook into playCronsterAnthem (juice music) to stop general music
  const originalPlayCronsterAnthem = window.playCronsterAnthem;
  if (typeof originalPlayCronsterAnthem === 'function') {
    window.playCronsterAnthem = function() {
      stopGeneralMusic();
      return originalPlayCronsterAnthem.apply(this, arguments);
    };
  }

  // Monitor for epilogue audio starting (checked shortly after each log line)
  GameHooks.on('log', function() {
      setTimeout(() => {
        const epilogueOverlays = document.querySelectorAll('[id*="epilogue"], [class*="epilogue"]');
        for (let overlay of epilogueOverlays) {
          if (overlay._epilogueAudio && !overlay._epilogueAudio.paused) {
            stopGeneralMusic();
            break;
          }
        }
      }, 100);
  });

  // Also monitor for any UI modals/overlays that might have dedicated music
  // This is a catch-all for any other dedicated music tracks
  // (coalesced: the feed mutates many times a second during a match, and this scans the whole
  // document with attribute-substring selectors, so run it at most once per 300ms)
  let dedicatedCheckPending = false;
  const observer = new MutationObserver(() => {
    if (dedicatedCheckPending) return;
    dedicatedCheckPending = true;
    setTimeout(() => { dedicatedCheckPending = false; checkDedicatedMusic(); }, 300);
  });
  function checkDedicatedMusic() {
    // Check for epilogue audio
    const epilogueOverlays = document.querySelectorAll('[id*="epilogue"], [class*="epilogue"]');
    for (let overlay of epilogueOverlays) {
      if (overlay._epilogueAudio && !overlay._epilogueAudio.paused) {
        stopGeneralMusic();
        return;
      }
    }

    // Check for end-of-season presentation audio
    const eosOverlays = document.querySelectorAll('.eos-presentation-overlay');
    for (let overlay of eosOverlays) {
      if (overlay._presentationAudio && !overlay._presentationAudio.paused) {
        stopGeneralMusic();
        return;
      }
    }

    // Check if juice music is playing
    if (window.juiceSongAudio && !window.juiceSongAudio.paused) {
      stopGeneralMusic();
      return;
    }

    // Check if intro music resumed (shouldn't happen, but just in case)
    const openingMusic = document.getElementById('openingMusic');
    if (openingMusic && !openingMusic.paused) {
      stopGeneralMusic();
      return;
    }
  }

  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // === Video Monitoring System: Stop music when Dropbox videos play ===
  let activeVideoCount = 0; // Track how many videos are currently playing
  let musicWasPlayingBeforeVideo = false; // Remember if music was playing before video started

  // Function to check if a video is a Dropbox video
  function isDropboxVideo(video) {
    if (!video) return false;
    
    // Check video.src directly
    if (video.src && (video.src.includes('dropbox.com') || video.src.includes('dropboxusercontent.com'))) {
      return true;
    }
    
    // Check source elements (for videos created via innerHTML with <source> tags)
    const sources = video.querySelectorAll('source');
    for (let source of sources) {
      if (source.src && (source.src.includes('dropbox.com') || source.src.includes('dropboxusercontent.com'))) {
        return true;
      }
    }
    
    return false;
  }

  // Function to attach event listeners to a video element
  function attachVideoListeners(video) {
    if (!video || video.__videoMusicHooked) return; // Already hooked
    
    // Function to actually attach the event listeners
    const attachEventListeners = () => {
      if (video.__videoListenersAttached) return; // Already attached
      video.__videoListenersAttached = true;
      
      
      // If video is already playing (autoplay), stop music immediately
      if (!video.paused && activeVideoCount === 0) {
        musicWasPlayingBeforeVideo = (generalMusicAudio && !generalMusicAudio.paused);
        activeVideoCount++;
        stopGeneralMusic();
      }

      // When video starts playing
    video.addEventListener('play', () => {
      if (isDropboxVideo(video)) {
        activeVideoCount++;
        
        // Stop music if this is the first video
        if (activeVideoCount === 1) {
          musicWasPlayingBeforeVideo = (generalMusicAudio && !generalMusicAudio.paused);
          stopGeneralMusic();
        }
      }
    });

    // When video pauses
    video.addEventListener('pause', () => {
      if (isDropboxVideo(video)) {
        activeVideoCount = Math.max(0, activeVideoCount - 1);
        
        // Resume music if no videos are playing
        if (activeVideoCount === 0 && musicWasPlayingBeforeVideo) {
          startGeneralMusic();
          musicWasPlayingBeforeVideo = false;
        }
      }
    });

    // When video ends
    video.addEventListener('ended', () => {
      if (isDropboxVideo(video)) {
        activeVideoCount = Math.max(0, activeVideoCount - 1);
        
        // Resume music if no videos are playing
        if (activeVideoCount === 0 && musicWasPlayingBeforeVideo) {
          startGeneralMusic();
          musicWasPlayingBeforeVideo = false;
        }
      }
    });

    // When video is removed from DOM
    const removeObserver = new MutationObserver((mutations) => {
      if (!document.body.contains(video)) {
        activeVideoCount = Math.max(0, activeVideoCount - 1);
        
        // Resume music if no videos are playing
        if (activeVideoCount === 0 && musicWasPlayingBeforeVideo) {
          startGeneralMusic();
          musicWasPlayingBeforeVideo = false;
        }
        
        removeObserver.disconnect();
      }
    });
    removeObserver.observe(document.body, { childList: true, subtree: true });
    };
    
    // Check if it's a Dropbox video - check immediately and also monitor for src changes
    if (isDropboxVideo(video)) {
      // It's a Dropbox video, attach listeners immediately
      attachEventListeners();
    } else {
      // Not a Dropbox video yet, but mark as checked so we can monitor for src changes
      video.__videoMusicHooked = true;
      
      // Monitor for src attribute changes or source elements being added
      const checkObserver = new MutationObserver(() => {
        if (isDropboxVideo(video)) {
          attachEventListeners();
          checkObserver.disconnect(); // Stop monitoring once we've hooked it
        }
      });
      checkObserver.observe(video, { 
        attributes: true, 
        attributeFilter: ['src'],
        childList: true,
        subtree: true
      });
      
      // Also check periodically in case src is set via JavaScript
      const checkInterval = setInterval(() => {
        if (isDropboxVideo(video)) {
          attachEventListeners();
          clearInterval(checkInterval);
          checkObserver.disconnect();
        }
      }, 500);
      
      // Stop checking after 10 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        checkObserver.disconnect();
      }, 10000);
      
      return; // Exit early, will hook later when src is set
    }
    
    video.__videoMusicHooked = true;
  }

  // Monitor for new video elements being added to the DOM
  const videoObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        // Check if the added node is a video element
        if (node.nodeName === 'VIDEO') {
          attachVideoListeners(node);
        }
        // Check if the added node contains video elements
        if (node.nodeType === 1) { // Element node
          const videos = node.querySelectorAll ? node.querySelectorAll('video') : [];
          videos.forEach(attachVideoListeners);
        }
      });
    });
  });

  // Start observing for new videos
  videoObserver.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Also attach listeners to any existing videos
  setTimeout(() => {
    const existingVideos = document.querySelectorAll('video');
    existingVideos.forEach(attachVideoListeners);
  }, 1000);

  // Expose functions for debugging
  window._debugGeneralMusic = {
    start: startGeneralMusic,
    stop: stopGeneralMusic,
    enabled: () => generalMusicEnabled,
    playing: () => generalMusicAudio && !generalMusicAudio.paused,
    activeVideoCount: () => activeVideoCount,
    musicWasPlaying: () => musicWasPlayingBeforeVideo
  };

})();