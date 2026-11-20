/* Music Control Modal JavaScript */
(function() {
  'use strict';

  // Open music control modal
  function openMusicControlModal() {
    const modal = document.getElementById('musicControlModal');
    if (!modal) return;
    
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    
    // Initialize sliders with current values
    updateMusicControlUI();
  }

  // Close music control modal
  function closeMusicControlModal() {
    const modal = document.getElementById('musicControlModal');
    if (!modal) return;
    
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }

  // Update music control UI with current values
  function updateMusicControlUI() {
    // Music volume
    const musicVolume = window._getMusicVolume ? window._getMusicVolume() : 0.6;
    const musicMuted = window._isMusicMuted ? window._isMusicMuted() : false;
    const musicSlider = document.getElementById('musicVolumeSlider');
    const musicDisplay = document.getElementById('musicVolumeDisplay');
    const musicMuteBtn = document.getElementById('musicMuteBtn');
    
    if (musicSlider) {
      musicSlider.value = Math.round(musicVolume * 100);
    }
    if (musicDisplay) {
      musicDisplay.textContent = musicMuted ? 'Muted' : Math.round(musicVolume * 100) + '%';
    }
    if (musicMuteBtn) {
      musicMuteBtn.textContent = musicMuted ? '🔇' : '🔊';
    }

    // Sound effects volume
    const sfxVolume = window._getSoundEffectsVolume ? window._getSoundEffectsVolume() : 1.0;
    const sfxMuted = window._isSoundEffectsMuted ? window._isSoundEffectsMuted() : false;
    const sfxSlider = document.getElementById('sfxVolumeSlider');
    const sfxDisplay = document.getElementById('sfxVolumeDisplay');
    const sfxMuteBtn = document.getElementById('sfxMuteBtn');
    
    if (sfxSlider) {
      sfxSlider.value = Math.round(sfxVolume * 100);
    }
    if (sfxDisplay) {
      sfxDisplay.textContent = sfxMuted ? 'Muted' : Math.round(sfxVolume * 100) + '%';
    }
    if (sfxMuteBtn) {
      sfxMuteBtn.textContent = sfxMuted ? '🔇' : '🔊';
    }
  }

  // Set music volume from slider
  function setMusicVolumeFromSlider(value) {
    const volume = parseFloat(value) / 100;
    if (window._setMusicVolume) {
      window._setMusicVolume(volume);
    }
    updateMusicControlUI();
  }

  // Adjust music volume
  function adjustMusicVolume(delta) {
    const currentVolume = window._getMusicVolume ? window._getMusicVolume() : 0.6;
    const newVolume = Math.max(0, Math.min(1, currentVolume + delta));
    if (window._setMusicVolume) {
      window._setMusicVolume(newVolume);
    }
    updateMusicControlUI();
  }

  // Toggle music mute
  function toggleMusicMute() {
    if (window._toggleMusicMute) {
      window._toggleMusicMute();
    }
    updateMusicControlUI();
  }

  // Set sound effects volume from slider
  function setSoundEffectsVolumeFromSlider(value) {
    const volume = parseFloat(value) / 100;
    if (window._setSoundEffectsVolume) {
      window._setSoundEffectsVolume(volume);
    }
    updateMusicControlUI();
  }

  // Adjust sound effects volume
  function adjustSoundEffectsVolume(delta) {
    const currentVolume = window._getSoundEffectsVolume ? window._getSoundEffectsVolume() : 1.0;
    const newVolume = Math.max(0, Math.min(1, currentVolume + delta));
    if (window._setSoundEffectsVolume) {
      window._setSoundEffectsVolume(newVolume);
    }
    updateMusicControlUI();
  }

  // Toggle sound effects mute
  function toggleSoundEffectsMute() {
    if (window._toggleSoundEffectsMute) {
      window._toggleSoundEffectsMute();
    }
    updateMusicControlUI();
  }

  // Expose functions globally
  window.openMusicControlModal = openMusicControlModal;
  window.closeMusicControlModal = closeMusicControlModal;
  window.setMusicVolumeFromSlider = setMusicVolumeFromSlider;
  window.adjustMusicVolume = adjustMusicVolume;
  window.toggleMusicMute = toggleMusicMute;
  window.setSoundEffectsVolumeFromSlider = setSoundEffectsVolumeFromSlider;
  window.adjustSoundEffectsVolume = adjustSoundEffectsVolume;
  window.toggleSoundEffectsMute = toggleSoundEffectsMute;

  // Initialize UI when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateMusicControlUI);
  } else {
    updateMusicControlUI();
  }
})();