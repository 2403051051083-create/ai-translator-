document.addEventListener('DOMContentLoaded', () => {
  const themeToggle = document.getElementById('themeToggle');

  // Load and apply saved theme preference
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'light') {
    document.body.classList.add('light');
    if (themeToggle) themeToggle.textContent = '☀️';
  } else {
    document.body.classList.remove('light');
    if (themeToggle) themeToggle.textContent = '🌙';
  }

  // Element Selectors
  const sourceText = document.getElementById('sourceText');
  const translatedText = document.getElementById('translatedText');
  const sourceLang = document.getElementById('sourceLang');
  const targetLang = document.getElementById('targetLang');
  const translateButton = document.getElementById('translateButton');
  const clearButton = document.getElementById('clearButton');
  const copyButton = document.getElementById('copyButton');
  const speakButton = document.getElementById('speakButton');
  const voiceButton = document.getElementById('voiceButton');
  const swapButton = document.getElementById('swapButton');
  const charCount = document.getElementById('charCount');
  const loading = document.getElementById('loading');

  // Extra Elements (Voice Customization & History Controls)
  const voiceSelect = document.getElementById('voiceSelect');
  const autoSpeak = document.getElementById('autoSpeak');
  const voiceRate = document.getElementById('voiceRate');
  const voicePitch = document.getElementById('voicePitch');
  const rateVal = document.getElementById('rateVal');
  const pitchVal = document.getElementById('pitchVal');
  
  const historyList = document.getElementById('historyList');
  const historySearch = document.getElementById('historySearch');
  const tabAll = document.getElementById('tabAll');
  const tabStarred = document.getElementById('tabStarred');
  const clearHistoryButton = document.getElementById('clearHistoryButton');
  const toastContainer = document.getElementById('toastContainer');

  let historyData = [];
  let voices = [];

  // Character Counter
  const updateCounter = () => {
    if (charCount && sourceText) {
      const value = sourceText.value.length;
      charCount.textContent = `${value} / 1000`;
    }
  };

  if (sourceText) {
    sourceText.addEventListener('input', updateCounter);
    updateCounter();
  }

  // Theme Toggle
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('light');
      const isLight = document.body.classList.contains('light');
      themeToggle.textContent = isLight ? '☀️' : '🌙';
      localStorage.setItem('theme', isLight ? 'light' : 'dark');
    });
  }

  // Loading indicator helper
  const showLoading = (show) => {
    if (loading) loading.classList.toggle('hidden', !show);
  };

  // Toast Notification Helper
  const showToast = (message, duration = 3000) => {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      toast.addEventListener('transitionend', () => toast.remove());
    }, duration - 300);
  };

  // Speech synthesis language mapping for Indian and international languages
  const langMap = {
    'auto': 'en-US',
    'en': 'en-US', 'es': 'es-ES', 'fr': 'fr-FR', 'de': 'de-DE',
    'it': 'it-IT', 'pt': 'pt-BR', 'ar': 'ar-SA', 'ja': 'ja-JP', 'ko': 'ko-KR', 'zh': 'zh-CN',
    'hi': 'hi-IN', 'as': 'as-IN', 'bn': 'bn-IN', 'brx': 'brx-IN', 'doi': 'doi-IN', 'gu': 'gu-IN',
    'kn': 'kn-IN', 'ks': 'ks-IN', 'gom': 'kok-IN', 'mai': 'mai-IN', 'ml': 'ml-IN',
    'mni': 'mni-IN', 'mr': 'mr-IN', 'ne': 'ne-NP', 'or': 'or-IN', 'pa': 'pa-IN',
    'sa': 'sa-IN', 'sat': 'sat-IN', 'sd': 'sd-IN', 'ta': 'ta-IN', 'te': 'te-IN',
    'ur': 'ur-PK', 'bho': 'hi-IN'
  };

  const getSpeechLanguageCode = (langCode) => {
    const normalized = String(langCode || 'auto').trim().toLowerCase();
    if (!normalized || normalized === 'auto') return 'en-US';
    return langMap[normalized] || langMap[normalized.split('-')[0]] || `${normalized.split('-')[0]}-${normalized.split('-')[0].toUpperCase()}`;
  };

  const isVoiceCompatible = (voice, langCode) => {
    if (!voice) return false;
    const normalized = String(langCode || 'auto').trim().toLowerCase();
    const baseCode = normalized.split('-')[0];
    const voiceLang = (voice.lang || '').toLowerCase();

    return voiceLang === normalized ||
      voiceLang.startsWith(`${normalized}-`) ||
      voiceLang.startsWith(`${baseCode}-`) ||
      voiceLang.includes(baseCode);
  };

  const getVoiceForLanguage = (langCode) => {
    if (!voices.length) return null;

    const normalized = String(langCode || 'auto').trim().toLowerCase();
    const baseCode = normalized.split('-')[0];
    const candidates = [normalized, baseCode];

    if (normalized === 'bho') candidates.push('hi');
    if (normalized === 'gom') candidates.push('kok');
    if (normalized === 'ur') candidates.push('ur-pk');
    if (normalized === 'sa') candidates.push('hi');
    if (normalized === 'ks') candidates.push('ur');

    const matchingVoices = voices.filter((voice) => {
      const voiceLang = (voice.lang || '').toLowerCase();
      return candidates.some((candidate) => {
        const normalizedCandidate = candidate.toLowerCase();
        return voiceLang === normalizedCandidate ||
          voiceLang.startsWith(`${normalizedCandidate}-`) ||
          voiceLang.includes(normalizedCandidate);
      });
    });

    if (matchingVoices.length) return matchingVoices[0];

    const familyVoices = voices.filter((voice) => {
      const voiceLang = (voice.lang || '').toLowerCase();
      return voiceLang.startsWith(`${baseCode}-`) || voiceLang.includes(baseCode);
    });

    return familyVoices[0] || voices[0] || null;
  };

  // Populate Voices list for Speech Synthesis
  const populateVoiceList = () => {
    if (typeof speechSynthesis === 'undefined') return;
    voices = speechSynthesis.getVoices();
    if (!voiceSelect) return;
    
    // Save current selection to restore it
    const currentSelection = voiceSelect.value;
    voiceSelect.innerHTML = '<option value="default">Default System Voice</option>';
    
    voices.forEach((voice, index) => {
      const option = document.createElement('option');
      option.textContent = `${voice.name} (${voice.lang})`;
      option.value = index;
      voiceSelect.appendChild(option);
    });

    if (currentSelection && voiceSelect.querySelector(`option[value="${currentSelection}"]`)) {
      voiceSelect.value = currentSelection;
    }
  };

  populateVoiceList();
  if (typeof speechSynthesis !== 'undefined' && speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = populateVoiceList;
  }

  // Voice Speed (Rate) and Pitch slider controls
  if (voiceRate && rateVal) {
    voiceRate.addEventListener('input', () => {
      rateVal.textContent = `${parseFloat(voiceRate.value).toFixed(1)}x`;
    });
  }
  if (voicePitch && pitchVal) {
    voicePitch.addEventListener('input', () => {
      pitchVal.textContent = `${parseFloat(voicePitch.value).toFixed(1)}x`;
    });
  }

  // Audio TTS speak function
  let activeUtterance = null; // Global reference to prevent garbage collection in Chrome

  const speakText = (text, langOverride = null) => {
    if (!text || typeof speechSynthesis === 'undefined') return;

    const target = langOverride || (targetLang ? targetLang.value : 'en');
    const preferredLang = getSpeechLanguageCode(target);

    const speakWithOptions = (langCode, voiceOverride = null, attempt = 0) => {
      if (speechSynthesis.paused) {
        speechSynthesis.resume();
      }

      speechSynthesis.cancel();

      setTimeout(() => {
        activeUtterance = new SpeechSynthesisUtterance(text);
        activeUtterance.lang = langCode;

        if (voiceOverride) {
          activeUtterance.voice = voiceOverride;
        }

        if (voiceRate) activeUtterance.rate = parseFloat(voiceRate.value);
        if (voicePitch) activeUtterance.pitch = parseFloat(voicePitch.value);

        activeUtterance.onend = () => {
          activeUtterance = null;
        };

        activeUtterance.onerror = (e) => {
          console.warn('Speech synthesis error:', e.error);
          activeUtterance = null;

          if (attempt === 0 && langCode !== 'en-US') {
            speakWithOptions('en-US', null, 1);
          }
        };

        speechSynthesis.speak(activeUtterance);

        if (speechSynthesis.paused) {
          speechSynthesis.resume();
        }
      }, 100);
    };

    const selectedVoiceValue = voiceSelect?.value;
    const chosenVoice = selectedVoiceValue && selectedVoiceValue !== 'default'
      ? voices[parseInt(selectedVoiceValue)]
      : null;
    const compatibleVoice = chosenVoice && isVoiceCompatible(chosenVoice, target)
      ? chosenVoice
      : getVoiceForLanguage(target);

    speakWithOptions(preferredLang, compatibleVoice || null, 0);
  };

  // Translate call
  const translate = async () => {
    if (!sourceText || !translatedText) return;
    const text = sourceText.value.trim();
    if (!text) return;

    showLoading(true);
    const formData = new FormData();
    formData.append('source_text', text);
    formData.append('source_lang', sourceLang ? sourceLang.value : 'auto');
    formData.append('target_lang', targetLang ? targetLang.value : 'en');
    
    const toneSelect = document.getElementById('translationTone');
    formData.append('tone', toneSelect ? toneSelect.value : 'auto');
    
    formData.append('csrf_token', document.querySelector('input[name="csrf_token"]')?.value || '');

    try {
      const response = await fetch('/translate', {
        method: 'POST',
        body: formData,
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Translation failed');
      }
      translatedText.value = data.translated_text;

      // Dynamically add to the client-side history model
      const newRecord = {
        id: data.id,
        source_language: data.source_language,
        target_language: data.target_language,
        source_text: text,
        translated_text: data.translated_text,
        created_at: new Date().toISOString(),
        starred: data.starred || 0
      };
      historyData.unshift(newRecord);
      renderHistory();

      // Update Total translations counter on Stats Card
      const statTotalEl = document.querySelector('.stat-card h3');
      if (statTotalEl) {
        statTotalEl.textContent = parseInt(statTotalEl.textContent || '0') + 1;
      }

      // Auto-Speak if enabled
      if (autoSpeak && autoSpeak.checked) {
        speakText(data.translated_text);
      }
    } catch (error) {
      translatedText.value = error.message;
      showToast(`Error: ${error.message}`);
    } finally {
      showLoading(false);
    }
  };

  if (translateButton) translateButton.addEventListener('click', translate);

  if (clearButton) {
    clearButton.addEventListener('click', () => {
      sourceText.value = '';
      translatedText.value = '';
      updateCounter();
      if (typeof speechSynthesis !== 'undefined') {
        speechSynthesis.cancel();
      }
      showToast("Cleared input 🧹");
    });
  }

  if (copyButton) {
    copyButton.addEventListener('click', async () => {
      if (!translatedText.value) return;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(translatedText.value);
        } else {
          const area = document.createElement('textarea');
          area.value = translatedText.value;
          document.body.appendChild(area);
          area.select();
          document.execCommand('copy');
          area.remove();
        }
        showToast("Copied translation! 📋");
      } catch (err) {
        showToast("Failed to copy");
      }
    });
  }

  if (speakButton) {
    speakButton.addEventListener('click', () => {
      if (!translatedText.value) {
        showToast("Translate something first to speak!");
        return;
      }
      speakText(translatedText.value);
    });
  }

  // Speech Recognition (Microphone voice input)
  let recognitionInstance = null;
  let isListening = false;

  const stopListening = () => {
    if (recognitionInstance) {
      try {
        recognitionInstance.stop();
      } catch (e) {}
    }
    isListening = false;
    if (voiceButton) {
      voiceButton.classList.remove('recording');
      voiceButton.textContent = '🎤';
    }
    if (sourceText) {
      sourceText.placeholder = "Type or speak something...";
    }
  };

  if (voiceButton) {
    voiceButton.addEventListener('click', async () => {
      if (isListening) {
        stopListening();
        return;
      }

      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert('Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
        return;
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionInstance = new SpeechRecognition();

      let lang = sourceLang ? sourceLang.value : 'auto';
      if (lang === 'auto') {
        const target = targetLang ? targetLang.value : 'en';
        lang = getSpeechLanguageCode(target);
      } else {
        lang = getSpeechLanguageCode(lang);
      }

      recognitionInstance.lang = lang;
      recognitionInstance.interimResults = false;
      recognitionInstance.maxAlternatives = 1;

      recognitionInstance.onstart = () => {
        isListening = true;
        voiceButton.classList.add('recording');
        voiceButton.textContent = '🛑';
        if (sourceText) {
          sourceText.placeholder = "Listening... Speak now.";
        }
      };

      recognitionInstance.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (sourceText) {
          const currentText = sourceText.value.trim();
          sourceText.value = (currentText ? currentText + ' ' : '') + transcript;
          updateCounter();
        }
      };

      recognitionInstance.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        stopListening();
        if (event.error === 'not-allowed') {
          alert('Microphone access denied.\n\nNote: If you are accessing the website using a network IP, browsers block microphone access for security reasons. Please use http://localhost:5000 or http://127.0.0.1:5000 to enable Speech Recognition.');
        } else if (event.error === 'network') {
          showToast('Network error during speech recognition.');
        } else {
          showToast('Voice Recognition error: ' + event.error);
        }
      };

      recognitionInstance.onend = () => {
        stopListening();
      };

      try {
        recognitionInstance.start();
      } catch (err) {
        console.error('Failed to start recognition:', err);
        stopListening();
      }
    });
  }

  if (swapButton) {
    swapButton.addEventListener('click', () => {
      const temp = sourceLang.value;
      sourceLang.value = targetLang.value === 'auto' ? 'hi' : targetLang.value;
      targetLang.value = temp === 'auto' ? 'en' : temp;
      
      const tempText = sourceText.value;
      sourceText.value = translatedText.value;
      translatedText.value = tempText;
      updateCounter();
    });
  }

  // Dynamic History Management System
  const escapeHtml = (text) => {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const renderHistory = () => {
    if (!historyList) return;
    historyList.innerHTML = '';

    const query = historySearch ? historySearch.value.toLowerCase().trim() : '';
    const currentTab = document.querySelector('.history-tab.active')?.id || 'tabAll';

    let filtered = historyData;

    // Starred filter
    if (currentTab === 'tabStarred') {
      filtered = filtered.filter(item => item.starred === 1);
    }

    // Search filter
    if (query) {
      filtered = filtered.filter(item => 
        item.source_text.toLowerCase().includes(query) || 
        item.translated_text.toLowerCase().includes(query) ||
        item.source_language.toLowerCase().includes(query) ||
        item.target_language.toLowerCase().includes(query)
      );
    }

    if (filtered.length === 0) {
      historyList.innerHTML = `<li class="history-empty">${query ? 'No matching translations found.' : 'No translations yet.'}</li>`;
      return;
    }

    filtered.forEach(item => {
      const li = document.createElement('li');
      li.className = 'history-item';
      
      const isStarred = item.starred === 1;
      const starChar = isStarred ? '★' : '☆';
      const starClass = isStarred ? 'history-action-btn star-btn active' : 'history-action-btn star-btn';
      
      let timeString = item.created_at;
      if (timeString.includes('T')) {
        const parts = timeString.split('T');
        timeString = parts[1].substring(0, 5); // HH:MM
      } else {
        timeString = timeString.substring(0, 19);
      }

      li.innerHTML = `
        <div class="history-item-header">
          <div class="history-meta">
            <span class="history-badge">${item.source_language.toUpperCase()} → ${item.target_language.toUpperCase()}</span>
            <span class="history-time">${timeString}</span>
          </div>
          <div class="history-actions">
            <button class="${starClass}" data-id="${item.id}" title="${isStarred ? 'Unstar' : 'Star'}">${starChar}</button>
            <button class="history-action-btn delete-btn" data-id="${item.id}" title="Delete">🗑️</button>
          </div>
        </div>
        <p class="history-source">${escapeHtml(item.source_text)}</p>
        <p class="history-translated">${escapeHtml(item.translated_text)}</p>
      `;
      historyList.appendChild(li);
    });

    // Attach Action Listeners dynamically
    historyList.querySelectorAll('.star-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleStar(btn.getAttribute('data-id'));
      });
    });

    historyList.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteItem(btn.getAttribute('data-id'));
      });
    });
  };

  const fetchHistory = async () => {
    try {
      const response = await fetch('/history');
      if (response.ok) {
        historyData = await response.json();
        renderHistory();
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  const toggleStar = async (id) => {
    const csrfToken = document.querySelector('input[name="csrf_token"]')?.value || '';
    const formData = new FormData();
    formData.append('id', id);
    formData.append('csrf_token', csrfToken);
    try {
      const response = await fetch('/toggle_star', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      if (response.ok && data.success) {
        const item = historyData.find(x => x.id == id);
        if (item) {
          item.starred = data.starred;
          showToast(data.starred ? "Starred! ⭐" : "Unstarred! ☆");
          renderHistory();
        }
      } else {
        showToast(data.error || "Failed to update star");
      }
    } catch (err) {
      console.error('Error toggling star:', err);
    }
  };

  const deleteItem = async (id) => {
    const csrfToken = document.querySelector('input[name="csrf_token"]')?.value || '';
    const formData = new FormData();
    formData.append('id', id);
    formData.append('csrf_token', csrfToken);
    try {
      const response = await fetch('/delete_translation', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      if (response.ok && data.success) {
        historyData = historyData.filter(x => x.id != id);
        showToast("Deleted translation 🗑️");
        renderHistory();

        const statTotalEl = document.querySelector('.stat-card h3');
        if (statTotalEl && data.total_translations !== undefined) {
          statTotalEl.textContent = data.total_translations;
        }
      } else {
        showToast(data.error || "Failed to delete");
      }
    } catch (err) {
      console.error('Error deleting translation:', err);
    }
  };

  const clearHistory = async () => {
    if (!confirm("Are you sure you want to clear your entire translation history? This cannot be undone.")) return;
    const csrfToken = document.querySelector('input[name="csrf_token"]')?.value || '';
    const formData = new FormData();
    formData.append('csrf_token', csrfToken);
    try {
      const response = await fetch('/clear_history', {
        method: 'POST',
        body: formData
      });
      if (response.ok) {
        historyData = [];
        showToast("History cleared! 🧹");
        renderHistory();
        
        const statTotalEl = document.querySelector('.stat-card h3');
        if (statTotalEl) statTotalEl.textContent = '0';
      } else {
        showToast("Failed to clear history");
      }
    } catch (err) {
      console.error('Error clearing history:', err);
    }
  };

  if (historySearch) {
    historySearch.addEventListener('input', renderHistory);
  }

  if (tabAll) {
    tabAll.addEventListener('click', () => {
      tabAll.classList.add('active');
      if (tabStarred) tabStarred.classList.remove('active');
      renderHistory();
    });
  }

  if (tabStarred) {
    tabStarred.addEventListener('click', () => {
      tabStarred.classList.add('active');
      if (tabAll) tabAll.classList.remove('active');
      renderHistory();
    });
  }

  if (clearHistoryButton) {
    clearHistoryButton.addEventListener('click', clearHistory);
  }

  // Source Text Copy Button Listener
  const copySourceButton = document.getElementById('copySourceButton');
  if (copySourceButton) {
    copySourceButton.addEventListener('click', async () => {
      if (!sourceText || !sourceText.value) return;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(sourceText.value);
        } else {
          const area = document.createElement('textarea');
          area.value = sourceText.value;
          document.body.appendChild(area);
          area.select();
          document.execCommand('copy');
          area.remove();
        }
        showToast("Copied source text! 📋");
      } catch (err) {
        showToast("Failed to copy source text");
      }
    });
  }

  // Source Text Speak Button Listener
  const speakSourceButton = document.getElementById('speakSourceButton');
  if (speakSourceButton) {
    speakSourceButton.addEventListener('click', () => {
      if (!sourceText || !sourceText.value) {
        showToast("Type or speak something first!");
        return;
      }
      speakText(sourceText.value, sourceLang ? sourceLang.value : 'en');
    });
  }

  // Share on WhatsApp Listener
  const shareWhatsAppButton = document.getElementById('shareWhatsAppButton');
  if (shareWhatsAppButton) {
    shareWhatsAppButton.addEventListener('click', () => {
      if (!translatedText || !translatedText.value) {
        showToast("Translate something first to share!");
        return;
      }
      const textToShare = encodeURIComponent(translatedText.value);
      const url = `https://api.whatsapp.com/send?text=${textToShare}`;
      window.open(url, '_blank');
      showToast("Opened WhatsApp share link 📱");
    });
  }

  // Download translation as text file
  const downloadTextButton = document.getElementById('downloadTextButton');
  if (downloadTextButton) {
    downloadTextButton.addEventListener('click', () => {
      if (!translatedText || !translatedText.value) {
        showToast("Nothing to download yet!");
        return;
      }
      const element = document.createElement('a');
      const file = new Blob([translatedText.value], {type: 'text/plain;charset=utf-8'});
      element.href = URL.createObjectURL(file);
      element.download = "translation.txt";
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      showToast("Downloaded text file 💾");
    });
  }

  // Quick Phrasebook Data
  const phrasebookData = {
    greetings: [
      { english: "Hello / Greetings", hindi: "नमस्ते", bhojpuri: "प्रणाम" },
      { english: "How are you?", hindi: "आप कैसे हैं?", bhojpuri: "रउआ कइसे बानी?" },
      { english: "What is your name?", hindi: "आपका नाम क्या है?", bhojpuri: "रउआ नाम का बा?" },
      { english: "Good morning", hindi: "सुप्रभात", bhojpuri: "राम राम / गोड़ लागतानी" },
      { english: "Thank you very much", hindi: "आपका बहुत धन्यवाद", bhojpuri: "रउआ बहुत-बहुत धन्यवाद" }
    ],
    conversation: [
      { english: "What are you doing?", hindi: "आप क्या कर रहे हैं?", bhojpuri: "रउआ का करत बानी?" },
      { english: "Where is your home?", hindi: "आपका घर कहाँ है?", bhojpuri: "रउआ घर कहाँ बा?" },
      { english: "I am fine.", hindi: "मैं ठीक हूँ।", bhojpuri: "हम ठीक बानी।" },
      { english: "I don't understand.", hindi: "मुझे समझ नहीं आया।", bhojpuri: "हमरा ना बुझाइल।" },
      { english: "Nice to meet you.", hindi: "आपसे मिलकर बहुत खुशी हुई।", bhojpuri: "रउआ से मिल के बहुत नीक लागल।" }
    ],
    travel: [
      { english: "Where are you going?", hindi: "आप कहाँ जा रहे हैं?", bhojpuri: "रउआ कहाँ जात बानी?" },
      { english: "How much does this cost?", hindi: "यह कितने का है?", bhojpuri: "ई केतना के बा?" },
      { english: "I need some water.", hindi: "मुझे पानी चाहिए।", bhojpuri: "हमरा पानी चाही।" },
      { english: "Please help me.", hindi: "कृपया मेरी मदद करें।", bhojpuri: "कृपया हमार मदद करीं।" },
      { english: "Where is the market?", hindi: "बाजार कहाँ है?", bhojpuri: "बजार कहाँ बा?" }
    ]
  };

  const phrasebookGrid = document.getElementById('phrasebookGrid');
  const phrasebookTabs = document.querySelectorAll('.phrasebook-tab');

  const renderPhrasebook = (category) => {
    if (!phrasebookGrid) return;
    phrasebookGrid.innerHTML = '';

    const items = phrasebookData[category] || [];
    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'phrase-card';
      
      card.innerHTML = `
        <div class="phrase-card-title">${escapeHtml(item.english)}</div>
        <div class="phrase-pills">
          <button class="phrase-pill-btn" data-lang="en" data-text="${escapeHtml(item.english)}">English</button>
          <button class="phrase-pill-btn" data-lang="hi" data-text="${escapeHtml(item.hindi)}">Hindi</button>
          <button class="phrase-pill-btn" data-lang="bho" data-text="${escapeHtml(item.bhojpuri)}">Bhojpuri</button>
        </div>
      `;
      phrasebookGrid.appendChild(card);
    });

    // Add click listeners to phrase pills
    phrasebookGrid.querySelectorAll('.phrase-pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const lang = btn.getAttribute('data-lang');
        const text = btn.getAttribute('data-text');

        if (sourceText && sourceLang) {
          sourceText.value = text;
          sourceLang.value = lang;
          updateCounter();

          // Set default target lang if it matches source to avoid same-lang translations
          if (targetLang && targetLang.value === lang) {
            targetLang.value = lang === 'bho' ? 'hi' : 'bho';
          }
          
          // Auto-translate
          translate();
          showToast(`Loaded phrase: "${text}" 🚀`);
        }
      });
    });
  };

  // Set up Phrasebook Tabs click handlers
  if (phrasebookTabs) {
    phrasebookTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        phrasebookTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const category = tab.getAttribute('data-category');
        renderPhrasebook(category);
      });
    });
  }

  // Initial phrasebook render
  renderPhrasebook('greetings');

  fetchHistory();
});
