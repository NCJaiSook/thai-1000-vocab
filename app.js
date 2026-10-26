// Thai Vocabulary 1,000 Web App for Beginners (Tablet & Desktop)
// Controller with Local Multi-Profile, Learned Tracking & Beginner-Friendly English UI

const POS_ENGLISH_MAP = {
  'คำนาม': 'Noun',
  'คำกริยา': 'Verb',
  'คำคุณศัพท์': 'Adjective',
  'คำวิเศษณ์': 'Adverb',
  'คำสรรพนาม': 'Pronoun',
  'คำทักทาย': 'Greeting',
  'วลี': 'Phrase',
  'สำนวน': 'Idiom',
  'สุภาษิต': 'Proverb'
};

class VocabApp {
  constructor() {
    this.words = [];
    this.categories = INITIAL_CATEGORIES;
    this.currentCategory = 'all';
    this.statusFilter = 'all'; // 'all' | 'unlearned' | 'learned' | 'favorites'
    this.searchQuery = '';
    this.currentTab = 'list'; // 'list' | 'unlearned' | 'learned' | 'favorites' | 'flashcard' | 'quiz'
    this.displayLimit = 100; // Render 100 items initially for fast 60fps performance on tablets

    // Voice & Speech settings
    this.speechSpeed = 1.0;
    this.voiceEngine = 'google'; // 'google' | 'device'
    this.currentAudio = null;

    // Multi-Profile State
    this.profiles = [];
    this.activeProfileId = null;
    this.favorites = new Set();
    this.learned = new Set();

    // Flashcard State
    this.flashcardIndex = 0;
    this.isFlipped = false;
    this.flashcardList = [];
    this.fcCategory = 'all';
    this.fcStatus = 'all';
    this.fcDirection = 'th-en'; // 'th-en' | 'en-th'
    this.fcAutoSpeak = false;

    // Quiz State
    this.quizCategory = 'all';
    this.quizPool = 'all';
    this.quizType = 'mixed'; // 'mixed' | 'th-to-en' | 'en-to-th' | 'pronunciation'
    this.quizQuestions = [];
    this.quizCurrentIndex = 0;
    this.quizScore = 0;
    this.quizAnswered = false;

    // Audio Context for sound effects
    this.audioCtx = null;
    this.toastTimer = null;

    this.init();
  }

  init() {
    this.loadCustomWords();
    this.initProfiles();
    this.updateCategoryCounts();
    this.setupEventListeners();
    this.populateCategorySelects();
    this.renderCategories();
    this.renderWordList();
    this.updateProfileUI();
    this.setupSpeechSynthesis();
  }

  // --- Toast Helper ---
  showToast(message, icon = '✅') {
    const toast = document.getElementById('toastNotification');
    const iconEl = document.getElementById('toastIcon');
    const msgEl = document.getElementById('toastMessage');
    if (!toast || !msgEl) return;

    if (iconEl) iconEl.textContent = icon;
    msgEl.textContent = message;
    toast.classList.remove('hidden');

    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      toast.classList.add('hidden');
    }, 2800);
  }

  // --- Audio Effects via Web Audio API ---
  getAudioContext() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  playBeep(type = 'correct') {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      if (type === 'correct') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.15);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'wrong') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(160, now + 0.25);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === 'flip') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(420, now);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      }
    } catch (e) {
      console.warn('Audio effect error:', e);
    }
  }

  // --- Voice Pronunciation Engine (Google Native Thai & Device Fallback) ---
  setupSpeechSynthesis() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }

  speak(text, speedMultiplier = 1) {
    if (!text) return;
    if (this.voiceEngine === 'google') {
      this.speakGoogle(text, speedMultiplier);
    } else {
      this.speakDevice(text, speedMultiplier);
    }
  }

  speakGoogle(text, speedMultiplier = 1) {
    const speakerPill = document.getElementById('speakingIndicator');

    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    if (speakerPill) speakerPill.classList.remove('hidden');

    const cleanWord = text.trim();
    const targetSpeed = Math.max(0.5, Math.min(2.0, this.speechSpeed * speedMultiplier));
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanWord)}&tl=th&client=tw-ob`;

    const audio = new Audio();
    audio.src = url;
    audio.playbackRate = targetSpeed;
    this.currentAudio = audio;

    const cleanup = () => {
      if (speakerPill) speakerPill.classList.add('hidden');
      if (this.currentAudio === audio) this.currentAudio = null;
    };

    audio.onended = cleanup;
    audio.onerror = () => {
      cleanup();
      this.speakDevice(text, speedMultiplier);
    };

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        cleanup();
        this.speakDevice(text, speedMultiplier);
      });
    }
  }

  speakDevice(text, speedMultiplier = 1) {
    if (!('speechSynthesis' in window)) {
      this.showToast('Text-to-Speech is not supported on this browser', '⚠️');
      return;
    }

    window.speechSynthesis.cancel();
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'th-TH';
    utterance.rate = (this.speechSpeed * speedMultiplier);
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const thaiVoices = voices.filter(v => v.lang.toLowerCase().startsWith('th') || v.name.toLowerCase().includes('thai'));
    
    if (thaiVoices.length > 0) {
      const bestVoice = thaiVoices.find(v => {
        const name = v.name.toLowerCase();
        return name.includes('natural') || name.includes('neural') || name.includes('siri') || name.includes('google') || name.includes('niwat') || name.includes('premwadee');
      }) || thaiVoices[0];
      utterance.voice = bestVoice;
    }

    const speakerPill = document.getElementById('speakingIndicator');
    if (speakerPill) {
      speakerPill.classList.remove('hidden');
      utterance.onend = () => speakerPill.classList.add('hidden');
      utterance.onerror = () => speakerPill.classList.add('hidden');
    }

    window.speechSynthesis.speak(utterance);
  }

  // --- Local Multi-Profile Management + Export / Import ---
  initProfiles() {
    try {
      const storedProfiles = localStorage.getItem('thai_vocab_profiles_v2');
      const storedActiveId = localStorage.getItem('thai_vocab_active_profile_id');

      if (storedProfiles) {
        this.profiles = JSON.parse(storedProfiles);
      }

      if (!Array.isArray(this.profiles) || this.profiles.length === 0) {
        // Migrate legacy favorites if present
        let legacyFavs = [];
        try {
          const oldFav = localStorage.getItem('thai_vocab_favorites');
          if (oldFav) legacyFavs = JSON.parse(oldFav);
        } catch (e) {}

        const defaultProfile = {
          id: 'profile_default',
          name: 'Learner 1',
          avatar: '🪷',
          createdAt: new Date().toISOString(),
          learned: [],
          favorites: Array.isArray(legacyFavs) ? legacyFavs : [],
          settings: {
            voiceEngine: 'google',
            speechSpeed: 1.0
          },
          quizStats: {
            quizzesPlayed: 0,
            bestScore: 0,
            lastScore: 0
          }
        };
        this.profiles = [defaultProfile];
        this.activeProfileId = defaultProfile.id;
        this.saveProfilesToStorage();
      } else {
        const found = this.profiles.find(p => p.id === storedActiveId);
        this.activeProfileId = found ? found.id : this.profiles[0].id;
      }
    } catch (e) {
      console.warn('Error loading profiles:', e);
      this.profiles = [{
        id: 'profile_default',
        name: 'Learner 1',
        avatar: '🪷',
        createdAt: new Date().toISOString(),
        learned: [],
        favorites: [],
        settings: { voiceEngine: 'google', speechSpeed: 1.0 },
        quizStats: { quizzesPlayed: 0, bestScore: 0, lastScore: 0 }
      }];
      this.activeProfileId = 'profile_default';
    }

    this.applyActiveProfileState();
  }

  getActiveProfile() {
    return this.profiles.find(p => p.id === this.activeProfileId) || this.profiles[0];
  }

  applyActiveProfileState() {
    const profile = this.getActiveProfile();
    if (!profile) return;

    this.learned = new Set(Array.isArray(profile.learned) ? profile.learned : []);
    this.favorites = new Set(Array.isArray(profile.favorites) ? profile.favorites : []);

    if (profile.settings) {
      this.voiceEngine = profile.settings.voiceEngine || 'google';
      this.speechSpeed = parseFloat(profile.settings.speechSpeed) || 1.0;
    }

    const voiceSelect = document.getElementById('voiceEngineSelect');
    if (voiceSelect) voiceSelect.value = this.voiceEngine;

    const speedSelect = document.getElementById('speechSpeedSelect');
    if (speedSelect) speedSelect.value = this.speechSpeed.toFixed(1);
  }

  saveProfilesToStorage() {
    const profile = this.getActiveProfile();
    if (profile) {
      profile.learned = [...this.learned];
      profile.favorites = [...this.favorites];
      profile.settings = {
        voiceEngine: this.voiceEngine,
        speechSpeed: this.speechSpeed
      };
    }
    try {
      localStorage.setItem('thai_vocab_profiles_v2', JSON.stringify(this.profiles));
      localStorage.setItem('thai_vocab_active_profile_id', this.activeProfileId);
      // Keep legacy key synced for backward compatibility
      localStorage.setItem('thai_vocab_favorites', JSON.stringify([...this.favorites]));
    } catch (e) {
      console.warn('Save profile error:', e);
    }
  }

  switchProfile(profileId) {
    const target = this.profiles.find(p => p.id === profileId);
    if (!target) return;

    this.saveProfilesToStorage();
    this.activeProfileId = target.id;
    localStorage.setItem('thai_vocab_active_profile_id', this.activeProfileId);

    this.applyActiveProfileState();
    this.updateCategoryCounts();
    this.updateProfileUI();
    this.renderCategories();
    this.renderWordList();
    if (this.currentTab === 'flashcard') this.setupFlashcards();
    if (this.currentTab === 'quiz') this.setupQuiz();
    this.renderProfileModalList();
    this.showToast(`Switched to profile "${target.name}"`, target.avatar);
  }

  createProfile(name, avatar = '🪷') {
    const cleanName = (name || '').trim();
    if (!cleanName) return;

    const newProfile = {
      id: 'profile_' + Date.now(),
      name: cleanName,
      avatar: avatar || '🪷',
      createdAt: new Date().toISOString(),
      learned: [],
      favorites: [],
      settings: {
        voiceEngine: this.voiceEngine,
        speechSpeed: this.speechSpeed
      },
      quizStats: {
        quizzesPlayed: 0,
        bestScore: 0,
        lastScore: 0
      }
    };

    this.profiles.push(newProfile);
    this.switchProfile(newProfile.id);
  }

  deleteProfile(profileId) {
    if (this.profiles.length <= 1) {
      this.showToast('At least 1 profile is required', '⚠️');
      return;
    }
    const target = this.profiles.find(p => p.id === profileId);
    if (!target) return;

    if (!confirm(`Are you sure you want to delete profile "${target.name}" and all its learning progress?`)) {
      return;
    }

    this.profiles = this.profiles.filter(p => p.id !== profileId);
    if (this.activeProfileId === profileId) {
      this.activeProfileId = this.profiles[0].id;
      this.applyActiveProfileState();
    }
    this.saveProfilesToStorage();
    this.updateCategoryCounts();
    this.updateProfileUI();
    this.renderCategories();
    this.renderWordList();
    this.renderProfileModalList();
    this.showToast(`Deleted profile "${target.name}"`, '🗑️');
  }

  resetProfileProgress(profileId) {
    const target = this.profiles.find(p => p.id === profileId);
    if (!target) return;

    if (!confirm(`Are you sure you want to reset all learned words for "${target.name}"?`)) {
      return;
    }

    target.learned = [];
    if (target.id === this.activeProfileId) {
      this.learned.clear();
    }
    this.saveProfilesToStorage();
    this.updateCategoryCounts();
    this.updateProfileUI();
    this.renderCategories();
    this.renderWordList();
    this.renderProfileModalList();
    this.showToast(`Reset progress for "${target.name}"`, '🔄');
  }

  getBackupPayload() {
    this.saveProfilesToStorage();
    const customWords = JSON.parse(localStorage.getItem('thai_vocab_custom') || '[]');
    return {
      app: 'ThaiVocab1000',
      version: 2,
      exportedAt: new Date().toISOString(),
      activeProfileId: this.activeProfileId,
      profiles: this.profiles,
      customWords: customWords
    };
  }

  exportBackupFile() {
    const payload = this.getBackupPayload();
    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const activeProfile = this.getActiveProfile();
    const safeName = (activeProfile ? activeProfile.name : 'learner').replace(/[^a-zA-Z0-9ก-๙_-]/g, '_');
    const dateStr = new Date().toISOString().slice(0, 10);

    const a = document.createElement('a');
    a.href = url;
    a.download = `thai-vocab-profile-${safeName}-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.showToast('Backup file downloaded successfully', '📥');
  }

  copyBackupCode() {
    const payload = this.getBackupPayload();
    const jsonStr = JSON.stringify(payload);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(jsonStr).then(() => {
        this.showToast('Backup code copied to clipboard', '📋');
      }).catch(() => {
        this.fallbackCopyText(jsonStr);
      });
    } else {
      this.fallbackCopyText(jsonStr);
    }
  }

  fallbackCopyText(text) {
    const input = document.getElementById('importCodeInput');
    if (input) {
      input.value = text;
      input.select();
      document.execCommand('copy');
      this.showToast('Backup code copied (paste on another device to import)', '📋');
    }
  }

  importBackupData(rawJsonString) {
    try {
      const data = JSON.parse(rawJsonString.trim());
      if (!data || (!Array.isArray(data.profiles) && !data.learned)) {
        alert('Invalid backup format. Please check your JSON file or backup code.');
        return;
      }

      // Import custom words if included
      if (Array.isArray(data.customWords) && data.customWords.length > 0) {
        const existingCustom = JSON.parse(localStorage.getItem('thai_vocab_custom') || '[]');
        const existingIds = new Set(existingCustom.map(w => w.id));
        data.customWords.forEach(cw => {
          if (cw && cw.id && !existingIds.has(cw.id)) {
            existingCustom.push(cw);
          }
        });
        localStorage.setItem('thai_vocab_custom', JSON.stringify(existingCustom));
        this.loadCustomWords();
      }

      // Import profiles (merge by id or add)
      if (Array.isArray(data.profiles)) {
        data.profiles.forEach(incoming => {
          if (!incoming || !incoming.id) return;
          const idx = this.profiles.findIndex(p => p.id === incoming.id);
          if (idx >= 0) {
            // Merge learned and favorites sets
            const mergedLearned = [...new Set([...(this.profiles[idx].learned || []), ...(incoming.learned || [])])];
            const mergedFavs = [...new Set([...(this.profiles[idx].favorites || []), ...(incoming.favorites || [])])];
            this.profiles[idx] = {
              ...this.profiles[idx],
              ...incoming,
              learned: mergedLearned,
              favorites: mergedFavs
            };
          } else {
            this.profiles.push(incoming);
          }
        });
        if (data.activeProfileId && this.profiles.some(p => p.id === data.activeProfileId)) {
          this.activeProfileId = data.activeProfileId;
        }
      }

      this.applyActiveProfileState();
      this.saveProfilesToStorage();
      this.updateCategoryCounts();
      this.updateProfileUI();
      this.renderCategories();
      this.renderWordList();
      this.renderProfileModalList();

      const importCodeInput = document.getElementById('importCodeInput');
      if (importCodeInput) importCodeInput.value = '';

      this.showToast('Profile & learning progress imported successfully!', '🎉');
    } catch (e) {
      console.error('Import error:', e);
      alert('Could not read backup data. Please make sure the JSON file or code is valid.');
    }
  }

  renderProfileModalList() {
    const container = document.getElementById('profileListContainer');
    if (!container) return;

    const totalWords = this.words.length;

    container.innerHTML = this.profiles.map(p => {
      const isActive = p.id === this.activeProfileId;
      const learnedCount = Array.isArray(p.learned) ? p.learned.length : 0;
      const favCount = Array.isArray(p.favorites) ? p.favorites.length : 0;
      const pct = totalWords > 0 ? Math.round((learnedCount / totalWords) * 100) : 0;
      const quizzes = p.quizStats ? p.quizStats.quizzesPlayed || 0 : 0;

      return `
        <div class="p-4 rounded-2xl border-2 transition-all flex flex-col justify-between gap-3 ${
          isActive
            ? 'border-indigo-600 bg-indigo-50/50 shadow-sm'
            : 'border-slate-200 bg-white hover:border-indigo-300'
        }">
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-3 cursor-pointer flex-grow select-profile-trigger" data-id="${p.id}">
              <div class="w-11 h-11 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-2xl shadow-2xs">
                ${p.avatar || '🪷'}
              </div>
              <div>
                <div class="flex items-center gap-1.5">
                  <span class="font-bold text-slate-800 text-sm md:text-base">${p.name}</span>
                  ${isActive ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white">Active</span>' : ''}
                </div>
                <div class="text-xs text-slate-500 mt-0.5">
                  ✅ Learned <strong class="text-emerald-700">${learnedCount}/${totalWords}</strong> (${pct}%) • ❤️ ${favCount} • 🎯 Quizzes: ${quizzes}
                </div>
              </div>
            </div>
          </div>

          <div class="w-full bg-slate-200/80 rounded-full h-1.5 overflow-hidden">
            <div class="bg-emerald-500 h-1.5 rounded-full" style="width: ${pct}%"></div>
          </div>

          <div class="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
            ${!isActive ? `
              <button class="select-profile-trigger px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all" data-id="${p.id}">
                Switch to Profile
              </button>
            ` : `
              <span class="text-[11px] font-bold text-indigo-700">✓ Current Profile</span>
            `}
            <div class="flex items-center gap-1.5 ml-auto">
              <button class="reset-profile-btn px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-800 text-[11px] font-semibold transition-colors" data-id="${p.id}" title="Reset learned words">
                Reset
              </button>
              ${this.profiles.length > 1 ? `
                <button class="delete-profile-btn px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 text-[11px] font-semibold transition-colors" data-id="${p.id}" title="Delete profile">
                  Delete
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.select-profile-trigger').forEach(el => {
      el.addEventListener('click', () => this.switchProfile(el.dataset.id));
    });
    container.querySelectorAll('.reset-profile-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.resetProfileProgress(btn.dataset.id);
      });
    });
    container.querySelectorAll('.delete-profile-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteProfile(btn.dataset.id);
      });
    });
  }

  updateProfileUI() {
    const profile = this.getActiveProfile();
    if (!profile) return;

    const total = this.words.length;
    const learnedCount = this.learned.size;
    const unlearnedCount = Math.max(0, total - learnedCount);
    const favCount = this.favorites.size;
    const pct = total > 0 ? Math.round((learnedCount / total) * 100) : 0;

    // Header button
    const headerAvatar = document.getElementById('headerProfileAvatar');
    const headerName = document.getElementById('headerProfileName');
    const headerProgress = document.getElementById('headerProfileProgress');
    if (headerAvatar) headerAvatar.textContent = profile.avatar || '🪷';
    if (headerName) headerName.textContent = profile.name;
    if (headerProgress) headerProgress.textContent = `✓ ${learnedCount}/${total} (${pct}%)`;

    // Banner in Explorer
    const bannerAvatar = document.getElementById('bannerAvatar');
    const bannerName = document.getElementById('bannerProfileName');
    const overallText = document.getElementById('overallProgressText');
    const overallBar = document.getElementById('overallProgressBar');
    const statUnlearned = document.getElementById('statUnlearned');
    const statLearned = document.getElementById('statLearned');
    const statFavorites = document.getElementById('statFavorites');
    const bannerCatBadge = document.getElementById('bannerCategoryProgressBadge');

    if (bannerAvatar) bannerAvatar.textContent = profile.avatar || '🪷';
    if (bannerName) bannerName.textContent = profile.name;
    if (overallText) overallText.textContent = `${learnedCount} / ${total.toLocaleString()} Words (${pct}%)`;
    if (overallBar) overallBar.style.width = `${pct}%`;
    if (statUnlearned) statUnlearned.textContent = `⏳ To Learn: ${unlearnedCount}`;
    if (statLearned) statLearned.textContent = `✅ Learned: ${learnedCount}`;
    if (statFavorites) statFavorites.textContent = `❤️ Favorites: ${favCount}`;

    if (bannerCatBadge) {
      if (this.currentCategory === 'all') {
        bannerCatBadge.textContent = `All Categories: ${learnedCount} / ${total} Learned`;
      } else {
        const catWords = this.words.filter(w => w.category === this.currentCategory);
        const catLearned = catWords.filter(w => this.learned.has(w.id)).length;
        const catObj = this.categories.find(c => c.id === this.currentCategory);
        bannerCatBadge.textContent = `${catObj ? catObj.icon + ' ' + (catObj.nameEn || catObj.name) : 'Category'}: ${catLearned} / ${catWords.length} Learned`;
      }
    }

    // Top Navigation Badges
    const allBadge = document.getElementById('allCountBadge');
    const unlearnedBadge = document.getElementById('unlearnedCountBadge');
    const learnedBadge = document.getElementById('learnedCountBadge');
    const favBadge = document.getElementById('favCountBadge');

    if (allBadge) allBadge.textContent = total;
    if (unlearnedBadge) unlearnedBadge.textContent = unlearnedCount;
    if (learnedBadge) learnedBadge.textContent = learnedCount;
    if (favBadge) favBadge.textContent = favCount;

    // Status Filter Pills active state
    document.querySelectorAll('.status-filter-btn').forEach(btn => {
      const st = btn.dataset.status;
      const active = st === this.statusFilter;
      btn.className = `status-filter-btn px-3 py-1.5 rounded-xl text-xs transition-all whitespace-nowrap ${
        active
          ? 'bg-indigo-600 text-white font-bold shadow-xs'
          : 'bg-slate-100 text-slate-600 font-semibold hover:bg-slate-200'
      }`;
    });
  }

  // --- Learned (✓) & Favorites (❤️) Toggles ---
  toggleLearned(id, e) {
    if (e) e.stopPropagation();
    const isNowLearned = !this.learned.has(id);
    if (isNowLearned) {
      this.learned.add(id);
      this.playBeep('correct');
    } else {
      this.learned.delete(id);
      this.playBeep('flip');
    }

    this.saveProfilesToStorage();
    this.updateCategoryCounts();
    this.updateProfileUI();
    this.renderCategories();

    // If user is filtering specifically by unlearned or learned, re-render list so card moves cleanly
    if (this.statusFilter === 'unlearned' || this.statusFilter === 'learned') {
      this.renderWordList();
    } else {
      this.updateCardLearnedUI(id);
    }

    if (this.currentTab === 'flashcard') {
      this.updateFlashcardLearnedButton();
    }
  }

  updateCardLearnedUI(id) {
    const isLearned = this.learned.has(id);
    document.querySelectorAll(`.vocab-card-${id}`).forEach(card => {
      card.classList.toggle('border-emerald-300', isLearned);
      card.classList.toggle('bg-emerald-50/15', isLearned);
      card.classList.toggle('border-slate-100', !isLearned);
    });

    document.querySelectorAll(`.learned-btn-${id}`).forEach(btn => {
      if (isLearned) {
        btn.className = `learned-btn learned-btn-${id} px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 transition-all bg-emerald-600 text-white shadow-xs hover:bg-emerald-700 active:scale-95`;
        btn.innerHTML = `<svg class="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg><span>Learned</span>`;
      } else {
        btn.className = `learned-btn learned-btn-${id} px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1 transition-all bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200/80 active:scale-95`;
        btn.innerHTML = `<svg class="w-4 h-4 stroke-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg><span>Learned</span>`;
      }
    });
  }

  toggleFavorite(id, e) {
    if (e) e.stopPropagation();
    if (this.favorites.has(id)) {
      this.favorites.delete(id);
    } else {
      this.favorites.add(id);
      this.playBeep('correct');
    }
    this.saveProfilesToStorage();
    this.updateCategoryCounts();
    this.updateProfileUI();

    if (this.statusFilter === 'favorites') {
      this.renderWordList();
    } else {
      this.updateFavoriteButtons(id);
    }
  }

  updateFavoriteButtons(id) {
    const isFav = this.favorites.has(id);
    document.querySelectorAll(`.fav-btn-${id}`).forEach(btn => {
      btn.innerHTML = isFav 
        ? `<svg class="w-5 h-5 fill-rose-500 text-rose-500" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`
        : `<svg class="w-5 h-5 text-slate-400 hover:text-rose-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>`;
    });
  }

  // --- Custom Words ---
  loadCustomWords() {
    let custom = [];
    try {
      const stored = localStorage.getItem('thai_vocab_custom');
      if (stored) custom = JSON.parse(stored);
    } catch (e) {
      custom = [];
    }
    this.words = [...INITIAL_WORDS, ...custom];
  }

  addCustomWord(wordObj) {
    const custom = JSON.parse(localStorage.getItem('thai_vocab_custom') || '[]');
    custom.unshift(wordObj);
    localStorage.setItem('thai_vocab_custom', JSON.stringify(custom));
    this.words = [...INITIAL_WORDS, ...custom];
    this.updateCategoryCounts();
    this.populateCategorySelects();
    this.renderCategories();
    this.renderWordList();
    this.updateProfileUI();
  }

  updateCategoryCounts() {
    const counts = { all: this.words.length };
    const learnedByCat = { all: this.learned.size };

    this.words.forEach(w => {
      counts[w.category] = (counts[w.category] || 0) + 1;
      if (this.learned.has(w.id)) {
        learnedByCat[w.category] = (learnedByCat[w.category] || 0) + 1;
      }
    });

    this.categories.forEach(cat => {
      cat.count = counts[cat.id] || 0;
      cat.learnedCount = learnedByCat[cat.id] || 0;
    });
  }

  populateCategorySelects() {
    const selectors = ['fcCategorySelect', 'quizCategorySelect'];
    selectors.forEach(selId => {
      const el = document.getElementById(selId);
      if (!el) return;
      const currentVal = el.value || 'all';
      el.innerHTML = this.categories.map(cat => `
        <option value="${cat.id}" ${currentVal === cat.id ? 'selected' : ''}>
          ${cat.icon} ${cat.nameEn || cat.name} (${cat.count} words)
        </option>
      `).join('');
    });
  }

  // --- Filtering ---
  getFilteredWords(categoryOverride = null, statusOverride = null) {
    const targetCat = categoryOverride !== null ? categoryOverride : this.currentCategory;
    const targetStatus = statusOverride !== null ? statusOverride : this.statusFilter;

    let list = this.words;

    if (targetCat !== 'all') {
      list = list.filter(w => w.category === targetCat);
    }

    if (targetStatus === 'unlearned') {
      list = list.filter(w => !this.learned.has(w.id));
    } else if (targetStatus === 'learned') {
      list = list.filter(w => this.learned.has(w.id));
    } else if (targetStatus === 'favorites') {
      list = list.filter(w => this.favorites.has(w.id));
    }

    if (categoryOverride === null && this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      list = list.filter(w => 
        w.word.toLowerCase().includes(q) ||
        (w.english && w.english.toLowerCase().includes(q)) ||
        w.pronunciation.toLowerCase().includes(q) ||
        w.meaning.toLowerCase().includes(q) ||
        (w.romanization && w.romanization.toLowerCase().includes(q))
      );
    }
    return list;
  }

  // --- Render Categories (Pills + Pull-Down Menu) ---
  renderCategories() {
    const container = document.getElementById('categoriesContainer');
    const selectEl = document.getElementById('categorySelect');

    if (selectEl) {
      selectEl.innerHTML = this.categories.map(cat => `
        <option value="${cat.id}" ${this.currentCategory === cat.id ? 'selected' : ''}>
          ${cat.icon} ${cat.nameEn || cat.name} (✓ ${cat.learnedCount || 0}/${cat.count})
        </option>
      `).join('');
    }

    if (!container) return;

    container.innerHTML = this.categories.map(cat => {
      const isActive = this.currentCategory === cat.id;
      const learnedCount = cat.learnedCount || 0;
      const badgeText = learnedCount > 0 ? `✓ ${learnedCount}/${cat.count}` : `${cat.count}`;
      const displayName = cat.nameEn || cat.name;

      return `
        <button 
          data-category="${cat.id}"
          class="category-btn flex items-center gap-2.5 px-4 py-2.5 rounded-2xl font-medium transition-all text-xs md:text-sm whitespace-nowrap shadow-xs border ${
            isActive 
              ? 'bg-gradient-to-r ' + cat.color + ' text-white border-transparent shadow-md scale-[1.03]' 
              : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200/80 hover:border-slate-300'
          }"
        >
          <span class="text-xl">${cat.icon}</span>
          <div class="text-left leading-tight">
            <div class="font-bold">${displayName}</div>
          </div>
          <span class="px-2 py-0.5 rounded-full text-xs font-bold ${
            isActive
              ? 'bg-white/25 text-white'
              : learnedCount > 0
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-slate-100 text-slate-500'
          }">${badgeText}</span>
        </button>
      `;
    }).join('');

    container.querySelectorAll('.category-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentCategory = btn.dataset.category;
        this.displayLimit = 100;
        if (selectEl) selectEl.value = this.currentCategory;

        this.updateProfileUI();
        this.renderCategories();
        this.renderWordList();
        btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      });
    });
  }

  // --- Render Word List (Grid Layout with Checkmark Button & Sentence Audio) ---
  renderWordList() {
    const container = document.getElementById('wordListGrid');
    const emptyState = document.getElementById('emptyState');
    const resultCount = document.getElementById('resultCount');
    const loadMoreContainer = document.getElementById('loadMoreContainer');
    const loadMoreInfo = document.getElementById('loadMoreInfo');

    if (!container) return;

    const fullList = this.getFilteredWords();

    if (resultCount) {
      resultCount.textContent = `Showing ${Math.min(fullList.length, this.displayLimit)} of ${fullList.length.toLocaleString()} words`;
    }

    if (fullList.length === 0) {
      container.innerHTML = '';
      if (loadMoreContainer) loadMoreContainer.classList.add('hidden');
      if (emptyState) {
        emptyState.classList.remove('hidden');
        const titleEl = document.getElementById('emptyStateTitle');
        const descEl = document.getElementById('emptyStateDesc');
        const iconEl = document.getElementById('emptyStateIcon');

        if (this.statusFilter === 'learned') {
          if (iconEl) iconEl.textContent = '🌱';
          if (titleEl) titleEl.textContent = 'No Learned Words Yet in This Category';
          if (descEl) descEl.textContent = 'Tap the "✓ Learned" button on any word card once you memorize it to track your progress.';
        } else if (this.statusFilter === 'unlearned') {
          if (iconEl) iconEl.textContent = '🎉';
          if (titleEl) titleEl.textContent = 'Awesome! You Have Mastered All Words in This Category!';
          if (descEl) descEl.textContent = 'Try selecting another category or take a Quiz to test your memory.';
        } else if (this.statusFilter === 'favorites') {
          if (iconEl) iconEl.textContent = '❤️';
          if (titleEl) titleEl.textContent = 'No Favorite Words Saved Yet';
          if (descEl) descEl.textContent = 'Tap the heart icon ❤️ on any word card to bookmark it for quick review.';
        } else {
          if (iconEl) iconEl.textContent = '🔍';
          if (titleEl) titleEl.textContent = 'No matching words found';
          if (descEl) descEl.textContent = 'Try adjusting your search query, status filter, or selecting another category.';
        }
      }
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    const visibleList = fullList.slice(0, this.displayLimit);

    if (loadMoreContainer) {
      if (fullList.length > this.displayLimit) {
        loadMoreContainer.classList.remove('hidden');
        if (loadMoreInfo) {
          loadMoreInfo.textContent = `Showing first ${visibleList.length} of ${fullList.length} words`;
        }
      } else {
        loadMoreContainer.classList.add('hidden');
      }
    }

    container.innerHTML = visibleList.map(item => {
      const isFav = this.favorites.has(item.id);
      const isLearned = this.learned.has(item.id);
      const categoryObj = this.categories.find(c => c.id === item.category) || { name: 'General', nameEn: 'General', icon: '📖' };
      const englishPos = POS_ENGLISH_MAP[item.partOfSpeech] || item.partOfSpeech || 'Word';
      const catDisplayName = categoryObj.nameEn || categoryObj.name;

      return `
        <div class="vocab-card vocab-card-${item.id} bg-white rounded-3xl p-5 md:p-6 shadow-xs hover:shadow-xl transition-all duration-300 border ${
          isLearned ? 'border-emerald-300 bg-emerald-50/15' : 'border-slate-100'
        } flex flex-col justify-between group relative overflow-hidden">
          
          <!-- Top Tag, Checkmark (Learned) Button & Favorite Button -->
          <div class="flex items-center justify-between gap-1.5 mb-3 flex-wrap">
            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
              <span>${categoryObj.icon}</span>
              <span class="truncate max-w-[130px]">${catDisplayName}</span>
              <span class="text-slate-300">•</span>
              <span class="text-indigo-600 font-semibold">${englishPos}</span>
            </span>

            <div class="flex items-center gap-1.5">
              <!-- Checkmark Button for Learned Status -->
              <button 
                class="learned-btn learned-btn-${item.id} px-3 py-1.5 rounded-full text-xs ${
                  isLearned
                    ? 'font-bold bg-emerald-600 text-white shadow-xs hover:bg-emerald-700'
                    : 'font-semibold bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200/80'
                } flex items-center gap-1 transition-all active:scale-95"
                title="Mark as Learned"
                data-id="${item.id}"
              >
                <svg class="w-4 h-4 ${isLearned ? 'stroke-[2.5]' : 'stroke-2'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                </svg>
                <span>Learned</span>
              </button>

              <!-- Favorite Heart Button -->
              <button 
                class="fav-btn fav-btn-${item.id} p-1.5 rounded-full hover:bg-rose-50 transition-colors"
                title="Save to Favorites"
                data-id="${item.id}"
              >
                ${isFav 
                  ? `<svg class="w-5 h-5 fill-rose-500 text-rose-500" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`
                  : `<svg class="w-5 h-5 text-slate-400 group-hover:text-rose-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>`
                }
              </button>
            </div>
          </div>

          <!-- Main Thai Word, English Meaning & Dual Phonetic Guide -->
          <div class="mb-4 space-y-2">
            <div>
              <h3 class="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight leading-snug">${item.word}</h3>
              ${item.english ? `
                <div class="mt-1 inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs md:text-sm font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                  <span class="text-[10px] uppercase font-black px-1.5 py-0.2 rounded bg-indigo-600 text-white">EN</span>
                  <span>${item.english}</span>
                </div>
              ` : ''}
            </div>
            
            <!-- Dual Pronunciation Box: Romanization (for Beginners) + Thai Phonetics -->
            <div class="p-2.5 rounded-2xl bg-amber-50/90 border border-amber-200/70 space-y-1">
              ${item.romanization ? `
                <div class="flex items-center gap-1.5 text-xs md:text-sm">
                  <span class="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-amber-200/80 text-amber-900">Romanized</span>
                  <span class="font-mono font-bold text-amber-950 tracking-wide">${item.romanization}</span>
                </div>
              ` : ''}
              <div class="flex items-center gap-1.5 text-xs md:text-sm text-amber-800">
                <span class="text-[10px] font-bold uppercase tracking-wider text-amber-600">Thai Phonetics:</span>
                <span class="font-bold tracking-wide">${item.pronunciation}</span>
              </div>
            </div>
          </div>

          <!-- Meaning & Example Sentence with Sentence Audio Button -->
          <div class="text-slate-600 text-xs md:text-sm leading-relaxed mb-4 space-y-2.5 flex-grow">
            <p><span class="font-bold text-slate-700">Thai Definition:</span> ${item.meaning}</p>
            ${item.exampleSentence ? `
              <div class="p-3 bg-slate-50/90 rounded-2xl border-l-4 border-indigo-400 text-xs text-slate-600 flex items-start justify-between gap-2">
                <span class="italic leading-relaxed">"${item.exampleSentence}"</span>
                <button 
                  class="speak-btn p-1.5 rounded-xl bg-white hover:bg-indigo-50 text-indigo-600 border border-slate-200 flex-shrink-0 transition-colors"
                  title="Listen to Example Sentence"
                  data-word="${item.exampleSentence.replace(/"/g, '&quot;')}"
                  data-speed="0.9"
                >
                  🔊
                </button>
              </div>
            ` : ''}
          </div>

          <!-- Audio Pronunciation Buttons (Touch Friendly) -->
          <div class="pt-3 border-t border-slate-100 flex items-center gap-2">
            <button 
              class="speak-btn flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-semibold text-xs md:text-sm shadow-sm shadow-indigo-200 transition-all"
              data-word="${item.word.replace(/"/g, '&quot;')}"
              data-speed="1.0"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
              <span>Listen</span>
            </button>

            <button 
              class="speak-btn py-2.5 px-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-semibold text-xs transition-all"
              title="Listen Slowly (0.6x)"
              data-word="${item.word.replace(/"/g, '&quot;')}"
              data-speed="0.6"
            >
              🐢 Slow 0.6x
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Attach listeners
    container.querySelectorAll('.learned-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.toggleLearned(btn.dataset.id, e));
    });

    container.querySelectorAll('.fav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.toggleFavorite(btn.dataset.id, e));
    });

    container.querySelectorAll('.speak-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const word = btn.dataset.word;
        const speed = parseFloat(btn.dataset.speed) || 1.0;
        this.speak(word, speed);
      });
    });
  }

  // --- Flashcard Mode (Interactive 3D Flip with Learned Toggle & Direction Switch) ---
  setupFlashcards(syncFromExplorer = false) {
    const fcCatEl = document.getElementById('fcCategorySelect');
    const fcStatEl = document.getElementById('fcStatusSelect');

    if (syncFromExplorer) {
      this.fcCategory = this.currentCategory;
      this.fcStatus = this.statusFilter;
      if (fcCatEl) fcCatEl.value = this.fcCategory;
      if (fcStatEl) fcStatEl.value = this.fcStatus;
    } else {
      if (fcCatEl) this.fcCategory = fcCatEl.value || 'all';
      if (fcStatEl) this.fcStatus = fcStatEl.value || 'all';
    }

    this.flashcardList = this.getFilteredWords(this.fcCategory, this.fcStatus);
    if (this.flashcardList.length === 0) {
      this.flashcardList = this.getFilteredWords(this.fcCategory, 'all');
      if (this.flashcardList.length === 0) {
        this.flashcardList = this.words;
      }
      this.showToast('No words match that sub-filter; showing all words in category instead', 'ℹ️');
    }
    this.flashcardIndex = 0;
    this.isFlipped = false;
    this.renderCurrentFlashcard();
  }

  shuffleFlashcards() {
    if (this.flashcardList.length <= 1) return;
    this.flashcardList = [...this.flashcardList].sort(() => 0.5 - Math.random());
    this.flashcardIndex = 0;
    this.isFlipped = false;
    this.playBeep('flip');
    this.renderCurrentFlashcard();
    this.showToast('Flashcard deck shuffled', '🔀');
  }

  updateFlashcardLearnedButton() {
    const btn = document.getElementById('fcToggleLearnedBtn');
    if (!btn || this.flashcardList.length === 0) return;

    const item = this.flashcardList[this.flashcardIndex];
    const isLearned = this.learned.has(item.id);

    if (isLearned) {
      btn.className = 'py-3.5 px-4 rounded-2xl border-2 border-emerald-600 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-sm md:text-base shadow-md shadow-emerald-100 transition-all flex items-center justify-center gap-2';
      btn.innerHTML = `<svg class="w-5 h-5 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg><span>Learned</span>`;
    } else {
      btn.className = 'py-3.5 px-4 rounded-2xl border-2 border-emerald-500 bg-emerald-50 hover:bg-emerald-100 active:scale-95 text-emerald-800 font-bold text-sm md:text-base shadow-xs transition-all flex items-center justify-center gap-2';
      btn.innerHTML = `<svg class="w-5 h-5 stroke-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg><span>Learned</span>`;
    }
  }

  renderCurrentFlashcard() {
    if (this.flashcardList.length === 0) return;
    const item = this.flashcardList[this.flashcardIndex];
    const categoryObj = this.categories.find(c => c.id === item.category) || { name: 'General', nameEn: 'General', icon: '📖' };
    const englishPos = POS_ENGLISH_MAP[item.partOfSpeech] || item.partOfSpeech || 'Word';
    const catDisplayName = categoryObj.nameEn || categoryObj.name;
    const counterEl = document.getElementById('flashcardCounter');
    const cardEl = document.getElementById('flashcardElement');
    const isLearned = this.learned.has(item.id);

    if (counterEl) {
      counterEl.textContent = `${this.flashcardIndex + 1} / ${this.flashcardList.length}`;
    }

    this.updateFlashcardLearnedButton();

    if (cardEl) {
      cardEl.classList.remove('is-flipped');
      this.isFlipped = false;

      const front = cardEl.querySelector('.card-front');
      const back = cardEl.querySelector('.card-back');

      if (this.fcDirection === 'en-th') {
        // English on Front -> Guess Thai on Back
        front.innerHTML = `
          <div class="h-full flex flex-col justify-between p-6 md:p-8 text-center bg-gradient-to-br from-white via-indigo-50/40 to-blue-50/60 rounded-3xl border-2 ${isLearned ? 'border-emerald-400' : 'border-indigo-100'} shadow-xl">
            <div class="flex items-center justify-between gap-2">
              <span class="px-3 py-1 rounded-full text-xs font-semibold bg-white shadow-2xs border border-slate-200 text-slate-700">
                ${categoryObj.icon} ${catDisplayName}
              </span>
              <span class="text-xs text-indigo-600 font-semibold">Tap card to reveal Thai word 👆</span>
            </div>
            
            <div class="my-auto py-6 space-y-3">
              <span class="px-3 py-1 rounded-full text-xs uppercase font-bold bg-indigo-100 text-indigo-700">English Meaning • ${englishPos}</span>
              <h2 class="text-3xl md:text-5xl font-black text-slate-800 tracking-tight">${item.english || item.meaning}</h2>
              <p class="text-slate-500 text-sm max-w-md mx-auto">${item.meaning}</p>
            </div>

            <div class="text-xs text-slate-400 font-medium">
              Think of the Thai word and pronunciation before flipping the card
            </div>
          </div>
        `;
      } else {
        // Thai on Front -> Guess English & Meaning on Back
        front.innerHTML = `
          <div class="h-full flex flex-col justify-between p-6 md:p-8 text-center bg-gradient-to-br from-white via-indigo-50/30 to-blue-50/50 rounded-3xl border-2 ${isLearned ? 'border-emerald-400' : 'border-indigo-100'} shadow-xl">
            <div class="flex items-center justify-between gap-2">
              <span class="px-3 py-1 rounded-full text-xs font-semibold bg-white shadow-2xs border border-slate-200 text-slate-700">
                ${categoryObj.icon} ${catDisplayName}
              </span>
              <span class="text-xs text-indigo-600 font-semibold">Tap card to see meaning & pronunciation 👆</span>
            </div>
            
            <div class="my-auto py-6">
              <h2 class="text-4xl md:text-6xl font-black text-slate-800 tracking-wide">${item.word}</h2>
              ${item.romanization ? `<p class="text-amber-700 mt-3 font-mono font-bold text-sm md:text-base bg-amber-50 inline-block px-3 py-1 rounded-xl border border-amber-200">🗣️ ${item.romanization}</p>` : ''}
            </div>

            <div class="flex items-center justify-center gap-3">
              <button class="fc-speak-btn flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-md shadow-indigo-300 transition-all active:scale-95" data-word="${item.word.replace(/"/g, '&quot;')}">
                <span>🔊 Listen</span>
              </button>
              <button class="fc-speak-slow-btn px-4 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition-all active:scale-95" data-word="${item.word.replace(/"/g, '&quot;')}">
                🐢 0.6x
              </button>
            </div>
          </div>
        `;
      }

      // Back: Complete Answer (Thai Word + English + Romanization + Thai Phonetics + Meaning + Example)
      back.innerHTML = `
        <div class="h-full flex flex-col justify-between p-6 md:p-8 text-center bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-3xl shadow-xl">
          <div class="flex items-center justify-between">
            <span class="px-3 py-1 rounded-full text-xs font-bold bg-white/20 backdrop-blur-md">
              ${englishPos}
            </span>
            <span class="text-xs text-amber-100 font-medium">Tap to flip back ↩️</span>
          </div>

          <div class="my-auto py-2 space-y-3">
            <div>
              <h3 class="text-2xl md:text-4xl font-black">${item.word}</h3>
              ${item.english ? `<div class="text-lg md:text-2xl font-extrabold text-amber-100 mt-0.5">🇬🇧 ${item.english}</div>` : ''}
            </div>

            <div class="inline-flex flex-wrap items-center justify-center gap-2 bg-white/15 backdrop-blur-md py-2 px-4 rounded-2xl border border-white/20 text-sm md:text-base font-bold">
              <span>Phonetics: [${item.pronunciation}]</span>
              ${item.romanization ? `<span class="text-amber-200 font-mono">• (${item.romanization})</span>` : ''}
            </div>

            <div class="max-w-lg mx-auto">
              <p class="text-sm md:text-base text-white font-medium leading-relaxed">${item.meaning}</p>
            </div>

            ${item.exampleSentence ? `
              <div class="max-w-lg mx-auto p-2.5 bg-black/15 rounded-xl text-xs md:text-sm text-amber-50 italic flex items-center justify-center gap-2">
                <span>"${item.exampleSentence}"</span>
                <button class="fc-speak-btn px-2 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs not-italic font-bold" data-word="${item.exampleSentence.replace(/"/g, '&quot;')}">
                  🔊 Sentence
                </button>
              </div>
            ` : ''}
          </div>

          <div class="flex items-center justify-center gap-3">
            <button class="fc-speak-btn flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white text-orange-600 font-bold text-sm shadow-lg transition-all active:scale-95" data-word="${item.word.replace(/"/g, '&quot;')}">
              🔊 Speak Word
            </button>
            <button class="fc-speak-slow-btn px-4 py-2.5 rounded-2xl bg-black/20 hover:bg-black/30 text-white font-bold text-sm transition-all active:scale-95" data-word="${item.word.replace(/"/g, '&quot;')}">
              🐢 Slow 0.6x
            </button>
          </div>
        </div>
      `;

      cardEl.querySelectorAll('.fc-speak-btn').forEach(b => {
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          this.speak(b.dataset.word, 1.0);
        });
      });
      cardEl.querySelectorAll('.fc-speak-slow-btn').forEach(b => {
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          this.speak(b.dataset.word, 0.6);
        });
      });

      if (this.fcAutoSpeak) {
        this.speak(item.word, 1.0);
      }
    }
  }

  nextFlashcard() {
    if (this.flashcardList.length === 0) return;
    if (this.flashcardIndex < this.flashcardList.length - 1) {
      this.flashcardIndex++;
    } else {
      this.flashcardIndex = 0;
    }
    this.playBeep('flip');
    this.renderCurrentFlashcard();
  }

  prevFlashcard() {
    if (this.flashcardList.length === 0) return;
    if (this.flashcardIndex > 0) {
      this.flashcardIndex--;
    } else {
      this.flashcardIndex = this.flashcardList.length - 1;
    }
    this.playBeep('flip');
    this.renderCurrentFlashcard();
  }

  toggleFlipCard() {
    const cardEl = document.getElementById('flashcardElement');
    if (cardEl) {
      this.isFlipped = !this.isFlipped;
      cardEl.classList.toggle('is-flipped', this.isFlipped);
      this.playBeep('flip');
    }
  }

  // --- Quiz Mode (Interactive Mini Game for Beginners) ---
  setupQuiz() {
    const catEl = document.getElementById('quizCategorySelect');
    const poolEl = document.getElementById('quizPoolSelect');
    const typeEl = document.getElementById('quizTypeSelect');

    if (catEl) this.quizCategory = catEl.value || 'all';
    if (poolEl) this.quizPool = poolEl.value || 'all';
    if (typeEl) this.quizType = typeEl.value || 'mixed';

    this.quizQuestions = this.generateQuizQuestions(10);
    this.quizCurrentIndex = 0;
    this.quizScore = 0;
    this.quizAnswered = false;
    this.renderQuizQuestion();
  }

  generateQuizQuestions(total = 10) {
    let candidatePool = this.getFilteredWords(this.quizCategory, this.quizPool);
    if (candidatePool.length < 4) {
      candidatePool = this.getFilteredWords(this.quizCategory, 'all');
      if (candidatePool.length < 4) {
        candidatePool = this.words;
      }
    }

    const shuffled = [...candidatePool].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, Math.min(total, shuffled.length));

    return selected.map(targetWord => {
      const otherWords = this.words.filter(w => w.id !== targetWord.id);
      const wrongShuffled = otherWords.sort(() => 0.5 - Math.random()).slice(0, 3);

      let mode = this.quizType;
      if (mode === 'mixed') {
        const modes = ['th-to-en', 'en-to-th', 'pronunciation', 'meaning-th'];
        mode = modes[Math.floor(Math.random() * modes.length)];
      }

      let promptText = '';
      let displayTarget = targetWord.word;
      let subHint = '';
      let getOptionText = (w) => w.english || w.meaning;

      if (mode === 'th-to-en') {
        promptText = `What does "${targetWord.word}" mean in English?`;
        displayTarget = targetWord.word;
        subHint = targetWord.romanization ? `🗣️ ${targetWord.romanization} • [${targetWord.pronunciation}]` : `[${targetWord.pronunciation}]`;
        getOptionText = (w) => `${w.english} (${w.meaning.slice(0, 38)}${w.meaning.length > 38 ? '...' : ''})`;
      } else if (mode === 'en-to-th') {
        promptText = `Which Thai word means "${targetWord.english}"?`;
        displayTarget = `🇬🇧 ${targetWord.english}`;
        subHint = targetWord.meaning;
        getOptionText = (w) => `${w.word} (${w.romanization || w.pronunciation})`;
      } else if (mode === 'pronunciation') {
        promptText = `How is "${targetWord.word}" (${targetWord.english}) pronounced?`;
        displayTarget = targetWord.word;
        subHint = `🇬🇧 ${targetWord.english}`;
        getOptionText = (w) => `${w.romanization ? `${w.romanization} (${w.pronunciation})` : w.pronunciation}`;
      } else {
        promptText = `Which definition matches "${targetWord.word}"?`;
        displayTarget = targetWord.word;
        subHint = `🇬🇧 ${targetWord.english || ''} • (${targetWord.romanization || targetWord.pronunciation})`;
        getOptionText = (w) => `${w.english ? `${w.english} — ` : ''}${w.meaning}`;
      }

      const choices = [
        {
          text: getOptionText(targetWord),
          isCorrect: true
        },
        ...wrongShuffled.map(w => ({
          text: getOptionText(w),
          isCorrect: false
        }))
      ].sort(() => 0.5 - Math.random());

      return {
        targetObj: targetWord,
        word: targetWord.word,
        displayTarget,
        subHint,
        questionPrompt: promptText,
        choices
      };
    });
  }

  renderQuizQuestion() {
    const container = document.getElementById('quizContainer');
    const summary = document.getElementById('quizSummary');
    const feedbackBox = document.getElementById('quizAnswerFeedbackBox');
    if (!container) return;

    if (this.quizCurrentIndex >= this.quizQuestions.length) {
      container.classList.add('hidden');
      if (summary) {
        summary.classList.remove('hidden');
        document.getElementById('finalScoreText').textContent = `${this.quizScore} / ${this.quizQuestions.length}`;
        const feedback = document.getElementById('finalScoreFeedback');
        const ratio = this.quizScore / this.quizQuestions.length;
        if (ratio === 1) {
          feedback.textContent = 'Perfect Score! You answered every question correctly! 🎉';
        } else if (ratio >= 0.7) {
          feedback.textContent = 'Great Job! You have a strong grasp of these Thai words! 👍';
        } else {
          feedback.textContent = 'Keep Practicing! Review the flashcards and try again! ✌️';
        }

        // Save stats to active profile
        const profile = this.getActiveProfile();
        if (profile) {
          profile.quizStats = profile.quizStats || { quizzesPlayed: 0, bestScore: 0, lastScore: 0 };
          profile.quizStats.quizzesPlayed = (profile.quizStats.quizzesPlayed || 0) + 1;
          profile.quizStats.lastScore = this.quizScore;
          if (this.quizScore > (profile.quizStats.bestScore || 0)) {
            profile.quizStats.bestScore = this.quizScore;
          }
          this.saveProfilesToStorage();
        }
      }
      return;
    }

    container.classList.remove('hidden');
    if (summary) summary.classList.add('hidden');
    if (feedbackBox) feedbackBox.classList.add('hidden');

    const q = this.quizQuestions[this.quizCurrentIndex];
    this.quizAnswered = false;

    document.getElementById('quizProgressText').textContent = `Question ${this.quizCurrentIndex + 1} of ${this.quizQuestions.length}`;
    document.getElementById('quizProgressBar').style.width = `${((this.quizCurrentIndex + 1) / this.quizQuestions.length) * 100}%`;
    document.getElementById('quizScoreBadge').textContent = `Score: ${this.quizScore}`;

    document.getElementById('quizTargetWord').textContent = q.displayTarget;
    document.getElementById('quizQuestionPrompt').textContent = q.questionPrompt;
    const subHintEl = document.getElementById('quizSubHint');
    if (subHintEl) subHintEl.textContent = q.subHint || '';

    const speakBtn = document.getElementById('quizSpeakWordBtn');
    if (speakBtn) {
      speakBtn.onclick = () => this.speak(q.word, 1.0);
    }

    const choicesContainer = document.getElementById('quizChoices');
    choicesContainer.innerHTML = q.choices.map((choice, idx) => `
      <button 
        class="quiz-choice-btn w-full p-4 rounded-2xl border-2 border-slate-200 bg-white hover:border-indigo-400 hover:bg-indigo-50/40 text-left font-medium text-slate-700 transition-all text-sm md:text-base flex items-center gap-3 active:scale-[0.99]"
        data-index="${idx}"
      >
        <span class="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-xs flex-shrink-0">
          ${String.fromCharCode(65 + idx)}
        </span>
        <span class="flex-grow">${choice.text}</span>
      </button>
    `).join('');

    choicesContainer.querySelectorAll('.quiz-choice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.quizAnswered) return;
        const index = parseInt(btn.dataset.index);
        this.handleQuizAnswer(index);
      });
    });

    const nextBtn = document.getElementById('quizNextBtn');
    if (nextBtn) nextBtn.classList.add('hidden');
  }

  handleQuizAnswer(selectedIndex) {
    this.quizAnswered = true;
    const q = this.quizQuestions[this.quizCurrentIndex];
    const selected = q.choices[selectedIndex];
    const buttons = document.querySelectorAll('.quiz-choice-btn');

    if (selected.isCorrect) {
      this.quizScore++;
      this.playBeep('correct');
      buttons[selectedIndex].classList.remove('border-slate-200', 'bg-white');
      buttons[selectedIndex].classList.add('border-emerald-500', 'bg-emerald-50', 'text-emerald-900', 'ring-2', 'ring-emerald-400');
    } else {
      this.playBeep('wrong');
      buttons[selectedIndex].classList.remove('border-slate-200', 'bg-white');
      buttons[selectedIndex].classList.add('border-rose-500', 'bg-rose-50', 'text-rose-900');

      q.choices.forEach((c, idx) => {
        if (c.isCorrect) {
          buttons[idx].classList.remove('border-slate-200', 'bg-white');
          buttons[idx].classList.add('border-emerald-500', 'bg-emerald-50', 'text-emerald-900');
        }
      });
    }

    // Show detailed answer feedback & Mark as Learned button
    const feedbackBox = document.getElementById('quizAnswerFeedbackBox');
    const detailEl = document.getElementById('quizAnswerDetail');
    const markLearnedBtn = document.getElementById('quizMarkLearnedBtn');
    if (feedbackBox && detailEl && q.targetObj) {
      const w = q.targetObj;
      feedbackBox.classList.remove('hidden');
      detailEl.innerHTML = `
        <div class="font-bold text-slate-800">${w.word} • <span class="text-indigo-600">${w.english || ''}</span></div>
        <div class="text-xs text-slate-500">Phonetics: [${w.pronunciation}] ${w.romanization ? `• (${w.romanization})` : ''} — ${w.meaning}</div>
      `;
      const updateQuizLearnedBtn = () => {
        const isL = this.learned.has(w.id);
        markLearnedBtn.className = isL
          ? 'px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white border border-emerald-600 transition-all whitespace-nowrap flex-shrink-0'
          : 'px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-emerald-700 border border-emerald-500 hover:bg-emerald-50 transition-all whitespace-nowrap flex-shrink-0';
        markLearnedBtn.textContent = '✓ Learned';
      };
      updateQuizLearnedBtn();
      markLearnedBtn.onclick = () => {
        this.toggleLearned(w.id);
        updateQuizLearnedBtn();
      };
    }

    const nextBtn = document.getElementById('quizNextBtn');
    if (nextBtn) {
      nextBtn.classList.remove('hidden');
      nextBtn.onclick = () => {
        this.quizCurrentIndex++;
        this.renderQuizQuestion();
      };
    }
  }

  // --- Tab Navigation ---
  switchTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => {
      const active = btn.dataset.tab === tab;
      btn.classList.toggle('text-indigo-600', active);
      btn.classList.toggle('border-indigo-600', active);
      btn.classList.toggle('font-bold', active);
      btn.classList.toggle('text-slate-500', !active);
      btn.classList.toggle('border-transparent', !active);
    });

    const listSection = document.getElementById('listSection');
    const flashcardSection = document.getElementById('flashcardSection');
    const quizSection = document.getElementById('quizSection');

    if (tab === 'list' || tab === 'unlearned' || tab === 'learned' || tab === 'favorites') {
      listSection.classList.remove('hidden');
      flashcardSection.classList.add('hidden');
      quizSection.classList.add('hidden');

      if (tab === 'list') this.statusFilter = 'all';
      else if (tab === 'unlearned') this.statusFilter = 'unlearned';
      else if (tab === 'learned') this.statusFilter = 'learned';
      else if (tab === 'favorites') this.statusFilter = 'favorites';

      this.displayLimit = 100;
      this.updateProfileUI();
      this.renderWordList();
    } else if (tab === 'flashcard') {
      listSection.classList.add('hidden');
      flashcardSection.classList.remove('hidden');
      quizSection.classList.add('hidden');
      this.setupFlashcards(false);
    } else if (tab === 'quiz') {
      listSection.classList.add('hidden');
      flashcardSection.classList.add('hidden');
      quizSection.classList.remove('hidden');
      this.setupQuiz();
    }
  }

  // --- Setup Global Event Listeners ---
  setupEventListeners() {
    // Tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });

    // Status Filter Pills inside Explorer
    document.querySelectorAll('.status-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.statusFilter = btn.dataset.status;
        this.displayLimit = 100;
        // Sync top tab highlight if matching
        const tabMap = { all: 'list', unlearned: 'unlearned', learned: 'learned', favorites: 'favorites' };
        const mappedTab = tabMap[this.statusFilter] || 'list';
        this.currentTab = mappedTab;
        document.querySelectorAll('.tab-btn').forEach(tb => {
          const active = tb.dataset.tab === mappedTab;
          tb.classList.toggle('text-indigo-600', active);
          tb.classList.toggle('border-indigo-600', active);
          tb.classList.toggle('font-bold', active);
          tb.classList.toggle('text-slate-500', !active);
          tb.classList.toggle('border-transparent', !active);
        });
        this.updateProfileUI();
        this.renderWordList();
      });
    });

    // Category Pull-Down Select Menu
    const categorySelect = document.getElementById('categorySelect');
    if (categorySelect) {
      categorySelect.addEventListener('change', (e) => {
        this.currentCategory = e.target.value;
        this.displayLimit = 100;
        this.updateProfileUI();
        this.renderCategories();
        this.renderWordList();
        const activeBtn = document.querySelector(`.category-btn[data-category="${this.currentCategory}"]`);
        if (activeBtn) {
          activeBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
      });
    }

    // Category Scroll Buttons & Mouse Wheel
    const scrollCatLeft = document.getElementById('scrollCatLeft');
    const scrollCatRight = document.getElementById('scrollCatRight');
    const categoriesContainer = document.getElementById('categoriesContainer');

    if (scrollCatLeft && categoriesContainer) {
      scrollCatLeft.addEventListener('click', () => {
        categoriesContainer.scrollBy({ left: -280, behavior: 'smooth' });
      });
    }
    if (scrollCatRight && categoriesContainer) {
      scrollCatRight.addEventListener('click', () => {
        categoriesContainer.scrollBy({ left: 280, behavior: 'smooth' });
      });
    }
    if (categoriesContainer) {
      categoriesContainer.addEventListener('wheel', (e) => {
        if (e.deltaY !== 0) {
          e.preventDefault();
          categoriesContainer.scrollLeft += e.deltaY;
        }
      }, { passive: false });
    }

    // Load More / Show All Buttons
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    const loadAllBtn = document.getElementById('loadAllBtn');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => {
        this.displayLimit += 100;
        this.renderWordList();
      });
    }
    if (loadAllBtn) {
      loadAllBtn.addEventListener('click', () => {
        this.displayLimit = 99999;
        this.renderWordList();
      });
    }

    // Reset Filters Button
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');
    if (resetFiltersBtn) {
      resetFiltersBtn.addEventListener('click', () => {
        this.currentCategory = 'all';
        this.statusFilter = 'all';
        this.searchQuery = '';
        this.displayLimit = 100;
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.value = '';
        this.switchTab('list');
        this.renderCategories();
      });
    }

    // Practice Current Filtered Set in Flashcards
    const practiceCurrentSetBtn = document.getElementById('practiceCurrentSetBtn');
    if (practiceCurrentSetBtn) {
      practiceCurrentSetBtn.addEventListener('click', () => {
        this.fcCategory = this.currentCategory;
        this.fcStatus = this.statusFilter;
        const fcCatEl = document.getElementById('fcCategorySelect');
        const fcStatEl = document.getElementById('fcStatusSelect');
        if (fcCatEl) fcCatEl.value = this.fcCategory;
        if (fcStatEl) fcStatEl.value = this.fcStatus;
        this.switchTab('flashcard');
      });
    }

    // Search input
    const searchInput = document.getElementById('searchInput');
    const clearSearch = document.getElementById('clearSearch');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.displayLimit = 100;
        if (clearSearch) {
          clearSearch.classList.toggle('hidden', !this.searchQuery);
        }
        this.renderWordList();
      });
    }

    if (clearSearch) {
      clearSearch.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        this.searchQuery = '';
        clearSearch.classList.add('hidden');
        this.renderWordList();
      });
    }

    // Flashcard controls
    const flashcardEl = document.getElementById('flashcardElement');
    if (flashcardEl) {
      flashcardEl.addEventListener('click', () => this.toggleFlipCard());
    }
    const nextFcBtn = document.getElementById('nextFcBtn');
    const prevFcBtn = document.getElementById('prevFcBtn');
    const fcToggleLearnedBtn = document.getElementById('fcToggleLearnedBtn');
    const fcCategorySelect = document.getElementById('fcCategorySelect');
    const fcStatusSelect = document.getElementById('fcStatusSelect');
    const fcDirectionSelect = document.getElementById('fcDirectionSelect');
    const fcAutoSpeakCheck = document.getElementById('fcAutoSpeakCheck');
    const fcShuffleBtn = document.getElementById('fcShuffleBtn');

    if (nextFcBtn) nextFcBtn.addEventListener('click', () => this.nextFlashcard());
    if (prevFcBtn) prevFcBtn.addEventListener('click', () => this.prevFlashcard());
    if (fcToggleLearnedBtn) {
      fcToggleLearnedBtn.addEventListener('click', () => {
        if (this.flashcardList.length === 0) return;
        const currentItem = this.flashcardList[this.flashcardIndex];
        this.toggleLearned(currentItem.id);
      });
    }
    if (fcCategorySelect) fcCategorySelect.addEventListener('change', () => this.setupFlashcards(false));
    if (fcStatusSelect) fcStatusSelect.addEventListener('change', () => this.setupFlashcards(false));
    if (fcDirectionSelect) {
      fcDirectionSelect.addEventListener('change', (e) => {
        this.fcDirection = e.target.value;
        this.renderCurrentFlashcard();
      });
    }
    if (fcAutoSpeakCheck) {
      fcAutoSpeakCheck.addEventListener('change', (e) => {
        this.fcAutoSpeak = e.target.checked;
      });
    }
    if (fcShuffleBtn) {
      fcShuffleBtn.addEventListener('click', () => this.shuffleFlashcards());
    }

    // Quiz controls
    const restartQuizBtn = document.getElementById('restartQuizBtn');
    const newQuizRoundBtn = document.getElementById('newQuizRoundBtn');
    const quizCategorySelect = document.getElementById('quizCategorySelect');
    const quizPoolSelect = document.getElementById('quizPoolSelect');
    const quizTypeSelect = document.getElementById('quizTypeSelect');

    if (restartQuizBtn) restartQuizBtn.addEventListener('click', () => this.setupQuiz());
    if (newQuizRoundBtn) newQuizRoundBtn.addEventListener('click', () => this.setupQuiz());
    if (quizCategorySelect) quizCategorySelect.addEventListener('change', () => this.setupQuiz());
    if (quizPoolSelect) quizPoolSelect.addEventListener('change', () => this.setupQuiz());
    if (quizTypeSelect) quizTypeSelect.addEventListener('change', () => this.setupQuiz());

    // Speed & Voice Engine toggles (saved per profile)
    const speedSelect = document.getElementById('speechSpeedSelect');
    if (speedSelect) {
      speedSelect.addEventListener('change', (e) => {
        this.speechSpeed = parseFloat(e.target.value) || 1.0;
        this.saveProfilesToStorage();
      });
    }

    const voiceEngineSelect = document.getElementById('voiceEngineSelect');
    if (voiceEngineSelect) {
      voiceEngineSelect.addEventListener('change', (e) => {
        this.voiceEngine = e.target.value;
        this.saveProfilesToStorage();
      });
    }

    // Fullscreen toggle
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          if (document.exitFullscreen) document.exitFullscreen();
        }
      });
    }

    // Profile Modal Events
    const profileBtn = document.getElementById('profileBtn');
    const openProfileFromBannerBtn = document.getElementById('openProfileFromBannerBtn');
    const profileModal = document.getElementById('profileModal');
    const closeProfileModalBtn = document.getElementById('closeProfileModalBtn');
    const createProfileForm = document.getElementById('createProfileForm');
    const exportFileBtn = document.getElementById('exportFileBtn');
    const copyBackupCodeBtn = document.getElementById('copyBackupCodeBtn');
    const importFileInput = document.getElementById('importFileInput');
    const importCodeBtn = document.getElementById('importCodeBtn');

    const openProfileModal = () => {
      if (!profileModal) return;
      this.renderProfileModalList();
      profileModal.classList.remove('hidden');
    };

    if (profileBtn) profileBtn.addEventListener('click', openProfileModal);
    if (openProfileFromBannerBtn) openProfileFromBannerBtn.addEventListener('click', openProfileModal);
    if (closeProfileModalBtn && profileModal) {
      closeProfileModalBtn.addEventListener('click', () => profileModal.classList.add('hidden'));
    }
    if (profileModal) {
      profileModal.addEventListener('click', (e) => {
        if (e.target === profileModal) profileModal.classList.add('hidden');
      });
    }

    if (createProfileForm) {
      createProfileForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('newProfileNameInput');
        const avatarSelect = document.getElementById('newProfileAvatarSelect');
        if (!nameInput || !nameInput.value.trim()) return;
        this.createProfile(nameInput.value.trim(), avatarSelect ? avatarSelect.value : '🪷');
        nameInput.value = '';
      });
    }

    if (exportFileBtn) {
      exportFileBtn.addEventListener('click', () => this.exportBackupFile());
    }
    if (copyBackupCodeBtn) {
      copyBackupCodeBtn.addEventListener('click', () => this.copyBackupCode());
    }
    if (importFileInput) {
      importFileInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          if (evt.target && evt.target.result) {
            this.importBackupData(evt.target.result);
          }
        };
        reader.readAsText(file, 'UTF-8');
        importFileInput.value = '';
      });
    }
    if (importCodeBtn) {
      importCodeBtn.addEventListener('click', () => {
        const codeInput = document.getElementById('importCodeInput');
        if (!codeInput || !codeInput.value.trim()) {
          alert('Please paste your JSON backup code into the input field first.');
          return;
        }
        this.importBackupData(codeInput.value);
      });
    }

    // Add Word Modal
    const addWordBtn = document.getElementById('addWordBtn');
    const addWordModal = document.getElementById('addWordModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const addWordForm = document.getElementById('addWordForm');

    if (addWordBtn && addWordModal) {
      addWordBtn.addEventListener('click', () => {
        addWordModal.classList.remove('hidden');
      });
    }
    if (closeModalBtn && addWordModal) {
      closeModalBtn.addEventListener('click', () => {
        addWordModal.classList.add('hidden');
      });
    }
    if (addWordModal) {
      addWordModal.addEventListener('click', (e) => {
        if (e.target === addWordModal) addWordModal.classList.add('hidden');
      });
    }

    if (addWordForm) {
      addWordForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const word = document.getElementById('newWord').value.trim();
        const english = document.getElementById('newEnglish') ? document.getElementById('newEnglish').value.trim() : '';
        const pronunciation = document.getElementById('newPronunciation').value.trim();
        const romanization = document.getElementById('newRomanization') ? document.getElementById('newRomanization').value.trim() : '';
        const category = document.getElementById('newCategory').value;
        const partOfSpeech = document.getElementById('newPartOfSpeech').value.trim();
        const meaning = document.getElementById('newMeaning').value.trim();
        const example = document.getElementById('newExample').value.trim();

        if (!word || !pronunciation || !meaning) {
          alert('Please fill in the Thai Word, Thai Phonetics, and Meaning fields.');
          return;
        }

        const newWordObj = {
          id: 'custom_' + Date.now(),
          word: word,
          english: english,
          pronunciation: pronunciation,
          romanization: romanization,
          category: category,
          partOfSpeech: partOfSpeech || 'Noun',
          meaning: meaning,
          exampleSentence: example
        };

        this.addCustomWord(newWordObj);
        addWordForm.reset();
        addWordModal.classList.add('hidden');
        this.showToast(`Added "${word}" to your vocabulary!`, '✨');
      });
    }
  }
}

// Start app on DOM load
document.addEventListener('DOMContentLoaded', () => {
  window.app = new VocabApp();
});
