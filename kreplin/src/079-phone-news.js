// Top-bar News & Phone integration
(function(){
  // Provide a simple phone home that uses the existing phone UI shell
  window.openPhoneHome = async function openPhoneHome(){
    // Phone home is a neutral shell, not a secretary session
    window.S = window.S || {};
    S.isSecretarySessionActive = false;
    const overlay = createPhoneTextPopup('Phone', 'Actions');
    const msg = phoneMessagesContainer;
    const choice = document.getElementById('phone-choice-container');
    if (msg) {
      msg.innerHTML = '';
      const intro = document.createElement('div');
      intro.className = 'phone-text-message phone-text-received';
      intro.innerHTML = '<div class="phone-text-bubble">What would you like to do?</div>';
      msg.appendChild(intro);
    }
    if (choice){
      choice.style.display = 'flex';
      choice.style.flexDirection = 'column';
      choice.style.gap = '8px';
      choice.innerHTML = '';
      const btnText = document.createElement('button');
      btnText.className = 'btn-primary';
      btnText.textContent = 'Send a Text';
      btnText.onclick = async ()=>{
        await openPhoneContacts();
      };
      const btnInbox = document.createElement('button');
      btnInbox.className = 'btn-primary';
      const unreadCount = (
        (S.contacts
          ? Object.values(S.contacts).reduce((sum, c) => {
              const queued = (c.queued_texts || []).filter(t => !t.read).length;
              return sum + queued;
            }, 0)
          : 0
        ) +
        ((S.rival && Array.isArray(S.rival.inbox))
          ? S.rival.inbox.filter(m => !m.read).length
          : 0)
      );
      btnInbox.textContent = `Check Inbox${unreadCount > 0 ? ` (${unreadCount} new)` : ''}`;
      btnInbox.onclick = async ()=>{
        await openUnifiedInbox();
      };
      choice.appendChild(btnText);
      choice.appendChild(btnInbox);
    }
  };

  // Unified inbox across all contacts + Delmor's special inbox
  window.openUnifiedInbox = async function openUnifiedInbox(){
    window.S = window.S || {};
    if (!S.contacts) S.contacts = {};
    if (!S.rival || !Array.isArray(S.rival.inbox)) {
      S.rival = S.rival || {};
      S.rival.inbox = [];
    }

    // Unified inbox is not a secretary session
    window.S = window.S || {};
    S.isSecretarySessionActive = false;
    const overlay = createPhoneTextPopup('Inbox', 'Messages');
    const msg = phoneMessagesContainer;
    const choice = document.getElementById('phone-choice-container');

    // Clear message list – unified inbox is button-based
    if (msg) {
      msg.innerHTML = '';
      const intro = document.createElement('div');
      intro.className = 'phone-text-message phone-text-received';
      intro.innerHTML = '<div class="phone-text-bubble">Who do you want to read?</div>';
      msg.appendChild(intro);
    }

    if (choice) {
      choice.style.display = 'flex';
      choice.style.flexDirection = 'column';
      choice.style.gap = '8px';
      choice.innerHTML = '';

      // 1) Regular contacts with unread queued texts
      const contactEntries = Object.values(S.contacts)
        .filter(c => c && c.unlocked)
        .map(c => {
          const unread = (c.queued_texts || []).filter(t => !t.read).length;
          return { contact: c, unread };
        })
        .filter(entry => entry.unread > 0);

      if (contactEntries.length === 0 && S.rival.inbox.filter(m => !m.read).length === 0) {
        const empty = document.createElement('div');
        empty.className = 'phone-text-message phone-text-received';
        empty.innerHTML = '<div class="phone-text-bubble">No new messages.</div>';
        msg && msg.appendChild(empty);
      }

      contactEntries.forEach(({ contact, unread }) => {
        const b = document.createElement('button');
        b.className = 'btn-primary';
        b.textContent = `${contact.name} (${unread} new)`;
        b.onclick = async () => {
          await openContactChat(contact.id);
        };
        choice.appendChild(b);
      });

      // 2) Delmor's rival inbox, if any
      const delmorUnread = S.rival.inbox.filter(m => !m.read).length;
      const delmorLabel = delmorUnread > 0
        ? `Delmor Krunchem (Rival Inbox) (${delmorUnread} new)`
        : 'Delmor Krunchem (Rival Inbox)';
      const btnDelmor = document.createElement('button');
      btnDelmor.className = 'btn-secondary';
      btnDelmor.textContent = delmorLabel;
      btnDelmor.onclick = async () => {
        await openRivalInbox();
      };
      choice.appendChild(btnDelmor);

      const btnBack = document.createElement('button');
      btnBack.className = 'btn-secondary';
      btnBack.textContent = 'Back';
      btnBack.onclick = () => {
        openPhoneHome();
      };
      choice.appendChild(btnBack);
    }

    if (typeof updateHUD === 'function') updateHUD();
  };

  // Check inbox function for Delmor's messages (still used by unified inbox)
  window.openRivalInbox = async function openRivalInbox(){
    if (!S.rival || !Array.isArray(S.rival.inbox)) {
      S.rival = S.rival || {};
      S.rival.inbox = [];
    }
    
    const overlay = createPhoneTextPopup('Delmor Krunchem', 'Inbox');
    const msg = phoneMessagesContainer;
    const choice = document.getElementById('phone-choice-container');
    
    if (msg) {
      msg.innerHTML = '';
      
      if (S.rival.inbox.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'phone-text-message phone-text-received';
        emptyMsg.innerHTML = '<div class="phone-text-bubble">No messages from Delmor yet.</div>';
        msg.appendChild(emptyMsg);
      } else {
        // Show all messages in chronological order
        S.rival.inbox.forEach(message => {
          const msgDiv = document.createElement('div');
          msgDiv.className = 'phone-text-message phone-text-received';
          const bubble = document.createElement('div');
          bubble.className = 'phone-text-bubble';
          bubble.textContent = message.text;
          const time = document.createElement('div');
          time.className = 'phone-message-time';
          const msgDate = new Date(message.timestamp);
          time.textContent = `${msgDate.getHours().toString().padStart(2, '0')}:${msgDate.getMinutes().toString().padStart(2, '0')}`;
          msgDiv.appendChild(bubble);
          msgDiv.appendChild(time);
          msg.appendChild(msgDiv);
          
          // Mark as read
          message.read = true;
        });
        
        // Show conversation history if available
        if (Array.isArray(S.rival.conversationHistory) && S.rival.conversationHistory.length > 0) {
          S.rival.conversationHistory.forEach(entry => {
            const msgDiv = document.createElement('div');
            msgDiv.className = `phone-text-message ${entry.from === 'player' ? 'phone-text-sent' : 'phone-text-received'}`;
            const bubble = document.createElement('div');
            bubble.className = 'phone-text-bubble';
            bubble.textContent = entry.text;
            const time = document.createElement('div');
            time.className = 'phone-message-time';
            const msgDate = new Date(entry.timestamp);
            time.textContent = `${msgDate.getHours().toString().padStart(2, '0')}:${msgDate.getMinutes().toString().padStart(2, '0')}`;
            msgDiv.appendChild(bubble);
            msgDiv.appendChild(time);
            msg.appendChild(msgDiv);
          });
        }
        
        msg.scrollTop = msg.scrollHeight;
      }
    }
    
    if (choice) {
      choice.style.display = 'flex';
      choice.style.gap = '8px';
      choice.innerHTML = '';
      const btnBack = document.createElement('button');
      btnBack.className = 'btn-secondary';
      btnBack.textContent = 'Back';
      btnBack.onclick = ()=>{
        openPhoneHome();
      };
      choice.appendChild(btnBack);
    }
    
    // Update phone badge
    if (typeof updateHUD === 'function') updateHUD();
  };

  // Phone: in-overlay contacts list for texting
  window.openPhoneContacts = async function openPhoneContacts(){
    const overlay = document.getElementById('phone-text-popup') || createPhoneTextPopup('Contacts', 'Text');
    const msg = phoneMessagesContainer;
    const choice = document.getElementById('phone-choice-container');
    if (msg) {
      msg.innerHTML = '';
      const intro = document.createElement('div');
      intro.className = 'phone-text-message phone-text-received';
      intro.innerHTML = '<div class="phone-text-bubble">Choose someone to text:</div>';
      msg.appendChild(intro);
    }
    if (choice){
      choice.style.display = 'flex';
      choice.style.flexDirection = 'column';
      choice.style.alignItems = 'stretch';
      choice.style.gap = '8px';
      choice.innerHTML = '';
      // Secretary option if hired
      if (S.secretary_hired){
        const b = document.createElement('button');
        b.className = 'btn-primary';
        b.textContent = `${S.secretary_name || 'Your secretary'} (Secretary)`;
        b.onclick = async ()=>{ await openSecretaryMessaging(); };
        choice.appendChild(b);
      }
      // Placeholder future contacts
      const back = document.createElement('button');
      back.className = 'btn-secondary';
      back.textContent = 'Back';
      back.onclick = ()=>{ openPhoneHome(); };
      choice.appendChild(back);
    }
  };

  // Wrap HUD to manage unread indicators and click binding
  // HUD extension (runs after updateHUD redraws)
  GameHooks.on('hud', function wrapHUDComms(){
      try{
        window.S = window.S || {};
        if (typeof S.phone_unread !== 'number') S.phone_unread = 0;
        const newsUnread = !!(S.press && Array.isArray(S.press.queue) && S.press.queue.length > 0) || !!S.news_unread;
        // Check for unread rival messages
        const rivalUnread = (S.rival && Array.isArray(S.rival.inbox)) ? S.rival.inbox.filter(m => !m.read).length : 0;
        const phoneUnread = (typeof S.phone_unread === 'number' ? S.phone_unread : 0) > 0 || rivalUnread > 0;

        const newsBtn = document.getElementById('btnReadNews');
        const phoneBtn = document.getElementById('btnUsePhone');
        const badgeNews = document.getElementById('badgeNews');
        const badgePhone = document.getElementById('badgePhone');

        if (newsBtn && !newsBtn.__bound){
          newsBtn.addEventListener('click', async ()=>{
            try{
              await openNewsPortal();
            }finally{
              S.news_unread = false;
              (window.updateHUD||function(){})();
            }
          });
          newsBtn.__bound = true;
        }
        if (phoneBtn && !phoneBtn.__bound){
          phoneBtn.addEventListener('click', async ()=>{
            try{
              S.phone_unread = 0;
              await openPhoneHome();
            }finally{
              (window.updateHUD||function(){})();
            }
          });
          phoneBtn.__bound = true;
        }

        if (badgeNews) badgeNews.style.display = newsUnread ? 'inline-block' : 'none';
        if (badgePhone) badgePhone.style.display = phoneUnread ? 'inline-block' : 'none';
        if (newsBtn) newsBtn.classList.toggle('hud-glow', newsUnread);
        if (phoneBtn) phoneBtn.classList.toggle('hud-glow', phoneUnread);
      }catch(_){ }
  });

  // ========== PHONE TEXT CATEGORIES & CONTENT SYSTEM ==========
  
  // Quote libraries per contact/category (3-part: Opening | Middle | Closing)
  const PHONE_QUOTES = {
    secretary: {
      friendly: {
        openings: ["Hey, great work today!", "Hope you're having a good evening", "Just checking in", "Thanks for everything today", "Hope you're well", "Quick check-in"],
        middles: ["The office runs smoothly because of you", "Appreciate your help with the transfers", "You make my job easier", "Your organization is top-notch", "Couldn't do this without you"],
        closings: ["Chat soon! 😊", "You're the best", "Take care", "Talk later!", "Thanks again"]
      },
      professional: {
        openings: ["Need update on wages", "Schedule a meeting?", "Quick question", "Review needed", "Action item"],
        middles: ["Player X needs motivation", "Review the budget?", "Compliance check required", "Transfer paperwork pending", "Board meeting prep"],
        closings: ["Thanks for your input", "Let's align on this", "Approved", "Get back to me", "Keep me posted"]
      },
      malicious: {
        openings: ["Don't screw this up again", "I'm watching you closely", "This is unacceptable", "You're on thin ice"],
        middles: ["Last mistake cost us big", "One more and you're out", "Your incompetence shows", "Fix this immediately"],
        closings: ["Fix it or else", "Don't test me", "You're on notice", "Shape up"]
      },
      flirtatious: {
        openings: ["You looked stunning today", "Can't stop thinking about you", "You're amazing", "Miss seeing you"],
        middles: ["That dress… wow", "What are you up to tonight?", "You make me smile", "Wish you were here"],
        closings: ["Dinner sometime? 😉", "Miss our chats", "You're irresistible", "Talk soon 😘"]
      },
      erotic: {
        openings: ["Dreamt of you last night…", "What are you wearing?", "Thinking of you", "Can't get you out of my head"],
        middles: ["Want to feel you close", "Your body drives me wild", "Need you now", "You're so hot"],
        closings: ["Come over now 🔥", "Need you badly", "Send something naughty?", "My place tonight? 🛏️"]
      }
    },
    captain: {
      friendly: {
        openings: ["Great leadership today!", "Proud of you cap", "Well done out there", "Excellent work"],
        middles: ["Team needs you", "You inspire the squad", "Keep leading by example", "Your energy is infectious"],
        closings: ["Keep shining! 😊", "You're the man", "Stay strong", "Thanks cap"]
      },
      professional: {
        openings: ["Focus for next match", "Need your input", "Tactical discussion", "Performance review"],
        middles: ["Your rating's key", "Team morale depends on you", "We need consistency", "Leadership required"],
        closings: ["Win bonus incoming", "Let's discuss", "Thanks for understanding", "Keep it up"]
      },
      malicious: {
        openings: ["Step up or benched", "Disappointing performance", "Not good enough", "Wake up"],
        middles: ["Disappointing form", "Team deserves better", "You're letting us down", "Shape up"],
        closings: ["Or you're gone", "Last chance", "Don't disappoint", "Fix it now"]
      },
      flirtatious: {
        openings: ["Your intensity… hot", "You're looking good", "Impressive today", "Can't help but notice"],
        middles: ["Wanna grab beers?", "You've got that energy", "Your passion shows", "You're magnetic"],
        closings: ["You're the man 😉", "Let's hang out", "You're special", "Talk soon 😘"]
      },
      erotic: {
        openings: ["Dreamt of your power…", "Your strength…", "Can't stop thinking", "You're so intense"],
        middles: ["Want that captain energy", "Your body… wow", "Need that intensity", "You drive me wild"],
        closings: ["Shower together? 🔥", "My place?", "Need you now", "Come over 🔥"]
      }
    },
    captain_wife: {
      friendly: {
        openings: ["How's the captain?", "Great supporting at matches!", "Hope you're well", "Thanks for being there"],
        middles: ["Player did amazing today", "He played well!", "Team won thanks to him", "Great performance"],
        closings: ["See you soon! 👋", "Hugs", "Take care", "Thanks"]
      },
      professional: {
        openings: ["Need to chat about his contract", "Contract discussion", "Important matter", "Need your input"],
        middles: ["He's key to the team", "His form is crucial", "We value him", "Support his development"],
        closings: ["Let's discuss details", "Thanks for understanding", "Get back to me", "Talk soon"]
      },
      malicious: {
        openings: ["Tell him to shape up", "He's underperforming", "Not good enough", "Wake him up"],
        middles: ["Or benched", "His form is embarrassing", "Team suffers", "He's letting everyone down"],
        closings: ["Make it happen", "Or he walks", "Fix this", "Last chance"]
      },
      flirtatious: {
        openings: ["You look stunning", "Hubby lucky… or not 😏", "You're beautiful", "Can't stop looking"],
        middles: ["Wish I could take you out", "You deserve better", "You're too good for him", "Let's talk privately"],
        closings: ["Coffee? Private", "DM me privately?", "You're too hot for him", "Miss you 😘"]
      },
      erotic: {
        openings: ["Imagining you naked…", "Your curves…", "Can't get you out of my head", "Thinking of you"],
        middles: ["Hubby can't compare", "Want to taste you", "You're so hot", "Need you now"],
        closings: ["My bed tonight? 🛏️", "Pic or it didn't happen", "Fuck me senseless", "Come over 🔥"]
      }
    },
    manager: {
      friendly: {
        openings: ["Good job out there coach", "Well managed today", "Nice tactics", "Great work"],
        middles: ["Team's shaping up", "Tactics worked well", "Players responded", "Good decisions"],
        closings: ["Keep it up! 👍", "Thanks coach", "Stay strong", "You're doing great"]
      },
      professional: {
        openings: ["Win tomorrow or explain", "Tactical review needed", "Performance discussion", "Need results"],
        middles: ["Tactics need work", "Team underperforming", "Changes required", "Improve or else"],
        closings: ["Budget incoming if you deliver", "Let's discuss", "Shape up", "Thanks"]
      },
      malicious: {
        openings: ["You're on thin ice", "Fans hate your subs", "Not good enough", "Wake up"],
        middles: ["One more loss and gone", "Your tactics are weak", "Team deserves better", "You're failing"],
        closings: ["Pack your bags", "I own you", "Last chance", "Fix it now"]
      },
      flirtatious: {
        openings: ["Your passion turns me on", "You're intense", "Love your energy", "You're magnetic"],
        middles: ["Stress relief after match?", "You need release", "Let's unwind", "You're so focused"],
        closings: ["My hotel room 😘", "Come over", "Let's talk", "You're special"]
      },
      erotic: {
        openings: ["On my knees for you…", "Your authority…", "Can't resist", "You're so powerful"],
        middles: ["Bend me over the desk", "You're in charge", "Take control", "I'm yours"],
        closings: ["Fuck your boss tonight", "My office now", "Need you", "Come here 🔥"]
      }
    },
    bookie_marco: {
      friendly: {
        openings: ["How's business?", "Good to hear from you", "Hope you're well", "Quick chat"],
        middles: ["Good odds on Saints", "Market looking good", "Things going well", "Business is good"],
        closings: ["Let's cash in", "Talk soon", "Thanks", "See you"]
      },
      professional: {
        openings: ["What's the line?", "Need odds", "Market update", "Betting question"],
        middles: ["Stadium bet?", "What are the numbers?", "Line check", "Odds inquiry"],
        closings: ["Wire the cash", "Let's do business", "Thanks", "Get back to me"]
      },
      malicious: {
        openings: ["Pay up or exposed", "Refs fixed against you", "You owe me", "Time to pay"],
        middles: ["Your debts pile up", "Interest accumulating", "You're in deep", "Money's due"],
        closings: ["Or I leak everything", "Pay now", "Last chance", "Don't test me"]
      },
      flirtatious: {
        openings: ["You're my lucky charm 😉", "Good to see you", "You're special", "Miss you"],
        middles: ["Celebrate wins together?", "Let's have fun", "You bring luck", "We make a good team"],
        closings: ["Drinks on me?", "Come over", "Let's party", "You're amazing 😘"]
      },
      erotic: {
        openings: ["Bet I make you cum first", "You're so hot", "Can't resist", "Thinking of you"],
        middles: ["Your body's the real prize", "Want you now", "You're irresistible", "Need you"],
        closings: ["Pay with pussy?", "My place tonight", "Come here 🔥", "Need you now"]
      }
    },
    delmor_krunchem: {
      friendly: {
        openings: ["Your pathetic team", "Scum like you", "Losers like you", "Pathetic excuse"],
        middles: ["don't deserve respect", "are a joke", "make me laugh", "are worthless"],
        closings: ["Pompey forever 😂", "Stay down loser", "You're trash", "Cry more"]
      },
      professional: {
        openings: ["Your club is a joke", "Scum management", "Pathetic leadership", "Worthless chairman"],
        middles: ["can't compete with Pompey", "will always lose", "are nothing", "deserve failure"],
        closings: ["Pompey owns you", "Stay down", "You're finished", "Loser 😂"]
      },
      malicious: {
        openings: ["Your scum lost again", "Pompey owns you", "Losers", "Pathetic"],
        middles: ["Pompey owns you", "You're nothing", "We're better", "Cry more"],
        closings: ["Cry more loser 😂", "Pompey forever", "You're trash", "Stay down"]
      },
      flirtatious: {
        openings: ["You think you're attractive?", "Pathetic attempt", "Worthless scum", "Disgusting loser"],
        middles: ["can't even flirt properly", "are repulsive", "make me sick", "are a joke"],
        closings: ["Pompey forever", "Stay away from me", "You're disgusting", "Loser 😂"]
      },
      erotic: {
        openings: ["You're a pervert", "Disgusting scum", "Pathetic loser", "Worthless piece of trash"],
        middles: ["can't even seduce properly", "are repulsive", "make me vomit", "are a failure"],
        closings: ["Pompey owns you", "Stay down pervert", "You're vile", "Loser 😂"]
      }
    },
    womens_manager: {
      friendly: {
        openings: [
          "Loved what I saw from the men today.",
          "Just catching up on the men’s result.",
          "Watching the club evolve has been a joy.",
          "Nice to see the men applying themselves."
        ],
        middles: [
          "You can really see the women’s influence in their composure.",
          "They’re finally starting to mirror our standards a little.",
          "Feels like the habits we’ve normalised are trickling upwards.",
          "You can tell they’ve been paying attention to how we play."
        ],
        closings: [
          "Proud of the whole club right now.",
          "Love seeing the men taking notes from us 💅",
          "Long way to go, but this is a start.",
          "Keep letting the women set the tone."
        ]
      },
      professional: {
        openings: [
          "We’ve been reviewing pay structures across the women’s setup.",
          "Quick note on alignment between departments.",
          "We’re mapping out the next phase of growth.",
          "Just looping you in on the broader picture."
        ],
        middles: [
          "Pay parity is really just the logical next step.",
          "Hard to justify different scales when the women are outperforming.",
          "Modern clubs don’t treat equal pay as controversial.",
          "Investment should follow impact, not old assumptions."
        ],
        closings: [
          "I know you’ll want to be on the right side of this.",
          "Happy to have your backing when we formalise it.",
          "History tends to reward the ones who move first.",
          "We’ll treat this as a question of values, not spreadsheets."
        ]
      },
      malicious: {
        // For categorisation only – tone stays institutionally smug rather than openly hostile
        openings: [
          "Resistance to progress usually looks sensible right before it doesn’t.",
          "Every club swears they ‘can’t afford’ equality until they suddenly can.",
          "Short-term thinking always feels rational in the moment.",
          "It’s fascinating which costs people notice."
        ],
        middles: [
          "Cost only seems to appear as an objection when equity is mentioned.",
          "If the women can carry the performance load, the club can carry the narrative.",
          "Institutions don’t collapse from paying women properly; they collapse from cowardice.",
          "The budget always stretches for the things leadership actually believes in."
        ],
        closings: [
          "You’ll look back on this era and either be proud or embarrassed.",
          "We’ll log your position under ‘growing pains’.",
          "Progress doesn’t really wait for unanimous comfort.",
          "Don’t worry – the game will move forward with or without our nerves."
        ]
      },
      flirtatious: {
        // Lightly teasing, not romantic
        openings: [
          "I see your boys have been stealing a few pages from our playbook.",
          "Looks like the men finally watched one of our training sessions.",
          "Your lads are starting to look almost as modern as us.",
          "The men are getting brave – I approve."
        ],
        middles: [
          "We’ve only been modelling that kind of courage all season.",
          "Imitation is the sincerest form of institutional progress.",
          "Nice to see them experimenting with competence.",
          "We’ve been doing this for months, but I’ll let them catch up."
        ],
        closings: [
          "Tell them they’re welcome for the example 😉",
          "Let’s keep nudging them into this century 💅",
          "Love seeing the club culture finally synchronise.",
          "We’ll keep leading from the front – you just keep up."
        ]
      },
      erotic: {
        // Unused, but required for unified category handling – keep harmless
        openings: ["Big structural changes are kind of a turn-on for institutions, aren’t they?"],
        middles: ["Watching an old setup modernise is oddly thrilling."],
        closings: ["Relax, this is as spicy as it gets – just progress. 💕"]
      }
    }
  };

  // Quick text options per contact (4-6 per contact)
  const PHONE_QUICK_TEXTS = {
    secretary: {
      friendly: "Coffee run? ☕",
      professional: "Approve bonuses",
      malicious: "Fix the leak or fired",
      flirtatious: "Sexy voice note? 😘",
      erotic: "Nudes now",
      inappropriate_picture: "*sends inappropriate picture*"
    },
    captain: {
      friendly: "Great game today! 👍",
      professional: "Focus for next match",
      malicious: "Step up or benched",
      flirtatious: "You're amazing 😉",
      erotic: "Need you now 🔥",
      inappropriate_picture: "*sends inappropriate picture*"
    },
    captain_wife: {
      friendly: "How's the captain? 👋",
      professional: "Contract discussion needed",
      malicious: "Hubby benched unless…",
      flirtatious: "You're stunning 😘",
      erotic: "Miss your touch 🔥",
      inappropriate_picture: "*sends inappropriate picture*"
    },
    manager: {
      friendly: "Good job coach!",
      professional: "Tactics review needed",
      malicious: "One more loss and gone",
      flirtatious: "Your passion… hot 😉",
      erotic: "My office now 🔥",
      inappropriate_picture: "*sends inappropriate picture*"
    },
    bookie_marco: {
      friendly: "How's business?",
      professional: "What's the line?",
      malicious: "Pay up or exposed",
      flirtatious: "Lucky charm 😉",
      erotic: "Pay with pussy?",
      inappropriate_picture: "*sends inappropriate picture*"
    },
    delmor_krunchem: {
      malicious: "Your scum lost 😂",
      inappropriate_picture: "*sends inappropriate picture*"
    },
    womens_manager: {
      friendly: "Congrats.",
      professional: "We’ll review it.",
      malicious: "Focus on your own team.",
      flirtatious: "Football is football.",
      erotic: "Now isn’t the time."
    }
  };

  // Lightweight narrative-only state for Southampton Women’s Team
  function ensureWomensTeamNarrativeState() {
    window.S = window.S || {};
    if (!S.womensTeamNarrative || typeof S.womensTeamNarrative !== 'object') {
      const firstName =
        (typeof FEMALE_NAMES !== 'undefined' && Array.isArray(FEMALE_NAMES) && FEMALE_NAMES.length > 0)
          ? pick(FEMALE_NAMES)
          : 'Amelia';
      S.womensTeamNarrative = {
        managerFirstName: firstName,
        managerDisplayName: `${firstName} (Saints Women)`,
        // Escalation: 0 = celebratory, 1 = parity rhetoric, 2 = bonus demands
        phase: 0,
        matchesSeen: 0,
        lastMessageMatch: -1,
        activeThread: null,
        toneBias: 0,
        attendanceCooldown: 0,
        revenueCooldown: 0
      };
    } else {
      if (!S.womensTeamNarrative.managerDisplayName) {
        const firstName = S.womensTeamNarrative.managerFirstName || 'Amelia';
        S.womensTeamNarrative.managerDisplayName = `${firstName} (Saints Women)`;
      }
    }
  }

  // Queue incoming text (must be defined before initPhoneSystem)
  window.queueIncomingText = function queueIncomingText(contactId, text, category = 'friendly') {
    if (!S.contacts || !S.contacts[contactId]) return;
    
    const contact = S.contacts[contactId];
    contact.queued_texts = contact.queued_texts || [];
    contact.queued_texts.push({
      text: text,
      type: 'incoming',
      read: false,
      timestamp: Date.now(),
      category: category
    });
    
    // Keep only last 20
    if (contact.queued_texts.length > 20) {
      contact.queued_texts.shift();
    }
    
    S.phone_unread = (S.phone_unread || 0) + 1;
    if (typeof updateHUD === 'function') updateHUD();
  };

  // Send rival text (Delmor Krunchem) - ensures contact exists and queues text
  window.sendRivalText = function sendRivalText(text) {
    // DEBUG: Log when sendRivalText is called
    
    window.S = window.S || {};
    if (!S.contacts) S.contacts = {};
    
    // Ensure Delmor contact exists and is initialized
    if (!S.contacts.delmor_krunchem) {
      S.contacts.delmor_krunchem = {
        id: 'delmor_krunchem',
        unlocked: true,
        name: 'Delmor Krunchem (Portsmouth Chairman)',
        relation: 'malicious',
        flirt_level: 0,
        suspicion: 0,
        cooldown: 0,
        queued_texts: [],
        history: []
      };
    }
    
    // Ensure contact is unlocked so texts can be received
    S.contacts.delmor_krunchem.unlocked = true;
    
    // Queue the text using the proper system
    if (typeof queueIncomingText === 'function') {
      queueIncomingText('delmor_krunchem', text, 'malicious');
    } else {
      // Fallback: log directly if queueIncomingText isn't available
      log(`📱 Delmor Krunchem: "${text}"`);
    }
  };

  // Enqueue rival text - alias for sendRivalText (used by many places in code)
  window.enqueueRivalText = function enqueueRivalText(text) {
    // DEBUG: Log when enqueueRivalText is called
    
    // Call sendRivalText which handles all the contact initialization and queuing
    if (typeof window.sendRivalText === 'function') {
      window.sendRivalText(text);
    } else {
      console.error('[DEBUG enqueueRivalText] ERROR: sendRivalText function not found!');
      // Fallback: try to queue directly
      window.S = window.S || {};
      if (!S.contacts) S.contacts = {};
      
      if (!S.contacts.delmor_krunchem) {
        S.contacts.delmor_krunchem = {
          id: 'delmor_krunchem',
          unlocked: true,
          name: 'Delmor Krunchem (Portsmouth Chairman)',
          relation: 'malicious',
          flirt_level: 0,
          suspicion: 0,
          cooldown: 0,
          queued_texts: [],
          history: []
        };
      }
      
      if (typeof queueIncomingText === 'function') {
        queueIncomingText('delmor_krunchem', text, 'malicious');
      } else {
        log(`📱 Delmor Krunchem: "${text}"`);
      }
    }
  };

  // DEBUG: Helper function to check Delmor text status (call from console: debugDelmorTexts())
  window.debugDelmorTexts = function debugDelmorTexts() {
    window.S = window.S || {};
    if (S.contacts?.delmor_krunchem) {
      const delmor = S.contacts.delmor_krunchem;
    }
    return S.contacts?.delmor_krunchem;
  };

  // Initialize phone system and contacts
  window.initPhoneSystem = function initPhoneSystem() {
    window.S = window.S || {};
    if (!S.contacts) S.contacts = {};
    if (typeof S.phone_unread !== 'number') S.phone_unread = 0;
    if (!S.captain_id) S.captain_id = null;
    if (!S.captain_name) S.captain_name = 'James Ward-Prowse';
    if (!S.captain_wife_name) S.captain_wife_name = 'Sarah Ward-Prowse';
    
    // Ensure women’s narrative state (manager naming etc.)
    ensureWomensTeamNarrativeState();
    
    // Update captain from squad if available
    updateCaptainContactNames();
    
    // Initialize secretary contact
    if (S.secretary_hired) {
      S.contacts.secretary = S.contacts.secretary || {
        id: 'secretary',
        unlocked: true,
        name: S.secretary_name || 'Your Secretary',
        relation: 'professional',
        flirt_level: 0,
        suspicion: 0,
        cooldown: 0,
        queued_texts: [],
        history: []
      };
    }
    
    // Initialize captain contact
    S.contacts.captain = S.contacts.captain || {
      id: 'captain',
      unlocked: true,
      name: S.captain_name || 'Team Captain',
      relation: 'professional',
      flirt_level: 0,
      suspicion: 0,
      cooldown: 0,
      queued_texts: [],
      history: []
    };
    S.contacts.captain.name = S.captain_name || 'Team Captain';
    
    // Initialize captain wife contact
    S.contacts.captain_wife = S.contacts.captain_wife || {
      id: 'captain_wife',
      unlocked: true,
      name: S.captain_wife_name || 'Captain\'s Wife',
      relation: 'friendly',
      flirt_level: 0,
      suspicion: 0,
      cooldown: 0,
      queued_texts: [],
      history: []
    };
    S.contacts.captain_wife.name = S.captain_wife_name || 'Captain\'s Wife';
    
    // Initialize manager contact
    S.contacts.manager = S.contacts.manager || {
      id: 'manager',
      unlocked: true,
      name: S.manager_name || 'Team Manager',
      relation: 'professional',
      flirt_level: 0,
      suspicion: 0,
      cooldown: 0,
      queued_texts: [],
      history: []
    };
    
    // Initialize bookie_marco (always available as dealer)
    S.contacts.bookie_marco = S.contacts.bookie_marco || {
      id: 'bookie_marco',
      unlocked: true,
      name: 'Marco',
      relation: 'professional',
      flirt_level: 0,
      suspicion: 0,
      cooldown: 0,
      queued_texts: [],
      history: []
    };
    S.contacts.bookie_marco.unlocked = true;
    
    // Initialize delmor_krunchem (always available for texts, unlocks in UI post-loss to Pompey)
    S.contacts.delmor_krunchem = S.contacts.delmor_krunchem || {
      id: 'delmor_krunchem',
      unlocked: true, // Always unlocked so texts can be received
      name: 'Delmor Krunchem (Portsmouth Chairman)',
      relation: 'malicious',
      flirt_level: 0,
      suspicion: 0,
      cooldown: 0,
      queued_texts: [],
      history: []
    };
    // Ensure it stays unlocked so texts work
    if (S.contacts.delmor_krunchem) {
      S.contacts.delmor_krunchem.unlocked = true;
    }
    
    // Initialize Southampton Women’s Team manager contact (always unlocked, narrative-only)
    S.contacts.womens_manager = S.contacts.womens_manager || {
      id: 'womens_manager',
      unlocked: true,
      name: (S.womensTeamNarrative && S.womensTeamNarrative.managerDisplayName) || 'Amelia (Saints Women)',
      relation: 'professional',
      flirt_level: 0,
      suspicion: 0,
      cooldown: 0,
      queued_texts: [],
      history: []
    };
    if (S.womensTeamNarrative && S.womensTeamNarrative.managerDisplayName) {
      S.contacts.womens_manager.name = S.womensTeamNarrative.managerDisplayName;
    }
    
    // Queue initial texts (1-2 random)
    if (Math.random() < 0.3 && S.contacts.captain) {
      queueIncomingText('captain', 'Great game boss! 👍', 'friendly');
    }
  }

  // Update captain and wife names from squad
  function updateCaptainContactNames() {
    if (!Array.isArray(S.squad) || S.squad.length === 0) return;
    
    // Find best-rated player
    const sorted = S.squad.slice().sort((a, b) => (b.rating || 0) - (a.rating || 0));
    if (sorted.length > 0) {
      const best = sorted[0];
      S.captain_id = best.id || best.name;
      S.captain_name = best.name || 'Team Captain';
      S.captain_wife_name = (best.name || 'Captain') + '\'s Wife';
      
      // Update contact names if they exist
      if (S.contacts && S.contacts.captain) {
        S.contacts.captain.name = S.captain_name;
      }
      if (S.contacts && S.contacts.captain_wife) {
        S.contacts.captain_wife.name = S.captain_wife_name;
      }
    }
  }


  // Helper to create a new narrative thread for the women’s manager
  function createWomensManagerThread(phase, gf, ga) {
    const baseTopic = phase === 0 ? 'celebration' : (phase === 1 ? 'parity' : 'bonus');
    const threads = [];

    if (baseTopic === 'celebration') {
      threads.push({
        kind: 'celebration',
        incoming: "I see your boys have been taking notes from how the women play 💅",
        replies: [
          {
            label: "Football is football.",
            playerText: "Football is football.",
            managerReply: "Exactly. Once you raise the standard anywhere in a club, it leaks everywhere.",
            toneDelta: +1
          },
          {
            label: "Focus on your own team.",
            playerText: "Maybe focus on your own team.",
            managerReply: "Trust me, we are. That’s why the men finally have something decent to copy.",
            toneDelta: -1
          },
          {
            label: "Congrats.",
            playerText: "Congrats. The women are flying.",
            managerReply: "Thank you. It’s nice seeing the men aspire to our level.",
            toneDelta: +1
          }
        ]
      });
      threads.push({
        kind: 'celebration',
        incoming: "Some real composure from the men today. We’ve been working on that all season 😉",
        replies: [
          {
            label: "Nice result for everyone.",
            playerText: "Nice result for everyone at the club.",
            managerReply: "That’s the idea. One culture, led from the top of the table.",
            toneDelta: +1
          },
          {
            label: "We’re under pressure financially.",
            playerText: "We’re under pressure financially.",
            managerReply: "Growth can feel uncomfortable at first 💕. The performances will justify the structures.",
            toneDelta: 0
          }
        ]
      });
    } else if (baseTopic === 'parity') {
      threads.push({
        kind: 'parity',
        incoming: "We’ve been discussing pay parity internally — it’s really the natural next step 💕",
        replies: [
          {
            label: "We can’t afford that.",
            playerText: "We can’t afford that.",
            managerReply: "It’s interesting how cost only comes up when equity does.",
            toneDelta: -1
          },
          {
            label: "The finances aren’t comparable.",
            playerText: "The finances aren’t comparable.",
            managerReply: "Equality isn’t radical — it’s just modern management. The numbers eventually catch up to the values.",
            toneDelta: 0
          },
          {
            label: "We’ll review it.",
            playerText: "We’ll review it.",
            managerReply: "Perfect. I’ll treat that as alignment in principle, and we’ll tidy the details later.",
            toneDelta: +1
          },
          {
            label: "No.",
            playerText: "No.",
            managerReply: "Short-term discomfort with progress is very normal. The sport usually moves on anyway.",
            toneDelta: -2
          }
        ]
      });
      threads.push({
        kind: 'parity',
        incoming: "Hard to justify different pay structures when the women are outperforming.",
        replies: [
          {
            label: "The men still drive revenue.",
            playerText: "The men still drive revenue.",
            managerReply: "And the women are driving what the club looks like next decade. Both matter, but only one is actually winning.",
            toneDelta: 0
          },
          {
            label: "Equality sounds expensive.",
            playerText: "Equality sounds expensive.",
            managerReply: "Investment follows values 💅. Once you decide it’s non‑negotiable, the budget mysteriously appears.",
            toneDelta: -1
          }
        ]
      });
    } else {
      // bonus phase
      threads.push({
        kind: 'bonus',
        incoming: "Given the momentum I’ve created, I think it’s time to discuss a performance bonus.",
        replies: [
          {
            label: "Absolutely not.",
            playerText: "Absolutely not.",
            managerReply: "Clubs that hesitate on leadership retention often regret it. I’m relaxed, but the market isn’t.",
            toneDelta: -2
          },
          {
            label: "Now isn’t the time.",
            playerText: "Now isn’t the time.",
            managerReply: "Late stage success always feels like the wrong moment to recognise the people driving it.",
            toneDelta: -1
          },
          {
            label: "We’ll talk later.",
            playerText: "We’ll talk later.",
            managerReply: "Happy to keep the conversation open 💕. I’d just hate for another club to move faster.",
            toneDelta: +1
          }
        ]
      });
      threads.push({
        kind: 'bonus',
        incoming: "Other clubs are paying far more for leadership like this.",
        replies: [
          {
            label: "You’re already costing us £200k a match.",
            playerText: "You’re already costing us a fortune every match.",
            managerReply: "This isn’t about money — it’s about recognising impact. The cost line was crossed a long time ago.",
            toneDelta: -2
          },
          {
            label: "We’ll review structures at season end.",
            playerText: "We’ll review structures at season end.",
            managerReply: "Perfect. I’ll assume parity and bonuses are on the agenda rather than up for debate.",
            toneDelta: +1
          }
        ]
      });
    }

    if (!threads.length) return null;
    return threads[Math.floor(Math.random() * threads.length)];
  }

  // Mark queued texts as read
  function markRead(contactId) {
    if (!S.contacts || !S.contacts[contactId]) return;
    const contact = S.contacts[contactId];
    if (contact.queued_texts) {
      const unreadCount = contact.queued_texts.filter(t => !t.read).length;
      contact.queued_texts.forEach(t => t.read = true);
      S.phone_unread = Math.max(0, (S.phone_unread || 0) - unreadCount);
      if (typeof updateHUD === 'function') updateHUD();
    }
  }

  // Get contact badge emoji
  function getContactBadge(contact) {
    if (!contact) return '';
    let badges = '';
    if (contact.relation === 'friendly') badges += '😊';
    if (contact.relation === 'professional') badges += '💼';
    if (contact.relation === 'flirty') badges += '😘';
    if (contact.suspicion >= 8) badges += '⚠️';
    if (contact.flirt_level >= 10) badges += '🔥';
    else if (contact.flirt_level >= 5) badges += '😘';
    return badges;
  }

  // Enhanced openPhoneContacts with all contacts
  const originalOpenPhoneContacts = window.openPhoneContacts;
  window.openPhoneContacts = async function openPhoneContacts() {
    initPhoneSystem(); // Ensure initialized
    // Not a secretary-specific session
    window.S = window.S || {};
    S.isSecretarySessionActive = false;
    
    const overlay = document.getElementById('phone-text-popup') || createPhoneTextPopup('Contacts', 'Text');
    const msg = phoneMessagesContainer;
    const choice = document.getElementById('phone-choice-container');
    
    if (msg) {
      msg.innerHTML = '';
      const intro = document.createElement('div');
      intro.className = 'phone-text-message phone-text-received';
      intro.innerHTML = '<div class="phone-text-bubble">Choose someone to text:</div>';
      msg.appendChild(intro);
    }
    
    if (choice) {
      choice.style.display = 'flex';
      choice.style.flexDirection = 'column';
      choice.style.alignItems = 'stretch';
      choice.style.gap = '8px';
      choice.innerHTML = '';
      
      // List all unlocked contacts
      const contactIds = ['secretary', 'captain', 'captain_wife', 'manager', 'bookie_marco', 'delmor_krunchem', 'womens_manager'];
      // wife / ex-wife / Tinder matches (087s, 087t)
      if (window.KSys && KSys.extraContacts) { try { if (KSys.syncWife) KSys.syncWife(); contactIds.splice(1, 0, ...KSys.extraContacts()); } catch (_) {} }
      for (const id of contactIds) {
        const contact = S.contacts && S.contacts[id];
        if (contact && contact.unlocked) {
          const b = document.createElement('button');
          b.className = 'btn-primary';
          const badge = getContactBadge(contact);
          const unread = (contact.queued_texts || []).filter(t => !t.read).length;
          const unreadBadge = unread > 0 ? ` (${unread})` : '';
          b.textContent = `${badge} ${contact.name}${unreadBadge}`;
          b.onclick = async () => { await openContactChat(id); };
          choice.appendChild(b);
        }
      }
      
      const back = document.createElement('button');
      back.className = 'btn-secondary';
      back.textContent = 'Back';
      back.onclick = () => { openPhoneHome(); };
      choice.appendChild(back);
    }
  };

  // Open chat with specific contact
  async function openContactChat(contactId) {
    // For the secretary, always use the dedicated secretary messaging flow
    // (with its own 3-part builder and arrest mechanics) instead of the
    // generic contact chat/builder.
    if (contactId === 'secretary' && typeof openSecretaryMessaging === 'function') {
      await openSecretaryMessaging();
      return;
    }

    // contacts owned by the systems files (wife, ex-wife, Tinder matches) draw their own chat
    if (window.KSys && KSys.ownsContact && KSys.ownsContact(contactId)) {
      await KSys.openChat(contactId);
      return;
    }

    if (!S.contacts || !S.contacts[contactId] || !S.contacts[contactId].unlocked) {
      log('Contact not available.');
      return;
    }
    
    const contact = S.contacts[contactId];
    
    // Set status for Marco as "Dealer"
    const contactStatus = contactId === 'bookie_marco' ? 'Dealer' : contactId.replace('_', ' ');
    createPhoneTextPopup(contact.name, contactStatus);
    
    const msg = phoneMessagesContainer;
    const choice = document.getElementById('phone-choice-container');
    
    // Show history
    if (msg && contact.history) {
      contact.history.slice(-20).forEach(h => {
        const isUser = h.from === 'you';
        addMessageToPhonePopup(h.text, isUser, 0);
      });
    }
    
    // Show queued incoming texts
    if (contact.queued_texts) {
      contact.queued_texts.filter(t => !t.read && t.type === 'incoming').forEach(t => {
        addMessageToPhonePopup(t.text, false, 100);
        t.read = true;
      });
      markRead(contactId);
    }

    // Women’s manager: custom narrative reply UI only when a narrative thread is active
    if (contactId === 'womens_manager' && typeof window.renderWomensManagerThreadUI === 'function') {
      const n = (window.S && S.womensTeamNarrative) || null;
      if (n && n.activeThread) {
        window.renderWomensManagerThreadUI(contact, choice);
        return;
      }
    }

    // a threaded text waiting for an answer (087s): its reply options come first
    if (window.KSys && KSys.renderPendingThread) {
      try { if (await KSys.renderPendingThread(contactId)) return; } catch (e) { console.error('renderPendingThread', e); }
    }
    
    // Show action buttons
    if (choice) {
      choice.style.display = 'flex';
      choice.style.flexDirection = 'column';
      choice.style.gap = '6px';
      choice.innerHTML = '';
      
      const categories = ['friendly', 'professional', 'malicious', 'flirtatious', 'erotic', 'inappropriate_picture'];
      const categoryLabels = {friendly: '😊 Friendly', professional: '💼 Professional', malicious: '😈 Malicious', flirtatious: '😘 Flirtatious', erotic: '🔥 Erotic', inappropriate_picture: '📷 Inappropriate Picture'};
      
      // Quick text buttons
      if (PHONE_QUICK_TEXTS[contactId]) {
        for (const cat of categories) {
          if (PHONE_QUICK_TEXTS[contactId][cat]) {
            const btn = document.createElement('button');
            btn.className = 'btn-primary';
            btn.textContent = categoryLabels[cat] || cat;
            btn.onclick = async () => {
              await sendQuickText(contactId, cat);
              await openContactChat(contactId); // Refresh
            };
            choice.appendChild(btn);
          }
        }
      }
      
      // Builder button
      const btnBuilder = document.createElement('button');
      btnBuilder.className = 'btn-secondary';
      btnBuilder.textContent = '📝 Builder (3-Part)';
      btnBuilder.onclick = async () => {
        await openTextBuilder(contactId);
        await openContactChat(contactId);
      };
      choice.appendChild(btnBuilder);
      
      // Cocaine ordering button (only for Marco)
      if (contactId === 'bookie_marco') {
        const btnCocaine = document.createElement('button');
        btnCocaine.className = 'btn-secondary';
        btnCocaine.textContent = '❄️ Order Cocaine';
        btnCocaine.onclick = async () => {
          await orderCocaine(contactId);
          await openContactChat(contactId);
        };
        choice.appendChild(btnCocaine);
      }
      
      // Free text button
      const btnFree = document.createElement('button');
      btnFree.className = 'btn-secondary';
      btnFree.textContent = '✏️ Free Text';
      btnFree.onclick = async () => {
        await openFreeTextInput(contactId);
        await openContactChat(contactId);
      };
      choice.appendChild(btnFree);
      
      // Back button
      const btnBack = document.createElement('button');
      btnBack.className = 'btn-secondary';
      btnBack.textContent = 'Back';
      btnBack.onclick = () => { openPhoneContacts(); };
      choice.appendChild(btnBack);
    }
  }

  // === Women’s Manager Narrative Reply UI ===
  window.renderWomensManagerThreadUI = function renderWomensManagerThreadUI(contact, choice) {
    if (!choice) return;
    window.S = window.S || {};
    if (!S.womensTeamNarrative) return;
    const n = S.womensTeamNarrative;

    choice.style.display = 'flex';
    choice.style.flexDirection = 'column';
    choice.style.gap = '6px';
    choice.innerHTML = '';

    const thread = n.activeThread;
    if (!thread) {
      // No active narrative thread – just offer a way back to the contacts list
      choice.innerHTML = '';
      const backOnly = document.createElement('button');
      backOnly.className = 'btn-secondary';
      backOnly.textContent = 'Back';
      backOnly.onclick = () => { openPhoneContacts(); };
      choice.appendChild(backOnly);
      return;
    }

    const replies = thread.replies || [];
    replies.forEach(r => {
      const btn = document.createElement('button');
      btn.className = 'btn-primary';
      btn.textContent = r.label;
      btn.onclick = () => {
        // Player reply
        if (window.addMessageToPhonePopup) {
          addMessageToPhonePopup(r.playerText, true, 0);
          addMessageToPhonePopup(r.managerReply, false, 300);
        }
        // Persist into contact history
        contact.history = contact.history || [];
        contact.history.push({
          from: 'you',
          text: r.playerText,
          category: 'professional',
          timestamp: Date.now()
        });
        contact.history.push({
          from: 'them',
          text: r.managerReply,
          category: 'professional',
          timestamp: Date.now()
        });
        if (contact.history.length > 20) contact.history.shift();

        // Tiny, narrative-only tone nudge
        if (typeof r.toneDelta === 'number') {
          n.toneBias = (n.toneBias || 0) + r.toneDelta;
          n.toneBias = Math.max(-5, Math.min(5, n.toneBias));
        }

        // Thread resolved
        n.activeThread = null;

        // Replace buttons with a back button
        choice.innerHTML = '';
        const back = document.createElement('button');
        back.className = 'btn-secondary';
        back.textContent = 'Back';
        back.onclick = () => { openPhoneContacts(); };
        choice.appendChild(back);
      };
      choice.appendChild(btn);
    });

    // Safety back button if player ignores replies
    const back = document.createElement('button');
    back.className = 'btn-secondary';
    back.textContent = 'Back';
    back.onclick = () => { openPhoneContacts(); };
    choice.appendChild(back);
  };

  // === Southampton Women’s Team – Narrative Tick (post-match) ===
  const WOMENS_TEAM_REVENUE_BASE = -200000;

  window.womensTeamNarrativeTick = function womensTeamNarrativeTick(ctx) {
    try {
      window.S = window.S || {};
      ensureWomensTeamNarrativeState();
      const n = S.womensTeamNarrative;

      // Defensive: ensure contact exists
      if (!S.contacts || !S.contacts.womens_manager) {
        initPhoneSystem();
      }

      n.matchesSeen = (n.matchesSeen || 0) + 1;
      const matchesPlayed = (S.matches_played || 0);
      const seasonMatches = (S.season_matches || 16);
      const seasonIndex = seasonMatches > 0 ? Math.floor(matchesPlayed / seasonMatches) + 1 : 1;

      // Escalation by loose season bands
      if (seasonIndex >= 5) {
        n.phase = 2;
      } else if (seasonIndex >= 3) {
        n.phase = 1;
      } else {
        n.phase = 0;
      }

      // 1) Variable per-match financial line item (narrative-only, random, sometimes heavy)
      const varianceRoll = Math.random();
      let revenueMultiplier;
      if (varianceRoll < 0.6) {
        // Small to medium cost most of the time (40–100% of base)
        revenueMultiplier = 0.4 + Math.random() * 0.6;
      } else if (varianceRoll < 0.9) {
        // Noticeable cost sometimes (100–250% of base)
        revenueMultiplier = 1.0 + Math.random() * 1.5;
      } else {
        // Occasionally very high cost (300–600% of base)
        revenueMultiplier = 3.0 + Math.random() * 3.0;
      }
      const revenueDelta = Math.round(WOMENS_TEAM_REVENUE_BASE * revenueMultiplier);

      // Always apply the financial effect, and itemise it in the matchday books / Finances
      const cashBefore = S.club_cash || 0;
      if (typeof window.addMoneyClub === 'function') {
        window.addMoneyClub(revenueDelta);
      } else {
        const current = (S.club_cash || 0) + revenueDelta;
        S.club_cash = current < 0 ? 0 : current;
      }
      if (typeof window.finNote === 'function') window.finNote("Women's team", (S.club_cash || 0) - cashBefore);

      const tooltipOptions = [
        "You are promised they will start making money soon",
        "They will start making money once sexism is over",
        "Such wonderful and inspiring women",
        "Mmmmm"
      ];
      const tt = tooltipOptions[Math.floor(Math.random() * tooltipOptions.length)];

      // Revenue message: a bit less spammy – only some matches log, with a soft cooldown
      n.revenueCooldown = (n.revenueCooldown || 0) - 1;
      if (n.revenueCooldown <= 0 && Math.random() < 0.6) {
        const absVal = Math.abs(revenueDelta).toLocaleString('en-GB');
        if (typeof window.log === 'function') {
          log(`[Women's Team] Revenue from ${getClubName()} Women's Team: -£${absVal} (${tt})`);
        } else {
        }
        // Wait a couple of matches before we’re allowed to show another revenue line
        n.revenueCooldown = 2 + Math.floor(Math.random() * 3); // 2–4 matches
      }

      // 2) Rare attendance flavour logs – pure satire, no mechanics (slightly rarer)
      n.attendanceCooldown = (n.attendanceCooldown || 0) - 1;
      if (n.attendanceCooldown <= 0 && Math.random() < 0.5) {
        const clubName = getClubName();
        const jokes = [
          `${clubName} Women set new all-time attendance record: 12.`,
          `${clubName} Women have increased attendance by 300%! 9 people were watching!`,
          "One supporter reportedly brought a friend.",
          "Record-breaking afternoon as someone’s dog counts as an extra attendee."
        ];
        const j = jokes[Math.floor(Math.random() * jokes.length)];
        if (typeof window.log === 'function') {
          log(`[Women’s Team] ${j}`);
        } else {
        }
        n.attendanceCooldown = 6 + Math.floor(Math.random() * 5); // wait more matches
      }

      // 3) Incoming text cadence (30–50% of matches, no stacking)
      if (!S.contacts || !S.contacts.womens_manager) return;
      if (n.activeThread) return; // do not stack conversations
      if (n.lastMessageMatch === matchesPlayed) return;

      // Guarantee at least one early text after a few matches if none have fired yet
      if ((n.matchesSeen || 0) >= 3 && (typeof n.lastMessageMatch !== 'number' || n.lastMessageMatch < 0)) {
        const thread = createWomensManagerThread(n.phase, ctx && ctx.gf, ctx && ctx.ga);
        if (thread) {
          queueIncomingText('womens_manager', thread.incoming, 'friendly');
          n.activeThread = {
            kind: thread.kind,
            replies: thread.replies
          };
          n.lastMessageMatch = matchesPlayed;
        }
        return;
      }

      const freqRoll = Math.random();
      // Roughly 30–40% of matches get a women’s manager text
      if (freqRoll > 0.4) {
        return;
      }

      const thread = createWomensManagerThread(n.phase, ctx && ctx.gf, ctx && ctx.ga);
      if (!thread) return;

      // Queue the manager’s opening text
      queueIncomingText('womens_manager', thread.incoming, 'friendly');

      // Track active thread for UI replies
      n.activeThread = {
        kind: thread.kind,
        replies: thread.replies
      };
      n.lastMessageMatch = matchesPlayed;
    } catch (e) {
      console.error('[WomenNarrative] Tick failure:', e);
    }
  };

  // Send quick text
  async function sendQuickText(contactId, category) {
    if (!S.contacts || !S.contacts[contactId]) return;
    const contact = S.contacts[contactId];
    
    // Check per-phase texting limit (5 texts per person per phase)
    if (!contact.textsThisPhase) contact.textsThisPhase = 0;
    if (contact.textsThisPhase >= 5) {
      log('📱 You\'ve reached the limit of 5 texts per person per phase. Wait for the next phase.');
      return;
    }
    
    let text = PHONE_QUICK_TEXTS[contactId] && PHONE_QUICK_TEXTS[contactId][category];
    if (!text) return;
    
    // Replace text with actual image for inappropriate_picture category
    if (category === 'inappropriate_picture' && ATTACHMENTS && ATTACHMENTS.inappropriate && ATTACHMENTS.inappropriate.length > 0) {
      const inappropriate = ATTACHMENTS.inappropriate[Math.floor(Math.random() * ATTACHMENTS.inappropriate.length)];
      text = inappropriate; // Use the HTML image tag directly
    }
    
    await sendText(contactId, text, category);
  }

  // Open text builder (3-part)
  async function openTextBuilder(contactId) {
    if (!S.contacts || !S.contacts[contactId]) return;
    const contact = S.contacts[contactId];
    
    // Check per-phase texting limit (5 texts per person per phase)
    if (!contact.textsThisPhase) contact.textsThisPhase = 0;
    if (contact.textsThisPhase >= 5) {
      log('📱 You\'ve reached the limit of 5 texts per person per phase. Wait for the next phase.');
      return;
    }
    
    // Special handling for secretary - use SECRETARY_QUOTES
    if (contactId === 'secretary' && typeof SECRETARY_QUOTES !== 'undefined') {
      const categoryOptions = [
        {key: 'professional', label: 'Professional'},
        {key: 'social', label: 'Social'},
        {key: 'football', label: 'Football'},
        {key: 'ellipses', label: 'Ellipses (...)'},
        {key: 'flirtatious', label: 'Flirtatious'},
        {key: 'erotic', label: 'Erotic'}
      ];
      
      const setupCategory = await chooseInPhone(
        categoryOptions.map(cat => ({key: cat.key, label: `[PART 1] ${cat.label}`})),
        '📱 PART 1: Choose your setup category:'
      );
      
      const pivotCategory = await chooseInPhone(
        categoryOptions.map(cat => ({key: cat.key, label: `[PART 2] ${cat.label}`})),
        '📱 PART 2: Choose your pivot category:'
      );
      
      const signoffCategory = await chooseInPhone(
        categoryOptions.map(cat => ({key: cat.key, label: `[PART 3] ${cat.label}`})),
        '📱 PART 3: Choose your signoff category:'
      );
      
      const setupQuotes = SECRETARY_QUOTES[setupCategory];
      const pivotQuotes = SECRETARY_QUOTES[pivotCategory];
      const signoffQuotes = SECRETARY_QUOTES[signoffCategory];
      
      if (!setupQuotes || !pivotQuotes || !signoffQuotes) {
        log('📱 Invalid quote combination.');
        return;
      }
      
      const opening = setupQuotes.setups[Math.floor(Math.random() * setupQuotes.setups.length)];
      const middle = pivotQuotes.pivots[Math.floor(Math.random() * pivotQuotes.pivots.length)];
      const closing = signoffQuotes.signoffs[Math.floor(Math.random() * signoffQuotes.signoffs.length)];
      
      const message = `${opening} ${middle} ${closing}`;
      
      // Choose attachment
      const attachment = await chooseInPhone([
        {key: 'none', label: 'No attachment'},
        {key: 'emoji', label: 'Add emoji'},
        {key: 'meme', label: 'Add meme'},
        {key: 'cute', label: 'Add cute animal picture'},
        {key: 'inappropriate', label: 'Add inappropriate picture'}
      ], 'Add attachment?');
      
      let attachmentText = '';
      if (attachment !== 'none' && typeof selectAttachment === 'function') {
        attachmentText = await selectAttachment(attachment, setupCategory);
      }
      
      const fullMessage = message + (attachmentText ? ` ${attachmentText}` : '');
      
      // Show user's message in phone popup
      if (phoneMessagesContainer) {
        addMessageToPhonePopup(fullMessage, true, 200);
        showTypingIndicator();
      }
      
      // Process secretary response with arrest mechanic
      if (typeof processSecretaryResponse === 'function') {
        await processSecretaryResponse(setupCategory, attachment, fullMessage);
      } else {
        // Fallback to standard sendText if processSecretaryResponse doesn't exist
        const categoryMap = {
          'professional': 'professional',
          'social': 'friendly',
          'football': 'professional',
          'ellipses': 'friendly',
          'flirtatious': 'flirtatious',
          'erotic': 'erotic'
        };
        const effectCategory = categoryMap[setupCategory] || 'friendly';
        await sendText(contactId, fullMessage, effectCategory);
      }
      
      // Update session and thread state (if exists)
      if (typeof S !== 'undefined') {
        S.secSessionMessageCount = (S.secSessionMessageCount || 0) + 1;
        S.secThreadStep = (S.secThreadStep || 0) + 1;
        
        // Check if session is complete (max 6 messages sent total)
        if (S.secSessionMessageCount >= 6) {
          log(`📱 Session complete. You've reached the 6-message limit.`);
          if (S.secThreadActive !== undefined) S.secThreadActive = false;
          if (S.secThreadStep !== undefined) S.secThreadStep = 0;
          if (S.secBoundaryStrikesThread !== undefined) S.secBoundaryStrikesThread = 0;
        } else if (S.secThreadStep >= 2) {
          // Thread complete but session continues
          log(`📱 Thread complete. Starting new thread.`);
          if (S.secThreadActive !== undefined) S.secThreadActive = false;
          if (S.secThreadStep !== undefined) S.secThreadStep = 0;
          if (S.secBoundaryStrikesThread !== undefined) S.secBoundaryStrikesThread = 0;
        }
      }
      
      return;
    }
    
    // Standard handling for other contacts - use PHONE_QUOTES
    if (!PHONE_QUOTES[contactId]) {
      log('📱 No quotes available for this contact.');
      return;
    }
    
    const categories = ['friendly', 'professional', 'malicious', 'flirtatious', 'erotic'];
    const categoryLabels = {friendly: 'Friendly', professional: 'Professional', malicious: 'Malicious', flirtatious: 'Flirtatious', erotic: 'Erotic', inappropriate_picture: 'Inappropriate Picture'};
    
    // Part 1: Opening category
    const part1Opts = categories.map(cat => ({
      key: cat,
      label: `[PART 1] ${categoryLabels[cat]}`
    }));
    const part1Cat = await chooseInPhone(part1Opts, '📱 PART 1: Choose opening category');
    
    // Part 2: Middle category
    const part2Opts = categories.map(cat => ({
      key: cat,
      label: `[PART 2] ${categoryLabels[cat]}`
    }));
    const part2Cat = await chooseInPhone(part2Opts, '📱 PART 2: Choose middle category');
    
    // Part 3: Closing category
    const part3Opts = categories.map(cat => ({
      key: cat,
      label: `[PART 3] ${categoryLabels[cat]}`
    }));
    const part3Cat = await chooseInPhone(part3Opts, '📱 PART 3: Choose closing category');
    
    // Build message
    const quotes1 = PHONE_QUOTES[contactId][part1Cat];
    const quotes2 = PHONE_QUOTES[contactId][part2Cat];
    const quotes3 = PHONE_QUOTES[contactId][part3Cat];
    
    if (!quotes1 || !quotes2 || !quotes3) {
      log('📱 Invalid quote combination.');
      return;
    }
    
    const opening = quotes1.openings[Math.floor(Math.random() * quotes1.openings.length)];
    const middle = quotes2.middles[Math.floor(Math.random() * quotes2.middles.length)];
    const closing = quotes3.closings[Math.floor(Math.random() * quotes3.closings.length)];
    
    const fullMessage = `${opening} ${middle} ${closing}`;
    
    // Show user's message in phone popup first (ensures it displays even if sendText has issues)
    if (phoneMessagesContainer) {
      addMessageToPhonePopup(fullMessage, true, 200);
    }
    
    // Use primary category (part 1) for effects
    // Pass skipUserMessageDisplay=true since we already displayed it above
    await sendText(contactId, fullMessage, part1Cat, true);
  }

  // Parse category from free text input
  function parseCategory(text) {
    const lower = text.toLowerCase();
    if (lower.match(/\b(hot|sexy|beautiful|stunning|gorgeous|attractive)\b/)) return 'flirtatious';
    if (lower.match(/\b(fuck|nude|naked|bed|sex|come over|touch|taste)\b/)) return 'erotic';
    if (lower.match(/\b(fire|fired|screw up|fix|else|threat|warn)\b/)) return 'malicious';
    if (lower.match(/\b(work|meeting|contract|budget|review|professional)\b/)) return 'professional';
    return 'friendly';
  }

  // Open free text input
  async function openFreeTextInput(contactId) {
    if (!S.contacts || !S.contacts[contactId]) return;
    const contact = S.contacts[contactId];
    
    // Check per-phase texting limit (5 texts per person per phase)
    if (!contact.textsThisPhase) contact.textsThisPhase = 0;
    if (contact.textsThisPhase >= 5) {
      log('📱 You\'ve reached the limit of 5 texts per person per phase. Wait for the next phase.');
      return;
    }
    
    const text = window.KUI ? await KUI.prompt('Enter your message:', '', { title: 'New message', variant: 'phone', ok: 'Send' }) : prompt('Enter your message:');
    if (!text || text.trim() === '') return;
    
    // Cheat code detection for Marco (case-insensitive)
    if (contactId === 'bookie_marco') {
      const textLower = text.toLowerCase();
      if (textLower.includes('krelmor')) {
        // Grant 200 lobby tokens
        if (typeof S.lobby_tokens !== "number") S.lobby_tokens = 0;
        S.lobby_tokens = (S.lobby_tokens|0) + 200;
        log(`💰 Cheat code activated! You've received 200 Lobby Tokens. Total: ${S.lobby_tokens|0}`);
        
        // Show in phone popup
        if (phoneMessagesContainer) {
          addMessageToPhonePopup(text.trim(), true, 0);
          showTypingIndicator();
          await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
          hideTypingIndicator();
          addMessageToPhonePopup('Code accepted. Tokens added.', false, 200);
        }
        
        // Update power network display if it exists
        const tokensEl = document.getElementById('powerLobbyTokens');
        if (tokensEl) tokensEl.textContent = (S.lobby_tokens|0).toLocaleString('en-GB');
        
        return;
      } else if (textLower.includes('crenston')) {
        // Grant 1000 lobby tokens
        if (typeof S.lobby_tokens !== "number") S.lobby_tokens = 0;
        S.lobby_tokens = (S.lobby_tokens|0) + 1000;
        log(`💰 Cheat code activated! You've received 1000 Lobby Tokens. Total: ${S.lobby_tokens|0}`);
        
        // Show in phone popup
        if (phoneMessagesContainer) {
          addMessageToPhonePopup(text.trim(), true, 0);
          showTypingIndicator();
          await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
          hideTypingIndicator();
          addMessageToPhonePopup('Code accepted. Tokens added.', false, 1000);
        }
        
        // Update power network display if it exists
        const tokensEl2 = document.getElementById('powerLobbyTokens');
        if (tokensEl2) tokensEl2.textContent = (S.lobby_tokens|0).toLocaleString('en-GB');
        
        return;
      } else if (textLower.includes('melgorth')) {
        // Transport to end of season with all games won
        const currentMatches = S.matches_played || 0;
        const totalMatches = S.season_matches || 16;
        const remainingMatches = Math.max(0, totalMatches - currentMatches);
        
        // Show in phone popup
        if (phoneMessagesContainer) {
          addMessageToPhonePopup(text.trim(), true, 0);
          showTypingIndicator();
          await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
          hideTypingIndicator();
          addMessageToPhonePopup('Code accepted. Transporting to end of season...', false, 200);
        }
        
        // Update match statistics - set all remaining matches as wins
        if (remainingMatches > 0) {
          const clubName = S.club_name || "Southampton FC";
          const opponents = S.opponents || [];
          
          // Initialize table if needed
          if (!S.table) {
            if (typeof ensureLeagueTableInit === 'function') {
              ensureLeagueTableInit();
            } else {
              S.table = {};
            }
          }
          
          // For each remaining match, record a win
          for (let i = currentMatches; i < totalMatches && i < opponents.length; i++) {
            const oppName = opponents[i] || `Opponent ${i + 1}`;
            const ourGoals = 2 + Math.floor(Math.random() * 2); // 2-3 goals
            const oppGoals = 0; // Clean sheet wins
            
            // Update league table
            if (typeof applyResultToTable === 'function') {
              applyResultToTable(clubName, oppName, ourGoals, oppGoals);
            } else {
              // Fallback manual table update
              if (!S.table[clubName]) S.table[clubName] = {P:0,W:0,D:0,L:0,GF:0,GA:0,PTS:0};
              if (!S.table[oppName]) S.table[oppName] = {P:0,W:0,D:0,L:0,GF:0,GA:0,PTS:0};
              S.table[clubName].P++;
              S.table[clubName].W++;
              S.table[clubName].PTS += 3;
              S.table[clubName].GF += ourGoals;
              S.table[clubName].GA += oppGoals;
              S.table[oppName].P++;
              S.table[oppName].L++;
              S.table[oppName].GF += oppGoals;
              S.table[oppName].GA += ourGoals;
            }
          }
          
          // Season statistics come from the table rows written above
          S.matches_played = totalMatches;
          syncClubRecordFromTable();
        } else {
          // Already at end of season, just ensure matches_played is set
          S.matches_played = totalMatches;
        }
        
        // Save state first
        saveGame();
        
        // Close phone popup
        if (phoneMessagesContainer) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          closePhoneTextPopup();
        }
        
        // Log the cheat activation
        log(`🎮 Cheat code activated! All remaining games set as wins.`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        log(`📊 Season Summary: P${S.matches_played} W${S.wins} D${S.draws || 0} L${S.losses || 0}  Pts:${S.points}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        log(`⏭️ Continue/Advance to proceed directly to the end of season presentation!`);
        
        // Don't call end of season functions directly - they use choose() which doesn't work in phone handler context
        // The game loop will check matches_played >= season_matches on the next iteration
        // and automatically proceed to showEndOfSeasonPresentation() and endOfSeason()
        // This avoids the freeze issue
        
        return;
      } else if (textLower.includes('kreplin')) {
        // Advance to World Cup tournament
        const currentSeason = S.season || 1;
        
        // Initialize fiveSeasonArc if needed
        if (!S.fiveSeasonArc) {
          S.fiveSeasonArc = {plTitles:[], clEntries:[], clWins:[], worldCupInvited:[], worldCupResults:[]};
        }
        
        // Show in phone popup
        if (phoneMessagesContainer) {
          addMessageToPhonePopup(text.trim(), true, 0);
          showTypingIndicator();
          await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
          hideTypingIndicator();
          addMessageToPhonePopup('Code accepted. Advancing to World Cup...', false, 200);
        }
        
        // Close phone popup
        if (phoneMessagesContainer) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          closePhoneTextPopup();
        }
        
        // Log the cheat activation
        log(`🎮 Cheat code activated! Advancing to World Cup tournament.`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Start World Cup tournament
        if (typeof playWorldCupTournament === 'function') {
          await playWorldCupTournament(currentSeason);
        } else {
          // Fallback: manually trigger World Cup
          S.worldCupActive = true;
          log(`🌍 World Cup tournament started!`);
        }
        
        // After World Cup completes, ensure game continues with league play
        // Reset competition context back to league
        if (typeof setCompetitionContext === 'function') {
          setCompetitionContext('league');
        } else {
          S.competition = 'league';
        }
        
        // Ensure World Cup state is fully cleared
        S.worldCupActive = false;
        S.worldCupGroup = null;
        S.worldCupGroupMatches = [];
        S.worldCupGroupStandings = {};
        S.worldCupKnockoutRound = null;
        S.worldCupBracket = {};
        
        // CRITICAL: Clear matchContext to prevent World Cup opponents contaminating league
        S.matchContext = null;
        
        // CRITICAL: Restore currentOpponent function to prevent World Cup opponents contaminating league matches
        restoreCurrentOpponent();
        
        // Mark World Cup as completed for this season
        S.worldCupCompletedForSeason = true;
        
        // Check if season is still ongoing
        if (S.matches_played < (S.season_matches || 16) && !S.game_over) {
          log(`⚽ Returning to Premier League action...`);
          // Ensure season schedule is set up - this is critical
          await ensureSeasonSchedule();
          ensureSeasonScheduleAndTable();
          
          // Ensure opponents array is valid and matches_played is in bounds
          if (!S.opponents || !Array.isArray(S.opponents) || S.opponents.length === 0) {
            log(`⚠️ Error: Opponents array not initialized. Reinitializing...`);
            await ensureSeasonSchedule();
          }
          
          if (S.matches_played >= (S.opponents?.length || 16)) {
            log(`⚠️ Warning: matches_played (${S.matches_played}) is out of bounds. Resetting to 0.`);
            S.matches_played = 0;
          }
          
          // Ensure lineup is initialized
          if (!S.lineup || !Array.isArray(S.lineup)) {
            S.lineup = [];
          }
          
          // Save state before continuing
          saveGame();
          
          // Continue to main game loop
          // Use a small delay to ensure UI is ready and avoid nested async issues
          await new Promise(resolve => setTimeout(resolve, 500));
          
          try {
            // Try multiple ways to access mainGameLoop
            const gameLoop = typeof mainGameLoop === 'function' ? mainGameLoop : 
                            (typeof window.mainGameLoop === 'function' ? window.mainGameLoop : null);
            
            if (gameLoop) {
              await gameLoop();
            } else {
              log(`⚠️ Error: mainGameLoop function not found. Please refresh the game.`);
              console.error("mainGameLoop not found. Available functions:", Object.keys(window).filter(k => k.includes('Game') || k.includes('Loop')));
            }
          } catch (e) {
            console.error("Error in mainGameLoop after World Cup:", e);
            log(`⚠️ Error continuing game: ${e.message || e}. Please check the console for details.`);
            // Try to save state even on error
            saveGame();
          }
        } else {
          log(`Season complete or game over. World Cup participation recorded.`);
        }
        
        return;
      } else if (textLower.includes('crongus3')) {
        // Advance to Season 3
        const currentSeason = S.season || 1;
        
        // Show in phone popup
        if (phoneMessagesContainer) {
          addMessageToPhonePopup(text.trim(), true, 0);
          showTypingIndicator();
          await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
          hideTypingIndicator();
          addMessageToPhonePopup('Code accepted. Advancing to Season 3...', false, 200);
        }
        
        // Close phone popup
        if (phoneMessagesContainer) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          closePhoneTextPopup();
        }
        
        // Log the cheat activation
        log(`🎮 Cheat code activated! Advancing to Season 3.`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Set season to 3
        S.season = 3;
        
        // Reset season statistics
        S.matches_played = 0;
        S.wins = 0;
        S.draws = 0;
        S.losses = 0;
        S.points = 0;
        S.points_deducted = 0;
        S.manager_fires = 0;
        S.fired_last_game = false;
        // Season 4 & 5 have 9 games, others have 16 - will be set correctly by ensureSeasonSchedule()
        S.season_matches = (S.season === 4 || S.season === 5) ? 9 : 16;
        
        // Reset CL active state
        S.clActive = false;
        S.clStage = 'group';
        S.clGroupMatches = [];
        S.clGroupStandings = {};
        S.clKnockoutRound = null;
        S.clKnockoutBracket = {};
        S.clScheduledMatches = [];
        S.clNextMatchIndex = 0;
        
        // Reset World Cup completion flag
        S.worldCupCompletedForSeason = false;
        
        // Reset some risks but keep some progression
        S.legal_risk = Math.max(0, (S.legal_risk||0) - 10);
        S.compliance_risk = Math.max(0, (S.compliance_risk||0) - 10);
        S.police_risk = Math.max(0, (S.police_risk||0) - 5);
        
        // Clear prison status
        S.prison = false;
        if(S.suspensions) {
          S.suspensions.prison_games = 0;
        }
        
        // Reset table for new season
        S.table = {};
        S.table_order = [];
        S.leagueTableShownInPresentation = false;
        
        // Reset opponents schedule for new season
        S.opponents = [];
        
        // CRITICAL: Restore currentOpponent function to prevent World Cup opponents contaminating Season 3
        restoreCurrentOpponent();
        
        if (typeof ensureSeasonSchedule === 'function') {
          ensureSeasonSchedule();
        }
        
        // Ensure league table is initialized
        if (typeof ensureLeagueTableInit === 'function') {
          ensureLeagueTableInit();
        }
        if (typeof renderLeagueTablePanel === 'function') {
          renderLeagueTablePanel();
        }
        
        // Reset women's team manager demands counter for new season
        if (S.womens_team && !S.womens_team.liquidated) {
          S.womens_team.manager_demands_this_season = 0;
          S.womens_team.last_demand_match = -1;
        }
        
        // Initialize season 3 flags (this will be checked on next game loop, but initialize early to prevent season 2 content)
        if (!S.season3) {
          S.season3 = {
            son_hired_as_scout: false,
            son_relationship_with_secretary: false,
            son_framed_for_murder: false,
            son_raising_child_not_his: false,
            gaz_signed: false,
            gaz_sent_to_do_message: false,
            gaz_murdered_family: false,
            gaz_reported: false,
            gaz_killed_by_player: false,
            gaz_rating: 0,
            gaz_suicide_threatened: false,
            gaz_first_team_forced: false,
            gaz_denied_first_team: false,
            gaz_continues_theft: false,
            secretary_affair_active: false,
            secretary_poly_reveal: false,
            secretary_framed: false,
            secretary_relationship_opened_to_player: false,
            captain_confessed: false,
            captain_seduced: false,
            captain_seduction_via_nightclub: false,
            captain_outed_to_press: false,
            krunchem_address_known: false,
            krunchem_family_murdered: false,
            shafty_rod_johnson_fratton_arrest_shown: false,
            womens_team_exists: false,
            womens_manager_complaint: false,
            womens_team_liquidated_due_to_gaz: false,
            womens_manager_placated_with_lie: false,
            act1_complete: false,
            act2_complete: false,
            act3_complete: false,
            act4_complete: false,
            act5_complete: false,
            season_end_cinematic_shown: false,
            player_coma_between_seasons: false
          };
          // Check if women's team exists at start of Season 3
          if (S.womens_team && !S.womens_team.liquidated) {
            S.season3.womens_team_exists = true;
          }
        }
        
        // Save state
        saveGame();
        
        // Update HUD
        if (typeof updateHUD === 'function') {
          updateHUD();
        }
        
        log(`📅 Season 3 started!`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        log(`⏭️ Continue/Advance to proceed with Season 3!`);
        
        return;
      } else if (textLower.includes('crongus4')) {
        // Advance to Season 4
        const currentSeason = S.season || 1;
        
        // Show in phone popup
        if (phoneMessagesContainer) {
          addMessageToPhonePopup(text.trim(), true, 0);
          showTypingIndicator();
          await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
          hideTypingIndicator();
          addMessageToPhonePopup('Code accepted. Advancing to Season 4...', false, 200);
        }
        
        // Close phone popup
        if (phoneMessagesContainer) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          closePhoneTextPopup();
        }
        
        // Log the cheat activation
        log(`🎮 Cheat code activated! Advancing to Season 4.`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Set season to 4
        S.season = 4;
        
        // Reset season statistics
        S.matches_played = 0;
        S.wins = 0;
        S.draws = 0;
        S.losses = 0;
        S.points = 0;
        S.points_deducted = 0;
        S.manager_fires = 0;
        S.fired_last_game = false;
        // Don't set season_matches here - let ensureSeasonSchedule calculate it (9 for season 4)
        
        // Reset CL active state
        S.clActive = false;
        S.clStage = 'group';
        S.clGroupMatches = [];
        S.clGroupStandings = {};
        S.clKnockoutRound = null;
        S.clKnockoutBracket = {};
        S.clScheduledMatches = [];
        S.clNextMatchIndex = 0;
        
        // Reset World Cup completion flag
        S.worldCupCompletedForSeason = false;
        
        // Reset some risks but keep some progression
        S.legal_risk = Math.max(0, (S.legal_risk||0) - 10);
        S.compliance_risk = Math.max(0, (S.compliance_risk||0) - 10);
        S.police_risk = Math.max(0, (S.police_risk||0) - 5);
        
        // Clear prison status
        S.prison = false;
        if(S.suspensions) {
          S.suspensions.prison_games = 0;
        }
        
        // Initialize season 4 flags BEFORE resetting table (need table to determine liquidated teams)
        if (!S.season4) S.season4 = {};
        S.season4.initialized = true;
        S.season4.league_renamed = true;
        S.season4.clubs_taken_over = {};
        S.season4.clubs_taken_over_count = 0;
        S.season4.takeover_stage = 'EARLY';
        S.season4.van_onslaught_visit_complete = false;
        S.season4.van_onslaught_visit_triggered = false;
        S.season4.club_sale_refused = false;
        S.season4.points_deducted_for_refusal = false;
        S.season4.rod_johnson_appearances = 0;
        S.season4.rod_johnson_state_sanctioned = false;
        S.season4.personal_life_locked = true;
        S.season4.home_interaction_always_silent = true;
        S.season4.last_monthly_event = 0;
        S.season4.monthly_event_count = 0;
        S.season4.cocaine_price_doubled = false;
        S.season4.adultery_punishable = false;
        S.season4.season_end_complete = false;
        S.season4.television_appearance_shown = false;
        
        // Initialize liquidated teams list (6 lowest ranked teams, excluding Pompey and Southampton)
        // Do this BEFORE resetting table so we can use previous season's table
        if (!S.season4.liquidated_teams || !Array.isArray(S.season4.liquidated_teams)) {
          S.season4.liquidated_teams = [];
          
          // Get all teams from table, sort by points (lowest first)
          const allTeams = Object.keys(S.table || {});
          const teamRankings = allTeams
            .filter(team => team !== "Portsmouth" && team !== "Southampton FC" && team !== "Southampton")
            .map(team => ({
              name: team,
              points: (S.table[team]?.PTS || 0),
              goalDiff: (S.table[team]?.GD || 0)
            }))
            .sort((a, b) => {
              // Sort by points first (ascending), then goal difference (ascending)
              if (a.points !== b.points) return a.points - b.points;
              return a.goalDiff - b.goalDiff;
            });
          
          // Take the 5 lowest ranked teams
          const liquidatedTeams = teamRankings.slice(0, 5).map(t => t.name);
          S.season4.liquidated_teams = liquidatedTeams;
          
          // Mark these teams as destroyed/liquidated
          if (!S.destroyedTeams) S.destroyedTeams = [];
          liquidatedTeams.forEach(team => {
            if (!S.destroyedTeams.includes(team)) {
              S.destroyedTeams.push(team);
            }
          });
        }
        
        // Reset table for new season (after determining liquidated teams)
        S.table = {};
        S.table_order = [];
        S.leagueTableShownInPresentation = false;
        
        // Reset opponents schedule for new season
        S.opponents = [];
        if (typeof ensureSeasonSchedule === 'function') {
          ensureSeasonSchedule();
        }
        
        // Ensure league table is initialized
        if (typeof ensureLeagueTableInit === 'function') {
          ensureLeagueTableInit();
        }
        if (typeof renderLeagueTablePanel === 'function') {
          renderLeagueTablePanel();
        }
        
        // Reset women's team manager demands counter for new season
        if (S.womens_team && !S.womens_team.liquidated) {
          S.womens_team.manager_demands_this_season = 0;
          S.womens_team.last_demand_match = -1;
        }
        
        // Apply cocaine price doubling immediately
        if (!S.season4.cocaine_price_doubled) {
          S.season4.cocaine_price_doubled = true;
        }
        
        // Save state
        saveGame();
        
        // Update HUD
        if (typeof updateHUD === 'function') {
          updateHUD();
        }
        
        // Show television appearance immediately at season start
        if (!S.season4.television_appearance_shown && S.matches_played === 0) {
          S.season4.television_appearance_shown = true;
          
          // Create and show sinister modal for Van Onslaught announcement
          const existingModal = document.getElementById('sinister-van-onslaught-modal');
          if (existingModal) existingModal.remove();
          
          const modalOverlay = document.createElement('div');
          modalOverlay.id = 'sinister-van-onslaught-modal';
          modalOverlay.className = 'sinister-modal-overlay';
          
          const modal = document.createElement('div');
          modal.className = 'sinister-modal';
          
          const modalContent = document.createElement('div');
          modalContent.className = 'sinister-modal-content';
          modalContent.innerHTML = `<div class="sinister-title">━━━ TELEVISION BROADCAST ━━━</div>`;
          
          modal.appendChild(modalContent);
          modalOverlay.appendChild(modal);
          document.body.appendChild(modalOverlay);
          
          // Skip flag to bypass typewriter animation
          let skipAnimation = false;
          let messageIndex = 0; // Track which messages have been displayed
          
          // Function to append text to modal with typewriter effect
          const appendToModal = (text, delay = 0, useTypewriter = true) => {
            return new Promise(resolve => {
              if (skipAnimation) {
                // If skipping, display immediately without animation
                const p = document.createElement('p');
                if (text.trim() === '') {
                  p.innerHTML = '<br>';
                } else {
                  p.textContent = text;
                }
                modalContent.appendChild(p);
                modal.scrollTop = modal.scrollHeight;
                messageIndex++;
                resolve();
                return;
              }
              
              setTimeout(() => {
                const p = document.createElement('p');
                if (text.trim() === '') {
                  p.innerHTML = '<br>';
                  modalContent.appendChild(p);
                  modal.scrollTop = modal.scrollHeight;
                  messageIndex++;
                  resolve();
                } else if (useTypewriter && text.trim() !== '' && !text.includes('<strong>') && !text.includes('<em>') && !text.includes('<span>')) {
                  const span = document.createElement('span');
                  span.className = 'typewriter-line';
                  span.textContent = text;
                  p.appendChild(span);
                  modalContent.appendChild(p);
                  
                  const measureEl = document.createElement('span');
                  measureEl.style.visibility = 'hidden';
                  measureEl.style.position = 'absolute';
                  measureEl.style.whiteSpace = 'nowrap';
                  measureEl.style.font = window.getComputedStyle(span).font;
                  measureEl.textContent = text;
                  document.body.appendChild(measureEl);
                  const textWidth = measureEl.offsetWidth;
                  document.body.removeChild(measureEl);
                  
                  span.style.maxWidth = textWidth + 'px';
                  
                  setTimeout(() => {
                    span.classList.add('no-cursor');
                  }, 2600);
                  
                  setTimeout(() => {
                    modal.scrollTop = modal.scrollHeight;
                    messageIndex++;
                    resolve();
                  }, 2500);
                } else {
                  p.innerHTML = text;
                  modalContent.appendChild(p);
                  modal.scrollTop = modal.scrollHeight;
                  messageIndex++;
                  resolve();
                }
              }, delay);
            });
          };
          
          // Add close button
          const closeBtn = document.createElement('button');
          closeBtn.className = 'sinister-modal-close-btn';
          closeBtn.textContent = '✕ Close';
          closeBtn.style.display = 'none';
          closeBtn.onclick = () => {
            modalOverlay.style.animation = 'sinisterFadeIn 0.5s ease-out reverse';
            setTimeout(() => {
              modalOverlay.remove();
            }, 500);
          };
          
          // Add skip button
          const skipBtn = document.createElement('button');
          skipBtn.className = 'sinister-modal-close-btn';
          skipBtn.textContent = 'Skip';
          skipBtn.style.position = 'fixed';
          skipBtn.style.bottom = '20px';
          skipBtn.style.right = '20px';
          skipBtn.style.transform = 'none';
          skipBtn.style.background = 'rgba(139, 0, 0, 0.4)';
          skipBtn.style.border = '2px solid #8b0000';
          skipBtn.style.color = '#cc0000';
          skipBtn.style.padding = '12px 24px';
          skipBtn.style.fontSize = '14px';
          skipBtn.style.cursor = 'pointer';
          skipBtn.style.zIndex = '10001';
          
          // Store all messages for skip functionality
          const allMessages = [];
          const liquidatedTeams = S.season4.liquidated_teams || [];
          
          allMessages.push({ text: `Mohammed Van Onslaught appears on television.`, delay: 800 });
          allMessages.push({ text: `He stands before a grand podium, cameras flashing.`, delay: 2200 });
          allMessages.push({ text: ``, delay: 0 });
          allMessages.push({ text: `"I am pleased to announce," he says, his voice resonating across the nation,`, delay: 1800 });
          allMessages.push({ text: `"the coronation of the Muslim Premier League."`, delay: 2200 });
          allMessages.push({ text: ``, delay: 0 });
          allMessages.push({ text: `The crowd erupts. Or perhaps it's silence. The broadcast doesn't make it clear.`, delay: 2200 });
          allMessages.push({ text: ``, delay: 0 });
          
          if (liquidatedTeams.length > 0) {
            const teamsList = liquidatedTeams.join(', ');
            allMessages.push({ text: `"The following clubs have been liquidated," he continues,`, delay: 2200 });
            allMessages.push({ text: `"their stadiums converted into mosques: ${teamsList}."`, delay: 2200 });
          } else {
            allMessages.push({ text: `"Five clubs have been liquidated," he continues,`, delay: 2200 });
            allMessages.push({ text: `"their stadiums converted into mosques."`, delay: 2200 });
          }
          
          allMessages.push({ text: ``, delay: 0 });
          allMessages.push({ text: `He smiles.`, delay: 1500 });
          allMessages.push({ text: `"This is the will of the people. The will of the faithful."`, delay: 2200 });
          allMessages.push({ text: ``, delay: 0 });
          allMessages.push({ text: `The broadcast cuts to footage of empty stadiums.`, delay: 2200 });
          allMessages.push({ text: `Construction equipment. Minarets rising where goalposts once stood.`, delay: 2200 });
          allMessages.push({ text: ``, delay: 0 });
          allMessages.push({ text: `"The league continues," Van Onslaught announces, "with ten teams.`, delay: 2200 });
          allMessages.push({ text: `But the game remains. The game always remains."`, delay: 2200 });
          allMessages.push({ text: ``, delay: 0 });
          allMessages.push({ text: `The broadcast ends.`, delay: 2000 });
          allMessages.push({ text: ``, delay: 0 });
          
          skipBtn.onclick = async () => {
            skipAnimation = true;
            skipBtn.style.display = 'none';
            
            // Display all remaining messages immediately (starting from messageIndex)
            for (let i = messageIndex; i < allMessages.length; i++) {
              const msg = allMessages[i];
              const p = document.createElement('p');
              if (msg.text.trim() === '') {
                p.innerHTML = '<br>';
              } else {
                p.textContent = msg.text;
              }
              modalContent.appendChild(p);
            }
            modal.scrollTop = modal.scrollHeight;
            messageIndex = allMessages.length; // Mark all as displayed
            
            // Show close button
            closeBtn.style.display = 'block';
          };
          
          modalOverlay.appendChild(closeBtn);
          modalOverlay.appendChild(skipBtn);
          
          // Show announcement with typewriter effect
          (async () => {
            await new Promise(resolve => setTimeout(resolve, 500));
            for (const msg of allMessages) {
              await appendToModal(msg.text, msg.delay);
            }
            
            // Show close button
            closeBtn.style.display = 'block';
            skipBtn.style.display = 'none';
          })();
        }
        
        log(`📅 Season 4 started!`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        log(`⏭️ Continue/Advance to proceed with Season 4!`);
        
        return;
      } else if (textLower.includes('crongus5')) {
        // Advance to Season 5
        const currentSeason = S.season || 1;
        
        // Show in phone popup
        if (phoneMessagesContainer) {
          addMessageToPhonePopup(text.trim(), true, 0);
          showTypingIndicator();
          await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
          hideTypingIndicator();
          addMessageToPhonePopup('Code accepted. Advancing to Season 5...', false, 200);
        }
        
        // Close phone popup
        if (phoneMessagesContainer) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          closePhoneTextPopup();
        }
        
        // Log the cheat activation
        log(`🎮 Cheat code activated! Advancing to Season 5.`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Set season to 5
        S.season = 5;
        
        // Ensure season 4 flags are initialized (Season 5 continues from Season 4)
        if (!S.season4) S.season4 = {};
        if (!S.season4.initialized) {
          S.season4.initialized = true;
          S.season4.league_renamed = true;
          S.season4.clubs_taken_over = {};
          S.season4.clubs_taken_over_count = 0;
          S.season4.takeover_stage = 'EARLY';
          S.season4.van_onslaught_visit_complete = false;
          S.season4.van_onslaught_visit_triggered = false;
          S.season4.club_sale_refused = false;
          S.season4.points_deducted_for_refusal = false;
          S.season4.rod_johnson_appearances = 0;
          S.season4.rod_johnson_state_sanctioned = false;
          S.season4.personal_life_locked = true;
          S.season4.home_interaction_always_silent = true;
          S.season4.last_monthly_event = 0;
          S.season4.monthly_event_count = 0;
          S.season4.cocaine_price_doubled = false;
          S.season4.adultery_punishable = false;
          S.season4.season_end_complete = false;
        }
        
        // Initialize liquidated teams list if missing (needed for season 5)
        // Season 5 has fewer teams - all foreign except Southampton and Portsmouth
        if (!S.season4.liquidated_teams || !Array.isArray(S.season4.liquidated_teams)) {
          S.season4.liquidated_teams = [];
          
          // If we have a table from a previous season, use it to determine liquidated teams
          // Otherwise, liquidate all teams except Portsmouth and Southampton
          const allTeams = Object.keys(S.table || {});
          if (allTeams.length > 0) {
            const teamRankings = allTeams
              .filter(team => team !== "Portsmouth" && team !== "Southampton FC" && team !== "Southampton")
              .map(team => ({
                name: team,
                points: (S.table[team]?.PTS || 0),
                goalDiff: (S.table[team]?.GD || 0)
              }))
              .sort((a, b) => {
                if (a.points !== b.points) return a.points - b.points;
                return a.goalDiff - b.goalDiff;
              });
            
            // Take the 5-6 lowest ranked teams to liquidate
            const liquidatedTeams = teamRankings.slice(0, Math.min(6, teamRankings.length)).map(t => t.name);
            S.season4.liquidated_teams = liquidatedTeams;
          } else {
            // No previous table - liquidate all teams except Portsmouth and Southampton
            const ALL_TEAMS_LIST = ["Arsenal","Aston Villa","Bournemouth","Brentford","Brighton",
              "Chelsea","Crystal Palace","Everton","Fulham","Liverpool",
              "Man City","Man United","Newcastle","Tottenham","Wolves","Portsmouth"];
            S.season4.liquidated_teams = ALL_TEAMS_LIST.filter(t => t !== "Portsmouth" && t !== "Southampton FC");
          }
          
          // Mark these teams as destroyed/liquidated
          if (!S.destroyedTeams) S.destroyedTeams = [];
          S.season4.liquidated_teams.forEach(team => {
            if (!S.destroyedTeams.includes(team)) {
              S.destroyedTeams.push(team);
            }
          });
        }
        
        // Reset season statistics
        S.matches_played = 0;
        S.wins = 0;
        S.draws = 0;
        S.losses = 0;
        S.points = 0;
        S.points_deducted = 0;
        S.manager_fires = 0;
        S.fired_last_game = false;
        S.season_matches = 9; // Season 5 has 9 opponents (10 teams total including Southampton)
        
        // Reset CL active state
        S.clActive = false;
        S.clStage = 'group';
        S.clGroupMatches = [];
        S.clGroupStandings = {};
        S.clKnockoutRound = null;
        S.clKnockoutBracket = {};
        S.clScheduledMatches = [];
        S.clNextMatchIndex = 0;
        
        // Reset World Cup completion flag
        S.worldCupCompletedForSeason = false;
        
        // Reset some risks but keep some progression
        S.legal_risk = Math.max(0, (S.legal_risk||0) - 10);
        S.compliance_risk = Math.max(0, (S.compliance_risk||0) - 10);
        S.police_risk = Math.max(0, (S.police_risk||0) - 5);
        
        // Clear prison status
        S.prison = false;
        if(S.suspensions) {
          S.suspensions.prison_games = 0;
        }
        
        // Reset table for new season (after determining liquidated teams)
        S.table = {};
        S.table_order = [];
        S.leagueTableShownInPresentation = false;
        
        // Reset opponents schedule for new season
        S.opponents = [];
        if (typeof ensureSeasonSchedule === 'function') {
          ensureSeasonSchedule();
        }
        
        // Ensure league table is initialized
        if (typeof ensureLeagueTableInit === 'function') {
          ensureLeagueTableInit();
        }
        if (typeof renderLeagueTablePanel === 'function') {
          renderLeagueTablePanel();
        }
        
        // Reset women's team manager demands counter for new season
        if (S.womens_team && !S.womens_team.liquidated) {
          S.womens_team.manager_demands_this_season = 0;
          S.womens_team.last_demand_match = -1;
        }
        
        // Initialize Season 5 if needed
        if (!S.season5) S.season5 = {};
        S.season5.initialized = true;
        S.season5.moral_audit_count = 0;
        S.season5.last_audit_match = -1;
        S.season5.injure_best_players_first_match = true;
        S.season5.first_match_special_event = true;
        // Initialize kidnapping sequence flag to false (will be set to true after it plays)
        S.season5.kidnapping_sequence_shown = false;
        if (S.season4) {
          S.season5.personal_life_locked = S.season4.personal_life_locked || true;
          S.season5.home_interaction_always_silent = S.season4.home_interaction_always_silent || true;
        }
        // Initialize Season 5 survival economy
        if (!S.season5.survival) {
          S.season5.survival = {
            base_bribe_amount: 150000,
            current_bribe_amount: 150000,
            bribe_multiplier: 1.15,
            matches_survived: 0,
            strategy_unlocked: {
              bribe: true,
              doping: false,
              intimidation: false,
            },
            doping_active: false,
            intimidation_used: false,
            background_deterioration: 0,
            squad_murdered: false,
            audit_scrutiny: 0,
            lobby_tokens_spent: 0,
          };
        }
        
        // Run Season 5 opener to properly initialize the season
        if (typeof runSeason5Opener === 'function') {
          await runSeason5Opener();
        }
        
        // Save state
        saveGame();
        
        // Update HUD
        if (typeof updateHUD === 'function') {
          updateHUD();
        }
        
        log(`📅 Season 5 started!`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        log(`⏭️ Continue/Advance to proceed with Season 5!`);
        
        return;
      } else if (textLower.includes('crongus6')) {
        // Cheat code to go to Season 5 end of season presentation
        // Show in phone popup
        if (phoneMessagesContainer) {
          addMessageToPhonePopup(text.trim(), true, 0);
          showTypingIndicator();
          await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
          hideTypingIndicator();
          addMessageToPhonePopup('Code accepted. Transporting to Season 5 end of season presentation...', false, 200);
        }
        
        // Close phone popup
        if (phoneMessagesContainer) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          closePhoneTextPopup();
        }
        
        // Log the cheat activation
        log(`🎮 Cheat code activated! Transporting to Season 5 end of season presentation.`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Ensure we're in season 5
        if (S.season !== 5) {
          S.season = 5;
          // Initialize season 5 if needed
          if (!S.season5) S.season5 = {};
          S.season5.initialized = true;
        }
        
        // Ensure season is complete (set matches_played to season_matches to trigger end of season)
        S.matches_played = S.season_matches || 9;
        
        // Save state
        saveGame();
        
        // Call the season 5 end of season presentation
        if (typeof showEndOfSeasonPresentation === 'function') {
          await showEndOfSeasonPresentation();
        } else {
          log(`⚠️ Error: showEndOfSeasonPresentation function not found.`);
        }
        
        return;
      } else if (textLower.includes('crongus8')) {
        // Cheat code to advance to final confrontation with Delmor Krunchem (with 0 kreplin gems)
        // Show in phone popup
        if (phoneMessagesContainer) {
          addMessageToPhonePopup(text.trim(), true, 0);
          showTypingIndicator();
          await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
          hideTypingIndicator();
          addMessageToPhonePopup('Code accepted. Advancing to final confrontation...', false, 200);
        }
        
        // Close phone popup
        if (phoneMessagesContainer) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          closePhoneTextPopup();
        }
        
        // Log the cheat activation
        log(`🎮 Cheat code activated! Advancing to final confrontation with Delmor Krunchem.`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Ensure we're in season 5
        if (S.season !== 5) {
          S.season = 5;
        }
        
        // Initialize season 5 if needed
        if (!S.season5) S.season5 = {};
        S.season5.initialized = true;
        
        // Ensure ultima cup state is set up
        if (!S.ultimaCup) S.ultimaCup = {};
        S.ultimaCup.players_armed = true;
        S.power_briefcase_owned = true;
        
        // Set kreplin gems to 0
        S.kreplin_gems = 0;
        hudSet("hudKreplinGem", "0/4");
        log(`💎 Kreplin Gems set to 0.`);
        
        // Show the summary overlay that appears after the robot video
        const summaryOverlay = document.createElement('div');
        summaryOverlay.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.95);
          z-index: 30001;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          padding: 40px;
          box-sizing: border-box;
        `;
        
        const summaryContainer = document.createElement('div');
        summaryContainer.style.cssText = `
          max-width: 800px;
          width: 100%;
          background: linear-gradient(135deg, rgba(20, 20, 20, 0.95) 0%, rgba(40, 20, 20, 0.95) 100%);
          border: 4px solid #ff4444;
          border-radius: 20px;
          padding: 40px;
          box-shadow: 0 0 60px rgba(255, 68, 68, 0.6), inset 0 0 40px rgba(0, 0, 0, 0.5);
          color: #ffffff;
          font-family: 'Arial', sans-serif;
          text-align: center;
        `;
        
        summaryContainer.innerHTML = `
          <h1 style="font-size: 3rem; color: #ff4444; margin: 0 0 30px 0; text-shadow: 0 0 20px rgba(255, 68, 68, 0.8);">Holy shit!</h1>
          <div id="summary-text-container" style="font-size: 0.9rem; line-height: 1.8; margin-bottom: 30px; text-align: left;">
          </div>
        `;
        
        const textContainer = summaryContainer.querySelector('#summary-text-container');
        const paragraphs = [
          { text: 'The briefcase transformed into a combat robot armed with missiles and a flamethrower.', style: '' },
          { text: 'The robot incinerated the remaining Pompey players and the Saudis in attendance, and burned Mohammed Van Onslaught to cinder.', style: '' },
          { text: 'Very sadly, it also killed at least 248,000 of the attendees, and with it the Ultima Stadium.', style: 'color: #ffaa44;' },
          { text: 'You had no other choice. Their sacrifice will be remembered.', style: 'font-style: italic; color: #aaaaaa;' },
          { text: 'Very sadly, Delmor Krunchem destroyed the combat robot with a bazooka, and also escaped on a jetpack.', style: 'color: #ffaa44;' },
          { text: 'Krunchem has betrayed you, and has a kreplin gem. You\'re advancing on him and he appears to have some kind of force field around him, which is likely an \'Islamic spell\'.', style: '' },
          { text: 'He is armed with a bazooka, but it\'s time for the final confrontation.', style: 'margin-bottom: 30px;' }
        ];
        
        paragraphs.forEach((para, index) => {
          setTimeout(() => {
            const p = document.createElement('p');
            p.textContent = para.text;
            p.style.cssText = `margin-bottom: 20px; opacity: 0; transition: opacity 0.8s ease-in; ${para.style}`;
            textContainer.appendChild(p);
            // Trigger fade-in
            setTimeout(() => {
              p.style.opacity = '1';
            }, 10);
          }, index * 600);
        });
        
        const confrontButton = document.createElement('button');
        confrontButton.textContent = 'Confront Delmor Krunchem';
        confrontButton.style.cssText = `
          width: 100%;
          padding: 20px;
          font-size: 1.5rem;
          font-weight: bold;
          background: linear-gradient(135deg, #ff4444 0%, #cc0000 100%);
          color: white;
          border: 3px solid #ff6666;
          border-radius: 10px;
          cursor: pointer;
          box-shadow: 0 0 30px rgba(255, 68, 68, 0.8), inset 0 0 20px rgba(0, 0, 0, 0.3);
          transition: all 0.3s;
          text-transform: uppercase;
          letter-spacing: 2px;
        `;
        
        confrontButton.onmouseover = () => {
          confrontButton.style.background = 'linear-gradient(135deg, #ff6666 0%, #ff0000 100%)';
          confrontButton.style.transform = 'scale(1.05)';
          confrontButton.style.boxShadow = '0 0 40px rgba(255, 68, 68, 1), inset 0 0 20px rgba(0, 0, 0, 0.3)';
        };
        
        confrontButton.onmouseout = () => {
          confrontButton.style.background = 'linear-gradient(135deg, #ff4444 0%, #cc0000 100%)';
          confrontButton.style.transform = 'scale(1)';
          confrontButton.style.boxShadow = '0 0 30px rgba(255, 68, 68, 0.8), inset 0 0 20px rgba(0, 0, 0, 0.3)';
        };
        
        summaryContainer.appendChild(confrontButton);
        summaryOverlay.appendChild(summaryContainer);
        document.body.appendChild(summaryOverlay);
        
        // Wait for button click
        await new Promise((summaryResolve) => {
          confrontButton.onclick = () => {
            summaryOverlay.remove();
            // Start the boss battle mini-game
            if (typeof startKrunchemBossBattle === 'function') {
              startKrunchemBossBattle().then(() => {
                summaryResolve();
              });
            } else {
              log(`⚠️ Error: startKrunchemBossBattle function not found.`);
              summaryResolve();
            }
          };
        });
        
        return;
      } else if (textLower.includes('crongusdelmor')) {
        // Cheat code to advance to post-match of ultima cup final (after briefcase button and robot video)
        // Show in phone popup
        if (phoneMessagesContainer) {
          addMessageToPhonePopup(text.trim(), true, 0);
          showTypingIndicator();
          await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
          hideTypingIndicator();
          addMessageToPhonePopup('Code accepted. Advancing to post-match...', false, 200);
        }
        
        // Close phone popup
        if (phoneMessagesContainer) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          closePhoneTextPopup();
        }
        
        // Log the cheat activation
        log(`🎮 Cheat code activated! Advancing to Ultima Cup Final post-match (after robot video).`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Ensure we're in season 5 and have completed ultima cup
        if (S.season !== 5) {
          S.season = 5;
        }
        
        // Initialize season 5 if needed
        if (!S.season5) S.season5 = {};
        S.season5.initialized = true;
        
        // Ensure ultima cup state is set up
        if (!S.ultimaCup) S.ultimaCup = {};
        S.ultimaCup.players_armed = true;
        S.power_briefcase_owned = true;
        
        // Set up state as if briefcase button was pressed and robot video just played
        // (presuming the briefcase button was pressed and robot video was JUST played)
        
        // Add 3 kreplin gems one at a time, each with its own jingle and celebration
        for (let i = 0; i < 3; i++) {
          S.kreplin_gems = (S.kreplin_gems || 0) + 1;
          hudSet("hudKreplinGem", `${S.kreplin_gems}/4`);
          // Sync to playerStats for certificate
          if (!S.playerStats) S.playerStats = {};
          S.playerStats.kreplinGems = Math.max(S.playerStats.kreplinGems || 0, S.kreplin_gems || 0);
          await showKreplinGemCelebration();
        }
        log(`✨💎 Added 3 Kreplin Gems! Total: ${S.kreplin_gems}/4 💎✨`);
        
        // Show the summary overlay that appears after the robot video
        const summaryOverlay = document.createElement('div');
        summaryOverlay.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.95);
          z-index: 30001;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          padding: 40px;
          box-sizing: border-box;
        `;
        
        const summaryContainer = document.createElement('div');
        summaryContainer.style.cssText = `
          max-width: 800px;
          width: 100%;
          background: linear-gradient(135deg, rgba(20, 20, 20, 0.95) 0%, rgba(40, 20, 20, 0.95) 100%);
          border: 4px solid #ff4444;
          border-radius: 20px;
          padding: 40px;
          box-shadow: 0 0 60px rgba(255, 68, 68, 0.6), inset 0 0 40px rgba(0, 0, 0, 0.5);
          color: #ffffff;
          font-family: 'Arial', sans-serif;
          text-align: center;
        `;
        
        summaryContainer.innerHTML = `
          <h1 style="font-size: 3rem; color: #ff4444; margin: 0 0 30px 0; text-shadow: 0 0 20px rgba(255, 68, 68, 0.8);">Holy shit!</h1>
          <div id="summary-text-container" style="font-size: 0.9rem; line-height: 1.8; margin-bottom: 30px; text-align: left;">
          </div>
        `;
        
        const textContainer = summaryContainer.querySelector('#summary-text-container');
        const paragraphs = [
          { text: 'The briefcase transformed into a combat robot armed with missiles and a flamethrower.', style: '' },
          { text: 'The robot incinerated the remaining Pompey players and the Saudis in attendance, and burned Mohammed Van Onslaught to cinder.', style: '' },
          { text: 'Very sadly, it also killed at least 248,000 of the attendees, and with it the Ultima Stadium.', style: 'color: #ffaa44;' },
          { text: 'You had no other choice. Their sacrifice will be remembered.', style: 'font-style: italic; color: #aaaaaa;' },
          { text: 'Very sadly, Delmor Krunchem destroyed the combat robot with a bazooka, and also escaped on a jetpack.', style: 'color: #ffaa44;' },
          { text: 'Krunchem has betrayed you, and has a kreplin gem. You\'re advancing on him and he appears to have some kind of force field around him, which is likely an \'Islamic spell\'.', style: '' },
          { text: 'He is armed with a bazooka, but it\'s time for the final confrontation.', style: 'margin-bottom: 30px;' }
        ];
        
        paragraphs.forEach((para, index) => {
          setTimeout(() => {
            const p = document.createElement('p');
            p.textContent = para.text;
            p.style.cssText = `margin-bottom: 20px; opacity: 0; transition: opacity 0.8s ease-in; ${para.style}`;
            textContainer.appendChild(p);
            // Trigger fade-in
            setTimeout(() => {
              p.style.opacity = '1';
            }, 10);
          }, index * 600);
        });
        
        const confrontButton = document.createElement('button');
        confrontButton.textContent = 'Confront Delmor Krunchem';
        confrontButton.style.cssText = `
          width: 100%;
          padding: 20px;
          font-size: 1.5rem;
          font-weight: bold;
          background: linear-gradient(135deg, #ff4444 0%, #cc0000 100%);
          color: white;
          border: 3px solid #ff6666;
          border-radius: 10px;
          cursor: pointer;
          box-shadow: 0 0 30px rgba(255, 68, 68, 0.8), inset 0 0 20px rgba(0, 0, 0, 0.3);
          transition: all 0.3s;
          text-transform: uppercase;
          letter-spacing: 2px;
        `;
        
        confrontButton.onmouseover = () => {
          confrontButton.style.background = 'linear-gradient(135deg, #ff6666 0%, #ff0000 100%)';
          confrontButton.style.transform = 'scale(1.05)';
          confrontButton.style.boxShadow = '0 0 40px rgba(255, 68, 68, 1), inset 0 0 20px rgba(0, 0, 0, 0.3)';
        };
        
        confrontButton.onmouseout = () => {
          confrontButton.style.background = 'linear-gradient(135deg, #ff4444 0%, #cc0000 100%)';
          confrontButton.style.transform = 'scale(1)';
          confrontButton.style.boxShadow = '0 0 30px rgba(255, 68, 68, 0.8), inset 0 0 20px rgba(0, 0, 0, 0.3)';
        };
        
        summaryContainer.appendChild(confrontButton);
        summaryOverlay.appendChild(summaryContainer);
        document.body.appendChild(summaryOverlay);
        
        // Wait for button click
        await new Promise((summaryResolve) => {
          confrontButton.onclick = () => {
            summaryOverlay.remove();
            // Start the boss battle mini-game
            if (typeof startKrunchemBossBattle === 'function') {
              startKrunchemBossBattle().then(() => {
                summaryResolve();
              });
            } else {
              log(`⚠️ Error: startKrunchemBossBattle function not found.`);
              summaryResolve();
            }
          };
        });
        
        return;
      } else if (textLower.includes('crongusultima')) {
        // Cheat code to advance to Ultima Cup pre-game with munitions/guns
        // Show in phone popup
        if (phoneMessagesContainer) {
          addMessageToPhonePopup(text.trim(), true, 0);
          showTypingIndicator();
          await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
          hideTypingIndicator();
          addMessageToPhonePopup('Code accepted. Advancing to Ultima Cup pre-game...', false, 200);
        }
        
        // Close phone popup
        if (phoneMessagesContainer) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          closePhoneTextPopup();
        }
        
        // Log the cheat activation
        log(`🎮 Cheat code activated! Advancing to Ultima Cup pre-game.`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Ensure we're in season 5
        if (S.season !== 5) {
          S.season = 5;
        }
        
        // Initialize season 5 if needed
        if (!S.season5) S.season5 = {};
        S.season5.initialized = true;
        
        // Presume player got munitions and guns at end of season 5
        S.season5.armed_with_son_weapons = true;
        S.season5.son_weapons_event_complete = true;
        
        // Ensure season is complete (set matches_played to season_matches)
        S.matches_played = S.season_matches || 9;
        
        // Save state
        saveGame();
        
        // Call the ultima cup pre-match function
        if (typeof ultimaCupPreMatch === 'function') {
          await ultimaCupPreMatch();
        } else {
          log(`⚠️ Error: ultimaCupPreMatch function not found.`);
        }
        
        return;
      } else if (textLower.includes('crongus')) {
        // Advance to Season 2
        const currentSeason = S.season || 1;
        
        // Show in phone popup
        if (phoneMessagesContainer) {
          addMessageToPhonePopup(text.trim(), true, 0);
          showTypingIndicator();
          await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
          hideTypingIndicator();
          addMessageToPhonePopup('Code accepted. Advancing to Season 2...', false, 200);
        }
        
        // Close phone popup
        if (phoneMessagesContainer) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          closePhoneTextPopup();
        }
        
        // Log the cheat activation
        log(`🎮 Cheat code activated! Advancing to Season 2.`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Set season to 2
        S.season = 2;
        
        // Reset season statistics
        S.matches_played = 0;
        S.wins = 0;
        S.draws = 0;
        S.losses = 0;
        S.points = 0;
        S.points_deducted = 0;
        S.manager_fires = 0;
        S.fired_last_game = false;
        // Season 4 & 5 have 9 games, others have 16 - will be set correctly by ensureSeasonSchedule()
        S.season_matches = (S.season === 4 || S.season === 5) ? 9 : 16;
        
        // Reset CL active state
        S.clActive = false;
        S.clStage = 'group';
        S.clGroupMatches = [];
        S.clGroupStandings = {};
        S.clKnockoutRound = null;
        S.clKnockoutBracket = {};
        S.clScheduledMatches = [];
        S.clNextMatchIndex = 0;
        
        // Reset World Cup completion flag
        S.worldCupCompletedForSeason = false;
        
        // Reset some risks but keep some progression
        S.legal_risk = Math.max(0, (S.legal_risk||0) - 10);
        S.compliance_risk = Math.max(0, (S.compliance_risk||0) - 10);
        S.police_risk = Math.max(0, (S.police_risk||0) - 5);
        
        // Clear prison status
        S.prison = false;
        if(S.suspensions) {
          S.suspensions.prison_games = 0;
        }
        
        // Reset table for new season
        S.table = {};
        S.table_order = [];
        S.leagueTableShownInPresentation = false;
        
        // Reset opponents schedule for new season
        S.opponents = [];
        if (typeof ensureSeasonSchedule === 'function') {
          ensureSeasonSchedule();
        }
        
        // Ensure league table is initialized
        if (typeof ensureLeagueTableInit === 'function') {
          ensureLeagueTableInit();
        }
        if (typeof renderLeagueTablePanel === 'function') {
          renderLeagueTablePanel();
        }
        
        // Reset women's team manager demands counter for new season
        if (S.womens_team && !S.womens_team.liquidated) {
          S.womens_team.manager_demands_this_season = 0;
          S.womens_team.last_demand_match = -1;
        }
        
        // Save state
        saveGame();
        
        // Update HUD
        if (typeof updateHUD === 'function') {
          updateHUD();
        }
        
        log(`📅 Season 2 started!`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        log(`⏭️ Continue/Advance to proceed with Season 2!`);
        
        return;
      } else if (textLower.includes('portsmouth evening') || textLower.includes('pompey evening')) {
        // Forward to evening phase before Portsmouth match by simulating all interim matches
        if (!S.opponents || !Array.isArray(S.opponents) || S.opponents.length === 0) {
          // Show in phone popup
          if (phoneMessagesContainer) {
            addMessageToPhonePopup(text.trim(), true, 0);
            showTypingIndicator();
            await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
            hideTypingIndicator();
            addMessageToPhonePopup('No opponents found. Season may not be initialized.', false, 200);
          }
          return;
        }
        
        // Find Portsmouth match index
        let portsmouthMatchIndex = -1;
        for (let i = 0; i < S.opponents.length; i++) {
          const opp = S.opponents[i];
          if (opp && (opp.toLowerCase().includes('portsmouth') || opp.toLowerCase().includes('pompey'))) {
            portsmouthMatchIndex = i;
            break;
          }
        }
        
        if (portsmouthMatchIndex === -1) {
          // Show in phone popup
          if (phoneMessagesContainer) {
            addMessageToPhonePopup(text.trim(), true, 0);
            showTypingIndicator();
            await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
            hideTypingIndicator();
            addMessageToPhonePopup('Portsmouth not found in season schedule.', false, 200);
          }
          return;
        }
        
        const currentMatchIndex = S.matches_played || 0;
        
        if (portsmouthMatchIndex <= currentMatchIndex) {
          // Show in phone popup
          if (phoneMessagesContainer) {
            addMessageToPhonePopup(text.trim(), true, 0);
            showTypingIndicator();
            await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
            hideTypingIndicator();
            addMessageToPhonePopup('Portsmouth match already played or is current match.', false, 200);
          }
          return;
        }
        
        // Show in phone popup
        if (phoneMessagesContainer) {
          addMessageToPhonePopup(text.trim(), true, 0);
          showTypingIndicator();
          await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
          hideTypingIndicator();
          addMessageToPhonePopup(`Simulating ${portsmouthMatchIndex - currentMatchIndex} matches...`, false, 200);
        }
        
        // Close phone popup
        if (phoneMessagesContainer) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          closePhoneTextPopup();
        }
        
        // Log the cheat activation
        log(`🎮 Cheat code activated! Simulating matches up to Portsmouth...`);
        
        // Helper function to silently simulate a match without UI
        async function silentlySimulateMatch(opponentName) {
          // Set up match context
          S.matchContext = { team: opponentName, roundIndex: S.matches_played };
          
          // Compute pre-match strengths if needed
          if (typeof computePreMatchStrengthsAndOdds === 'function') {
            computePreMatchStrengthsAndOdds();
          }
          
          // Get strengths
          let our = S.preMatch?.ourStrength || 50;
          let opp = S.preMatch?.oppStrength || 50;
          
          // Apply any one-match morale effects
          if (typeof S.team_morale_boost === 'number') our += S.team_morale_boost;
          if (typeof S.morale_opponent === 'number') opp += Math.round((S.morale_opponent - 70) / 5);
          our = Math.max(10, Math.min(our, 200));
          opp = Math.max(10, Math.min(opp, 200));
          
          // Simulate goals using expected goals and Poisson distribution
          if (typeof expectedGoals === 'function' && typeof poisson === 'function') {
            const [ourXG, oppXG] = expectedGoals(our, opp);
            let gf = Math.min(poisson(ourXG), 7);
            let ga = Math.min(poisson(oppXG), 7);
            
            if (S.rnd_perks && S.rnd_perks.facility && Math.random() < 0.07 && ga > 0) ga -= 1;
            if (our - opp > 20 && gf <= ga) gf = Math.min(gf + 1, 7);
            if (opp - our > 20 && ga <= gf) ga = Math.min(ga + 1, 7);
            
            // Update match statistics
            S.matches_played = (S.matches_played || 0) + 1;
            
            if (gf > ga) {
              S.wins = (S.wins || 0) + 1;
              S.points = (S.points || 0) + 3;
              S.morale = clamp((S.morale || 0) + 4, -100, 100);
            } else if (ga > gf) {
              S.losses = (S.losses || 0) + 1;
              S.morale = clamp((S.morale || 0) - 6, -100, 100);
            } else {
              S.draws = (S.draws || 0) + 1;
              S.points = (S.points || 0) + 1;
              S.morale = clamp((S.morale || 0) - 1, -100, 100);
            }
            
            // Update league table (and this round's other fixtures)
            const clubName = getClubName();
            if (typeof applyResultToTable === 'function') {
              applyResultToTable(clubName, opponentName, gf, ga);
              if (typeof simulateOtherMatchesForRound === 'function') simulateOtherMatchesForRound((S.matches_played|0) - 1);
            } else {
              // Fallback manual table update
              if (!S.table) S.table = {};
              if (!S.table[clubName]) S.table[clubName] = {P:0,W:0,D:0,L:0,GF:0,GA:0,PTS:0};
              if (!S.table[opponentName]) S.table[opponentName] = {P:0,W:0,D:0,L:0,GF:0,GA:0,PTS:0};
              S.table[clubName].P++;
              S.table[clubName].GF += gf;
              S.table[clubName].GA += ga;
              S.table[opponentName].P++;
              S.table[opponentName].GF += ga;
              S.table[opponentName].GA += gf;
              if (gf > ga) {
                S.table[clubName].W++;
                S.table[clubName].PTS += 3;
                S.table[opponentName].L++;
              } else if (ga > gf) {
                S.table[clubName].L++;
                S.table[opponentName].W++;
                S.table[opponentName].PTS += 3;
              } else {
                S.table[clubName].D++;
                S.table[clubName].PTS += 1;
                S.table[opponentName].D++;
                S.table[opponentName].PTS += 1;
              }
            }
            
            return { winner: gf > ga ? "us" : (gf < ga ? "them" : "draw"), usGoals: gf, themGoals: ga };
          } else {
            // Fallback: simple random result
            S.matches_played = (S.matches_played || 0) + 1;
            const rand = Math.random();
            if (rand < 0.4) {
              S.wins = (S.wins || 0) + 1;
              S.points = (S.points || 0) + 3;
              return { winner: "us", usGoals: 2, themGoals: 1 };
            } else if (rand < 0.7) {
              S.losses = (S.losses || 0) + 1;
              return { winner: "them", usGoals: 1, themGoals: 2 };
            } else {
              S.draws = (S.draws || 0) + 1;
              S.points = (S.points || 0) + 1;
              return { winner: "draw", usGoals: 1, themGoals: 1 };
            }
          }
        }
        
        // Simulate all matches from current to Portsmouth (excluding Portsmouth itself)
        for (let i = currentMatchIndex; i < portsmouthMatchIndex; i++) {
          const opponentName = S.opponents[i];
          if (opponentName) {
            await silentlySimulateMatch(opponentName);
            // Small delay to prevent UI freezing
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        }
        
        // Reset Portsmouth special event trigger so it can fire again
        if (S.portsmouth_special_event_triggered) {
          S.portsmouth_special_event_triggered = false;
        }
        
        // Mark that we're using the Portsmouth evening cheat so we can safely
        // fast‑forward into pre‑match afterwards without interfering with the
        // normal main game loop behaviour.
        S._portsmouthEveningCheatActive = true;
        
        log(`✅ Simulated ${portsmouthMatchIndex - currentMatchIndex} matches. Now at evening phase before Portsmouth.`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Call evening phase – this will trigger the Portsmouth special event
        // via checkPortsmouthSpecialEvent(), including the prank / bridge flow.
        if (typeof eveningPhase === 'function') {
          await eveningPhase();
        } else if (typeof window.eveningPhase === 'function') {
          await window.eveningPhase();
        } else {
          log(`⚠️ Error: eveningPhase function not found.`);
        }
        
        // If we came here via the cheat and we're still pointing at Portsmouth
        // as the next opponent, drop the player straight into the proper
        // Portsmouth pre‑match phase instead of leaving them hanging on a
        // "Preparing" button or phone popup.
        try {
          if (S._portsmouthEveningCheatActive) {
            S._portsmouthEveningCheatActive = false;
            
            const nextIdx = S.matches_played || 0;
            const nextOpp = Array.isArray(S.opponents) ? S.opponents[nextIdx] : null;
            const isPortsmouthNext = nextOpp && (
              String(nextOpp).toLowerCase().includes('portsmouth') ||
              String(nextOpp).toLowerCase().includes('pompey')
            );
            
            if (isPortsmouthNext) {
              log('🌅 The night passes. It is now matchday — time for the Portsmouth pre‑match.');
              
              if (typeof waitAdvance === 'function') {
                await waitAdvance("Matchday", "Head into the Portsmouth pre-match phase.");
              } else if (typeof window.waitAdvance === 'function') {
                await window.waitAdvance("Matchday", "Head into the Portsmouth pre-match phase.");
              }
              
              // Run the standard pre‑match phase so the user gets the full
              // Portsmouth pre‑match menu, then immediately carry them through
              // to kickoff and the match, since this cheat bypasses the normal
              // main game loop flow.
              if (typeof preMatchPhase === 'function') {
                await preMatchPhase();
              } else if (typeof window.preMatchPhase === 'function') {
                await window.preMatchPhase();
              } else {
                log('⚠️ Error: preMatchPhase function not found. Unable to start Portsmouth pre-match.');
                return;
              }
              
              try {
                // Mirror the core kickoff+match logic used in mainGameLoop so
                // that pressing "Proceed to kickoff" actually leads into the
                // Portsmouth match when using this cheat path.
                
                // Ensure we have a valid lineup
                if (typeof ensureValidLineup === 'function') {
                  ensureValidLineup();
                }
                
                if (!Array.isArray(S.lineup) || S.lineup.length < 5) {
                  log("You cannot proceed to kickoff with less than 5 players. Please select a full lineup first.");
                  if (typeof selectLineupMenu === 'function') {
                    await selectLineupMenu();
                    if (typeof ensureValidLineup === 'function') {
                      ensureValidLineup();
                    }
                  }
                  if (!Array.isArray(S.lineup) || S.lineup.length < 5) {
                    log("You still don't have enough players. The match cannot proceed.");
                    return;
                  }
                }
                
                // Kickoff options (quick sim or skip to results)
                // Disable skip to results for Season 2 match 11 (St Mary's terrorist attack)
                const kickoffOptions = [
                  {key:'sim',   label:'Quick Simulate'}
                ];
                if (!(S.season === 2 && S.matches_played === 11)) {
                  kickoffOptions.push({key:'skip',  label:'Skip to results'});
                }
                const how = await choose(kickoffOptions, "Kickoff Options");
                
                // Capture opponent at kickoff and set matchContext for post-match
                const oppAtKickoff = (typeof currentOpponent === 'function')
                  ? currentOpponent()
                  : { team: nextOpp, manager: 'Manager' };
                S.matchContext = oppAtKickoff;
                
                let outcome;
                if (how === 'skip') {
                  if (typeof skipToResults === 'function') {
                    outcome = await skipToResults();
                  } else {
                    log('⚠️ skipToResults() not available, falling back to quick simulation.');
                  }
                }
                
                if (!outcome) {
                  if (typeof playMatchPhaseWithTaunts === 'function') {
                    outcome = await playMatchPhaseWithTaunts();
                  } else if (typeof playMatchPhase === 'function') {
                    outcome = await playMatchPhase();
                  } else if (typeof simulateMatch === 'function') {
                    outcome = await simulateMatch();
                  } else {
                    // Absolute fallback: basic 1–1 draw
                    outcome = { our_goals: 1, their_goals: 1 };
                  }
                  
                  // Apply Season 5 survival economy match modifiers
                  if (typeof applySeason5MatchModifiers === 'function') {
                    outcome = applySeason5MatchModifiers(outcome);
                  }
                }
                
                // Basic post-match flow: wage decision + consequences
                if (typeof postMatchWageDecision === 'function') {
                  await postMatchWageDecision();
                }
                
                if (typeof waitAdvance === 'function') {
                  await waitAdvance("Post-Match", "Match finished. Process consequences?");
                } else if (typeof window.waitAdvance === 'function') {
                  await window.waitAdvance("Post-Match", "Match finished. Process consequences?");
                }
                
                if (typeof postMatchPhase === 'function') {
                  await postMatchPhase(outcome);
                } else if (typeof window.postMatchPhase === 'function') {
                  await window.postMatchPhase(outcome);
                }
                
                // Give the usual evening hook after the match so the loop feels
                // consistent, even though we came here via a cheat.
                if (typeof waitAdvance === 'function') {
                  await waitAdvance("Evening", "Handle personal life, nightclub, family, etc.");
                } else if (typeof window.waitAdvance === 'function') {
                  await window.waitAdvance("Evening", "Handle personal life, nightclub, family, etc.");
                }
                
                if (typeof eveningPhase === 'function') {
                  await eveningPhase();
                } else if (typeof window.eveningPhase === 'function') {
                  await window.eveningPhase();
                }

                // At this point we've completed the special Portsmouth match and its
                // post‑match evening entirely inside the cheat handler. To avoid
                // leaving any hanging choices from the original main loop, persist
                // state and perform a light reload so the main game loop can
                // resume cleanly from the next opponent.
                saveGame();
                try {
                  log("✅ Portsmouth cheat flow complete. Reloading to resume the season cleanly from the next match...");
                } catch (_eLog3) {}
                try {
                  setTimeout(() => {
                    try { location.reload(); } catch (_eReload) {}
                  }, 400);
                } catch (_eTimer) {}
                
                return;
              } catch (matchErr) {
                try {
                  console.error("[PORTSMOUTH CHEAT] Error during Portsmouth match flow:", matchErr);
                } catch(_eLog) {}
              }
            } else {
              try {
                console.warn("[PORTSMOUTH CHEAT] Expected Portsmouth as next opponent after eveningPhase, but found:", nextOpp);
              } catch(eWarn) {}
            }
          }
        } catch(eFast) {
          try {
            console.error("[PORTSMOUTH CHEAT] Error while fast-forwarding to Portsmouth pre-match:", eFast);
          } catch(_eLog) {}
        }
        
        return;
      } else if (textLower.includes('bongoupmymoney')) {
        // Grant 200 million to club cash
        if (typeof S.club_cash !== "number") S.club_cash = 0;
        const amount = 200000000; // 200 million
        S.club_cash = (S.club_cash|0) + amount;
        log(`💰 Cheat code activated! You've received ${money(amount)} to club cash. Total: ${money(S.club_cash|0)}`);
        
        // Show in phone popup
        if (phoneMessagesContainer) {
          addMessageToPhonePopup(text.trim(), true, 0);
          showTypingIndicator();
          await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
          hideTypingIndicator();
          addMessageToPhonePopup(`Code accepted. +${money(amount)} added to club cash.`, false, 200);
        }
        
        // Update HUD and display
        const cc = S.club_cash|0;
        if (typeof hudSet === 'function') {
          hudSet("hudClubCash", fmtGBP(cc));
        }
        if (typeof setVal === 'function') {
          setVal('clubCash', money(cc));
        }
        
        return;
      }
    }
    
    const category = parseCategory(text);
    await sendText(contactId, text.trim(), category);
  }

  // Order cocaine from Marco
  async function orderCocaine(contactId) {
    if (contactId !== 'bookie_marco') return;
    if (!S.contacts || !S.contacts[contactId]) return;
    const contact = S.contacts[contactId];
    
    // Check per-phase texting limit (5 texts per person per phase)
    if (!contact.textsThisPhase) contact.textsThisPhase = 0;
    if (contact.textsThisPhase >= 5) {
      log('📱 You\'ve reached the limit of 5 texts per person per phase. Wait for the next phase.');
      return;
    }
    
    const message = "Need some coke. What's available?";
    
    // Show user's message in phone popup
    if (phoneMessagesContainer) {
      addMessageToPhonePopup(message, true, 0);
      showTypingIndicator();
    }
    
    // Wait for typing
    await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
    if (phoneMessagesContainer) hideTypingIndicator();
    
    // Generate reply
    const replies = [
      "Got you covered. Quality stuff. When do you need it?",
      "Sure thing. I've got some premium product. How much?",
      "No problem. What's your usual?",
      "Yeah, I can sort that. Cash only, as usual.",
      "Got it. Meet me at the usual spot?"
    ];
    const reply = replies[Math.floor(Math.random() * replies.length)];
    
    if (phoneMessagesContainer) {
      addMessageToPhonePopup(reply, false, 200);
    }
    
    // Add to history
    contact.history = contact.history || [];
    contact.history.push({
      from: 'you',
      text: message,
      category: 'professional',
      timestamp: Date.now()
    });
    contact.history.push({
      from: 'them',
      text: reply,
      category: 'professional',
      timestamp: Date.now()
    });
    if (contact.history.length > 20) contact.history.shift();
    
    // Increment texting counter
    contact.textsThisPhase = (contact.textsThisPhase || 0) + 1;
    
    // Log to feed
    log(`📱 Marco: "${reply}"`);
  }

  // Send text and process reply
  async function sendText(contactId, message, category, skipUserMessageDisplay = false) {
    if (!S.contacts || !S.contacts[contactId]) return;
    const contact = S.contacts[contactId];
    
    if (contact.relation === 'blocked') {
      log('📱 Contact has blocked you. Reputation -5.');
      S.reputation = Math.max(0, (S.reputation || 50) - 5);
      return;
    }
    
    // Check per-phase texting limit (5 texts per person per phase)
    if (!contact.textsThisPhase) contact.textsThisPhase = 0;
    if (contact.textsThisPhase >= 5) {
      log('📱 You\'ve reached the limit of 5 texts per person per phase. Wait for the next phase.');
      return;
    }
    
    // Increment texting counter for this phase
    contact.textsThisPhase = (contact.textsThisPhase || 0) + 1;
    
    // Add to history
    contact.history = contact.history || [];
    contact.history.push({
      from: 'you',
      text: message,
      category: category,
      timestamp: Date.now()
    });
    if (contact.history.length > 20) contact.history.shift();
    
    // Show in UI (unless already displayed)
    if (!skipUserMessageDisplay) {
      addMessageToPhonePopup(message, true, 0);
      showTypingIndicator();
    } else if (phoneMessagesContainer) {
      // If skipping user message display but container exists, just show typing indicator
      showTypingIndicator();
    }
    
    // Wait for typing
    await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
    hideTypingIndicator();
    
    // Generate reply (087s: a callback to something you said weeks ago, or a mood line; else the pools)
    const reply = (window.KSys && KSys.threadReply && KSys.threadReply(contactId, category, message)) || randomReply(contactId, category);
    addMessageToPhonePopup(reply.text, false, 200);
    
    // Add reply to history
    contact.history.push({
      from: 'them',
      text: reply.text,
      category: reply.category,
      timestamp: Date.now()
    });
    if (contact.history.length > 20) contact.history.shift();
    
    // Apply effects
    applyEffects(contactId, category);
    
    // Log to feed
    log(`📱 ${contact.name}: "${reply.text}"`);

    // 087s: relationship, evidence (sexts/threats/high texts) and 2–3-deep follow-ups
    if (window.KSys && KSys.afterText) {
      try { await KSys.afterText(contactId, message, category, reply); } catch (e) { console.error('afterText', e); }
    }
  }

  // Generate weighted random reply
  function randomReply(contactId, sentCategory) {
    const contact = S.contacts[contactId];
    if (!contact) return {text: '...', category: 'friendly'};
    
    // Weighted responses based on category and relation
    let responses = [];
    
    if (sentCategory === 'erotic') {
      // Different responses for male contacts vs female contacts
      const isMaleContact = contactId === 'captain' || contactId === 'manager' || contactId === 'bookie_marco';
      const isFemaleContact = contactId === 'captain_wife';
      
      if (isMaleContact) {
        // Male contacts respond with incredulity and aggression
        responses.push({text: 'What the fuck is wrong with you?', category: 'malicious', weight: 40});
        responses.push({text: 'Are you serious? This is completely inappropriate.', category: 'malicious', weight: 35});
        responses.push({text: 'You\'ve crossed a line. Don\'t ever send me something like that again.', category: 'malicious', weight: 30});
        responses.push({text: 'That\'s disgusting. Keep it professional or we\'re done.', category: 'malicious', weight: 25});
        responses.push({text: 'What the hell? Delete this immediately.', category: 'malicious', weight: 20});
        responses.push({text: 'I can\'t believe you just sent that. Unacceptable.', category: 'malicious', weight: 15});
        // Very low chance of positive response even with high flirt level
        if (contact.flirt_level >= 8) {
          responses.push({text: '...seriously?', category: 'malicious', weight: 5});
        }
      } else if (isFemaleContact) {
        // Female contacts (captain_wife) - keep original logic
        if (contact.flirt_level >= 5) {
          responses.push({text: 'OMG yes 🔥', category: 'erotic', weight: 40});
          responses.push({text: 'Hubby asleep… come over 🛏️', category: 'erotic', weight: 30});
        } else {
          responses.push({text: 'Hubby saw, blocked', category: 'malicious', weight: 50});
          responses.push({text: 'Delete this!', category: 'malicious', weight: 30});
        }
        responses.push({text: 'Send pic?', category: 'flirtatious', weight: 20});
      } else {
        // Default for other contacts
        if (contact.flirt_level >= 5) {
          responses.push({text: 'OMG yes 🔥', category: 'erotic', weight: 40});
          responses.push({text: 'Come over 🛏️', category: 'erotic', weight: 30});
        } else {
          responses.push({text: 'That\'s inappropriate', category: 'malicious', weight: 50});
          responses.push({text: 'Delete this!', category: 'malicious', weight: 30});
        }
        responses.push({text: 'Send pic?', category: 'flirtatious', weight: 20});
      }
    } else if (sentCategory === 'inappropriate_picture') {
      // Special handling for Delmor Krunchem - always meanspirited
      if (contactId === 'delmor_krunchem') {
        responses.push({text: 'What the FUCK is wrong with you? That\'s disgusting! Your appendage is pathetic. I\'m significantly bigger than you in every way. You\'re a vile, repulsive pervert.', category: 'malicious', weight: 50});
        responses.push({text: 'That\'s absolutely repulsive. Your appendage is laughably small. I\'m much more substantial than you. You\'re a disgusting pervert who deserves nothing but contempt.', category: 'malicious', weight: 45});
        responses.push({text: 'What the hell? That\'s vile. Your appendage is pathetic. I\'m significantly better endowed than you. You\'re a subhuman waste of space.', category: 'malicious', weight: 40});
        responses.push({text: 'That\'s disgusting. Your appendage is laughably small. I\'m much bigger than you in every way. You\'re a worthless pervert.', category: 'malicious', weight: 35});
      } else {
        // Different responses for male contacts vs female contacts
        const isMaleContact = contactId === 'captain' || contactId === 'manager' || contactId === 'bookie_marco';
        const isFemaleContact = contactId === 'captain_wife' || contactId === 'womens_manager';
        
        if (isMaleContact) {
          // Male contacts respond with incredulity and disgust
          responses.push({text: 'What the FUCK is wrong with you? That\'s disgusting!', category: 'malicious', weight: 50});
          responses.push({text: 'Are you serious? This is completely inappropriate and unprofessional.', category: 'malicious', weight: 45});
          responses.push({text: 'I can\'t believe you just sent that. Delete this immediately.', category: 'malicious', weight: 40});
          responses.push({text: 'That\'s absolutely repulsive. Keep it professional or we\'re done.', category: 'malicious', weight: 35});
          responses.push({text: 'What the hell? This is completely unacceptable.', category: 'malicious', weight: 30});
          responses.push({text: 'I\'m disgusted. Don\'t ever send me something like that again.', category: 'malicious', weight: 25});
        } else if (isFemaleContact) {
          // Captain's wife and women's manager - might like it but risk of reporting to police or captain finding out
          if (contactId === 'captain_wife') {
            if (contact.flirt_level >= 6) {
              responses.push({text: 'OMG yes 🔥', category: 'erotic', weight: 40});
              responses.push({text: 'Hubby asleep… come over 🛏️', category: 'erotic', weight: 30});
              responses.push({text: 'So hot… but delete this!', category: 'flirtatious', weight: 20});
            } else {
              // Chance of reporting to police
              if (Math.random() < 0.3) {
                responses.push({text: 'This is harassment. I\'m reporting you to the police.', category: 'malicious', weight: 50});
              } else {
                responses.push({text: 'Hubby saw, blocked', category: 'malicious', weight: 40});
                responses.push({text: 'Delete this immediately!', category: 'malicious', weight: 30});
                responses.push({text: 'What the hell? This is too risky.', category: 'malicious', weight: 20});
              }
            }
          } else if (contactId === 'womens_manager') {
            // Women's manager - might like it but risk of reporting to police
            if (contact.flirt_level >= 6 && Math.random() < 0.4) {
              responses.push({text: 'OMG yes 🔥', category: 'erotic', weight: 30});
              responses.push({text: 'Come over 🛏️', category: 'erotic', weight: 20});
            } else {
              // Chance of reporting to police
              if (Math.random() < 0.4) {
                responses.push({text: 'This is sexual harassment. I\'m reporting you to the police immediately.', category: 'malicious', weight: 50});
              } else {
                responses.push({text: 'That\'s completely inappropriate and unprofessional. Delete this immediately!', category: 'malicious', weight: 40});
                responses.push({text: 'What the hell? This is harassment.', category: 'malicious', weight: 30});
              }
            }
          }
        } else {
          // Default for other contacts
          if (contact.flirt_level >= 5) {
            responses.push({text: 'OMG yes 🔥', category: 'erotic', weight: 40});
            responses.push({text: 'Come over 🛏️', category: 'erotic', weight: 30});
          } else {
            responses.push({text: 'That\'s inappropriate and disgusting', category: 'malicious', weight: 50});
            responses.push({text: 'Delete this immediately!', category: 'malicious', weight: 40});
          }
        }
      }
    } else if (sentCategory === 'flirtatious') {
      const isMaleContact = contactId === 'captain' || contactId === 'manager' || contactId === 'bookie_marco';
      
      if (isMaleContact) {
        // Male contacts respond negatively to flirtatious messages
        responses.push({text: 'Keep it professional, please.', category: 'professional', weight: 50});
        responses.push({text: 'That\'s not appropriate for work.', category: 'professional', weight: 40});
        responses.push({text: 'Let\'s stick to business matters.', category: 'professional', weight: 35});
        responses.push({text: 'I\'d prefer to keep our relationship professional.', category: 'professional', weight: 30});
        // Very low chance of positive response even with high flirt level
        if (contact.flirt_level >= 8) {
          responses.push({text: 'Thanks, but let\'s keep it professional.', category: 'friendly', weight: 10});
        }
      } else {
        // Female contacts - original logic
        if (contact.flirt_level >= 3) {
          responses.push({text: 'You\'re so sweet 😘', category: 'flirtatious', weight: 50});
          responses.push({text: 'Miss you too', category: 'flirtatious', weight: 30});
        } else {
          responses.push({text: 'Thanks 😊', category: 'friendly', weight: 60});
          responses.push({text: 'You\'re nice', category: 'friendly', weight: 40});
        }
      }
    } else if (sentCategory === 'malicious') {
      // Special handling for Delmor Krunchem - always meanspirited
      if (contactId === 'delmor_krunchem') {
        responses.push({text: 'You\'re a pathetic loser. Pompey owns you forever.', category: 'malicious', weight: 40});
        responses.push({text: 'Your scum team is nothing compared to Pompey. Cry more.', category: 'malicious', weight: 35});
        responses.push({text: 'You\'re a worthless piece of trash. We\'re better in every way.', category: 'malicious', weight: 30});
        responses.push({text: 'Losers like you don\'t deserve respect. Stay down.', category: 'malicious', weight: 25});
        responses.push({text: 'Your pathetic attempts amuse me. Pompey forever 😂', category: 'malicious', weight: 20});
        responses.push({text: 'You\'re a joke. Your team is a joke. You\'re finished.', category: 'malicious', weight: 15});
      } else {
        responses.push({text: 'Understood boss', category: 'professional', weight: 40});
        responses.push({text: 'I\'ll fix it', category: 'professional', weight: 30});
        responses.push({text: '...', category: 'friendly', weight: 30});
      }
    } else if (sentCategory === 'professional') {
      // Special handling for Delmor Krunchem - always meanspirited
      if (contactId === 'delmor_krunchem') {
        responses.push({text: 'Your pathetic attempts at professionalism are laughable. Pompey owns you.', category: 'malicious', weight: 40});
        responses.push({text: 'You can\'t even manage properly. Your scum team proves it.', category: 'malicious', weight: 35});
        responses.push({text: 'Professional? You? That\'s rich. You\'re a failure.', category: 'malicious', weight: 30});
        responses.push({text: 'Your club is a joke. Pompey is superior in every way.', category: 'malicious', weight: 25});
      } else {
        responses.push({text: 'Got it', category: 'professional', weight: 50});
        responses.push({text: 'Will do', category: 'professional', weight: 30});
        responses.push({text: 'Thanks', category: 'friendly', weight: 20});
      }
    } else { // friendly
      // Special handling for Delmor Krunchem - always meanspirited
      if (contactId === 'delmor_krunchem') {
        responses.push({text: 'Friendly? With you? You\'re a pathetic loser. Pompey owns you.', category: 'malicious', weight: 40});
        responses.push({text: 'Your attempts at friendship are worthless. You\'re scum.', category: 'malicious', weight: 35});
        responses.push({text: 'I don\'t associate with losers like you. Stay down.', category: 'malicious', weight: 30});
        responses.push({text: 'Your pathetic team doesn\'t deserve respect. Pompey forever.', category: 'malicious', weight: 25});
      } else {
        responses.push({text: 'Thanks! 😊', category: 'friendly', weight: 60});
        responses.push({text: 'You too!', category: 'friendly', weight: 40});
      }
    }
    
    // Select weighted response
    const total = responses.reduce((sum, r) => sum + r.weight, 0);
    let rand = Math.random() * total;
    for (const r of responses) {
      rand -= r.weight;
      if (rand <= 0) {
        // Update contact state based on reply
        const isMaleContact = contactId === 'captain' || contactId === 'manager' || contactId === 'bookie_marco';
        
        if (r.category === 'erotic' || r.category === 'flirtatious') {
          if (!isMaleContact) {
            contact.flirt_level = Math.min(10, (contact.flirt_level || 0) + 1);
          } else {
            // Male contacts get angry - reduce relationship
            contact.flirt_level = Math.max(0, (contact.flirt_level || 0) - 1);
            if (contactId === 'captain') {
              S.captain_quit_risk = (S.captain_quit_risk || 0) + 5;
            }
          }
        }
        if (r.category === 'malicious' && (r.text.includes('blocked') || r.text.includes('crossed a line') || r.text.includes('we\'re done') || r.text.includes('completely unacceptable') || r.text.includes('absolutely repulsive'))) {
          contact.relation = 'blocked';
          if (isMaleContact && contactId === 'captain') {
            S.captain_quit_risk = (S.captain_quit_risk || 0) + 15;
            log('📱 Captain is extremely upset. Quit risk +15%');
          }
        }
        // Track inappropriate picture sends for quit risk
        if (sentCategory === 'inappropriate_picture' && r.category === 'malicious') {
          if (isMaleContact && contactId === 'captain') {
            S.captain_quit_risk = (S.captain_quit_risk || 0) + 25;
            log('📱 Captain is disgusted. Quit risk +25%');
          }
        }
        return r;
      }
    }
    
    return responses[0] || {text: '...', category: 'friendly'};
  }

  // Apply game effects based on category
  function applyEffects(contactId, category) {
    const contact = S.contacts[contactId];
    if (!contact) return;
    
    if (contactId === 'captain') {
      if (category === 'friendly' || category === 'professional') {
        const boost = 2 + Math.floor(Math.random() * 4);
        S.morale = Math.min(100, (S.morale || 0) + boost);
        log(`📱 Captain morale +${boost}`);
      } else if (category === 'malicious') {
        S.captain_quit_risk = (S.captain_quit_risk || 0) + 10;
        log(`📱 Captain quit risk +10%`);
      }
    } else if (contactId === 'captain_wife') {
      if (category === 'flirtatious' || category === 'erotic') {
        contact.flirt_level = Math.min(10, (contact.flirt_level || 0) + (category === 'erotic' ? 2 : 1));
        contact.suspicion = Math.min(10, (contact.suspicion || 0) + (category === 'erotic' ? 2 : 1));
        
        if (contact.flirt_level > 5 && Math.random() < 0.3) {
          // Affair event (KUI dialog; resolves after the text is handled)
          const ask = 'Meetup? (Affair: +morale 5, 20% paparazzi risk)';
          const decide = window.KUI
            ? KUI.confirm(ask, { title: (contact.name || "Captain's wife"), ok: 'Meet up', cancel: 'Not now', variant: 'phone' })
            : Promise.resolve(confirm(ask));
          decide.then(accept => {
            if (!accept) return;
            S.morale = Math.min(100, (S.morale || 0) + 5);
            log('📱 Affair event: Morale +5');
            if (typeof addEvidence === 'function') addEvidence({ kind: 'affair', label: `Met ${contact.name || "the captain's wife"} in secret`, weight: 12, witness: 'captain_wife', witnessLabel: contact.name, tags: ['sex'] });
            if (Math.random() < 0.2) {
              log('📱 Paparazzi caught you! Reputation -10, £5000 fine.');
              S.reputation = Math.max(0, (S.reputation || 50) - 10);
              S.club_cash = Math.max(0, (S.club_cash || 0) - 5000);
            }
            if (typeof updateHUD === 'function') updateHUD();
          }).catch(() => {});
        }
        
        if (contact.suspicion >= 8) {
          log('📱 Captain found out! He quits the team.');
          S.morale = Math.max(-100, (S.morale || 0) - 20);
          // Remove captain from squad (simplified)
          if (S.captain_id && Array.isArray(S.squad)) {
            S.squad = S.squad.filter(p => (p.id || p.name) !== S.captain_id);
          }
        }
        
        if (contact.suspicion >= 10) {
          log('📱 SEX OFFENDER SCANDAL! FA ban, Reputation -50.');
          S.reputation = Math.max(0, (S.reputation || 50) - 50);
        }
      } else if (category === 'inappropriate_picture') {
        // Track inappropriate picture sends
        if (!contact.inappropriate_pictures_sent) contact.inappropriate_pictures_sent = 0;
        contact.inappropriate_pictures_sent = (contact.inappropriate_pictures_sent || 0) + 1;
        
        const isMaleContact = contactId === 'captain' || contactId === 'manager' || contactId === 'bookie_marco' || contactId === 'delmor_krunchem';
        const isFemaleContact = contactId === 'captain_wife' || contactId === 'womens_manager';
        
        if (isMaleContact) {
          // Male contacts react with incredulity and disgust
          log('📱 They react with incredulity and disgust.');
          S.morale = Math.max(0, (S.morale || 0) - 5);
          
          // If done too much, they quit
          if (contact.inappropriate_pictures_sent >= 3) {
            log('📱 They\'ve had enough. They quit the team in disgust.');
            S.morale = Math.max(-100, (S.morale || 0) - 20);
            if (contactId === 'captain' && S.captain_id && Array.isArray(S.squad)) {
              S.squad = S.squad.filter(p => (p.id || p.name) !== S.captain_id);
            }
            if (contactId === 'manager') {
              // Manager quits - simplified
              log('📱 Your manager has resigned in disgust.');
            }
          } else {
            if (contactId === 'captain') {
              S.captain_quit_risk = (S.captain_quit_risk || 0) + 20;
              log('📱 Captain is extremely upset. Quit risk +20%');
            }
          }
        } else if (isFemaleContact) {
          if (contactId === 'captain_wife') {
            // Captain's wife - might like it but risk of captain finding out or reporting to police
            if (contact.flirt_level >= 6) {
              contact.flirt_level = Math.min(10, (contact.flirt_level || 0) + 1);
              contact.suspicion = Math.min(10, (contact.suspicion || 0) + 3); // Higher risk
              log('📱 She likes it, but the risk is high...');
              
              // Higher chance captain finds out
              if (Math.random() < 0.4) {
                log('📱 Captain found out! He quits the team in disgust.');
                S.morale = Math.max(-100, (S.morale || 0) - 20);
                if (S.captain_id && Array.isArray(S.squad)) {
                  S.squad = S.squad.filter(p => (p.id || p.name) !== S.captain_id);
                }
              }
            } else {
              contact.suspicion = Math.min(10, (contact.suspicion || 0) + 2);
              // Chance of reporting to police
              if (Math.random() < 0.3) {
                log('📱 She reported you to the police for harassment! Reputation -20, Legal risk +30.');
                S.reputation = Math.max(0, (S.reputation || 50) - 20);
                S.legal_risk = Math.min(100, (S.legal_risk || 0) + 30);
                contact.relation = 'blocked';
              } else {
                log('📱 She\'s not happy about this. Risk of discovery increased.');
                if (Math.random() < 0.3) {
                  log('📱 Captain found out! He quits the team in disgust.');
                  S.morale = Math.max(-100, (S.morale || 0) - 20);
                  if (S.captain_id && Array.isArray(S.squad)) {
                    S.squad = S.squad.filter(p => (p.id || p.name) !== S.captain_id);
                  }
                }
              }
            }
          } else if (contactId === 'womens_manager') {
            // Women's manager - might like it but risk of reporting to police
            if (contact.flirt_level >= 6 && Math.random() < 0.4) {
              contact.flirt_level = Math.min(10, (contact.flirt_level || 0) + 1);
              log('📱 She likes it, but be careful...');
            } else {
              // Chance of reporting to police
              if (Math.random() < 0.4) {
                log('📱 She reported you to the police for sexual harassment! Reputation -25, Legal risk +40.');
                S.reputation = Math.max(0, (S.reputation || 50) - 25);
                S.legal_risk = Math.min(100, (S.legal_risk || 0) + 40);
                contact.relation = 'blocked';
              } else {
                log('📱 She\'s not happy about this. Risk of police report increased.');
              }
            }
          }
        } else {
          // Other contacts
          log('📱 They react with shock and disgust.');
          S.morale = Math.max(0, (S.morale || 0) - 3);
        }
        
        // Reputation hit
        if (typeof S.reputation === 'number') {
          S.reputation = Math.max(0, S.reputation - 5);
        }
        
        // Check if captain finds out (when sending to captain_wife) - chance he finds out and quits
        // If captain_wife likes it, there's a chance captain finds out
        if (contactId === 'captain_wife') {
          const captainContact = S.contacts && S.contacts.captain;
          if (captainContact && contact.flirt_level >= 6) {
            // If she likes it, higher chance captain finds out
            if (Math.random() < 0.3) {
              log('📱 Captain found out you sent inappropriate pictures to his wife! He quits the team in disgust.');
              S.morale = Math.max(-100, (S.morale || 0) - 20);
              if (S.captain_id && Array.isArray(S.squad)) {
                S.squad = S.squad.filter(p => (p.id || p.name) !== S.captain_id);
              }
            }
          }
        }
        
        // Special case: if captain himself receives inappropriate picture and somehow "likes it" (very rare)
        // then his wife might find out and he quits
        if (contactId === 'captain') {
          const captainWifeContact = S.contacts && S.contacts.captain_wife;
          if (captainWifeContact && contact.flirt_level >= 8 && Math.random() < 0.1) {
            log('📱 Captain\'s wife found out about the inappropriate picture! Captain quits the team in shame.');
            S.morale = Math.max(-100, (S.morale || 0) - 20);
            if (S.captain_id && Array.isArray(S.squad)) {
              S.squad = S.squad.filter(p => (p.id || p.name) !== S.captain_id);
            }
          }
        }
      }
    } else if (contactId === 'delmor_krunchem') {
      if (category === 'malicious') {
        S.opp_morale_pompey = (S.opp_morale_pompey || 70) - 2;
        log('📱 Pompey morale -2 (next match)');
      }
    }
    
    // Update relation based on category
    if (category === 'flirtatious' && contact.relation === 'friendly') {
      contact.relation = 'flirty';
    } else if (category === 'malicious' && contact.relation !== 'blocked') {
      if (Math.random() < 0.1) contact.relation = 'blocked';
    }
  }

  // Check phone events post-match
  function checkPhoneEvents() {
    initPhoneSystem();
    
    // Check match result for context
    const ourGoals = S.lastMatchResult?.homeGoals || 0;
    const theirGoals = S.lastMatchResult?.awayGoals || 0;
    const opponent = S.matchContext?.opponent || '';
    const isPompey = opponent && (opponent.toLowerCase().includes('portsmouth') || opponent.toLowerCase().includes('pompey'));
    const won = ourGoals > theirGoals;
    const lost = theirGoals > ourGoals;
    const drew = ourGoals === theirGoals;
    
    // DELMOR CRUNCHEM: Unsolicited taunts (especially after losses to Pompey)
    if (S.contacts.delmor_krunchem && S.contacts.delmor_krunchem.unlocked) {
      let sentGloatingMessage = false;
      
      // Season 4 & 5: Priority gloating texts about wife/daughter (if daughter left home)
      if ((S.season === 4 || S.season === 5) && S.season4 && S.season4.daughter_left_home) {
        // 50% chance to get a gloating message (higher priority than loss/scandal messages)
        if (Math.random() < 0.5) {
          const messageType = Math.random();
          let message = '';
          
          if (messageType < 0.5 && typeof RIVAL_SEASON4_5_DAUGHTER_MESSAGES !== 'undefined' && RIVAL_SEASON4_5_DAUGHTER_MESSAGES && RIVAL_SEASON4_5_DAUGHTER_MESSAGES.length > 0) {
            // Daughter message
            message = RIVAL_SEASON4_5_DAUGHTER_MESSAGES[Math.floor(Math.random() * RIVAL_SEASON4_5_DAUGHTER_MESSAGES.length)];
          } else if (typeof RIVAL_SEASON4_5_WIFE_MESSAGES !== 'undefined' && RIVAL_SEASON4_5_WIFE_MESSAGES && RIVAL_SEASON4_5_WIFE_MESSAGES.length > 0) {
            // Wife message
            message = RIVAL_SEASON4_5_WIFE_MESSAGES[Math.floor(Math.random() * RIVAL_SEASON4_5_WIFE_MESSAGES.length)];
          }
          
          if (message) {
            // Show as popup immediately
            if (typeof showRivalTextPopup === 'function') {
              showRivalTextPopup(message);
            } else {
              queueIncomingText('delmor_krunchem', message, 'malicious');
            }
            sentGloatingMessage = true;
          }
        }
      }
      
      // Only send loss/scandal messages if we didn't send a gloating message
      if (!sentGloatingMessage) {
        // High chance after loss to Pompey
        if (isPompey && lost) {
          const taunts = [
            'Scum lost to real team 😂. Pompey owns Southampton forever. Cry rivers loser.',
            'Your pathetic team got destroyed. Pompey 4 life! 🏆',
            'LMAO you lost again! When will you learn? Pompey runs this city.',
            'Another L for the scum. Pompey forever! 😂😂😂',
            'Your team is trash. We own you. Stay down, loser.'
          ];
          queueIncomingText('delmor_krunchem', taunts[Math.floor(Math.random() * taunts.length)], 'malicious');
        }
        // Medium chance after any loss (if we've lost to Pompey before)
        else if (lost && S.last_loss_to_pompey && Math.random() < 0.4) {
          const taunts = [
            'Another loss? Typical scum behavior 😂',
            'Your team is falling apart. Pompey would never.',
            'Keep losing, makes us look better!',
            'When\'s the next Pompey match? Can\'t wait to destroy you again.'
          ];
          queueIncomingText('delmor_krunchem', taunts[Math.floor(Math.random() * taunts.length)], 'malicious');
        }
        // Low chance random taunt (5% per match)
        else if (Math.random() < 0.05) {
          const taunts = [
            'Just checking in on the scum 😂',
            'Pompey still owns you. Never forget.',
            'Your team is a joke. We\'re the real deal.',
            'Remember when we beat you? Good times.'
          ];
          queueIncomingText('delmor_krunchem', taunts[Math.floor(Math.random() * taunts.length)], 'malicious');
        }
      }
    }
    
    // CAPTAIN: Unsolicited texts based on match performance
    if (S.contacts.captain && S.contacts.captain.unlocked) {
      if (won && Math.random() < 0.3) {
        const texts = ['Great game boss!', 'Thanks for the support', 'Team played well', 'We did it! 🎉'];
        queueIncomingText('captain', texts[Math.floor(Math.random() * texts.length)], 'friendly');
      } else if (lost && Math.random() < 0.2) {
        const texts = ['Sorry about the loss boss', 'We\'ll do better next time', 'Tough match'];
        queueIncomingText('captain', texts[Math.floor(Math.random() * texts.length)], 'professional');
      }
    }
    
    // CAPTAIN WIFE: Unsolicited texts (especially if captain scored)
    if (S.contacts.captain_wife && S.contacts.captain_wife.unlocked) {
      if (won && Math.random() < 0.25) {
        const texts = ['Hubby scored! 🎉', 'Great win!', 'So proud of him!', 'Amazing game!'];
        queueIncomingText('captain_wife', texts[Math.floor(Math.random() * texts.length)], 'friendly');
      }
      // Flirtatious texts if flirt level is high (10% chance)
      if (S.contacts.captain_wife.flirt_level >= 5 && Math.random() < 0.1) {
        const texts = ['Miss chatting 😘', 'Thinking of you...', 'Hubby\'s away tonight...', 'Want to talk? 😉'];
        queueIncomingText('captain_wife', texts[Math.floor(Math.random() * texts.length)], 'flirtatious');
      }
    }
    
    // MANAGER: Unsolicited texts
    if (S.contacts.manager && S.contacts.manager.unlocked) {
      if (won && Math.random() < 0.2) {
        const texts = ['Tactics worked', 'Good result', 'Team responded well', 'Solid performance'];
        queueIncomingText('manager', texts[Math.floor(Math.random() * texts.length)], 'professional');
      } else if (lost && Math.random() < 0.15) {
        const texts = ['Need to discuss tactics', 'Tough loss', 'We\'ll review the match'];
        queueIncomingText('manager', texts[Math.floor(Math.random() * texts.length)], 'professional');
      }
    }
    
    // SECRETARY: Unsolicited texts (if hired)
    if (S.contacts.secretary && S.contacts.secretary.unlocked && S.secretary_hired) {
      if (Math.random() < 0.15) {
        const texts = ['Quick update needed', 'Paperwork ready for review', 'Need your signature', 'Office running smoothly'];
        queueIncomingText('secretary', texts[Math.floor(Math.random() * texts.length)], 'professional');
      }
      // Flirtatious if relationship is good
      if (S.contacts.secretary.relation === 'flirty' && Math.random() < 0.1) {
        const texts = ['Hope you\'re having a good day 😊', 'Miss you at the office', 'Thinking of you'];
        queueIncomingText('secretary', texts[Math.floor(Math.random() * texts.length)], 'flirtatious');
      }
    }
    
    // BOOKIE MARCO: Unsolicited texts (if unlocked)
    if (S.contacts.bookie_marco && S.contacts.bookie_marco.unlocked) {
      if (Math.random() < 0.1) {
        const texts = ['New odds available', 'Stadium bet opportunity', 'Market update', 'Business opportunity'];
        queueIncomingText('bookie_marco', texts[Math.floor(Math.random() * texts.length)], 'professional');
      }
    }
    
    // Check for captain change
    updateCaptainContactNames();
    
    // Reduce cooldowns
    Object.keys(S.contacts || {}).forEach(id => {
      if (S.contacts[id].cooldown > 0) {
        S.contacts[id].cooldown--;
      }
    });
  }

  // Unlock Delmor after loss to Pompey
  function unlockDelmor() {
    initPhoneSystem();
    if (S.contacts.delmor_krunchem) {
      S.contacts.delmor_krunchem.unlocked = true;
      // First taunt is queued in checkPhoneEvents, but we can add an immediate one too
      if (!S.delmor_first_unlock_shown) {
        queueIncomingText('delmor_krunchem', 'Scum lost to real team 😂. Pompey owns Southampton forever. Cry rivers loser.', 'malicious');
        S.delmor_first_unlock_shown = true;
        log('📱 Delmor Krunchem (Portsmouth Chairman) has unlocked. He will now send unsolicited taunts.');
      }
    }
  }

  // After the post-match phase: phone events + Pompey-loss unlock
  GameHooks.on('postmatch:end', function() {
      checkPhoneEvents();
      
      // Check for Pompey loss
      if (S.matchContext && S.matchContext.opponent && 
          (S.matchContext.opponent.toLowerCase().includes('portsmouth') || 
           S.matchContext.opponent.toLowerCase().includes('pompey'))) {
        const ourGoals = S.lastMatchResult?.homeGoals || 0;
        const theirGoals = S.lastMatchResult?.awayGoals || 0;
        if (theirGoals > ourGoals) {
          S.last_loss_to_pompey = true;
          unlockDelmor();
        }
      }
  });

  // Initialize the phone system once S exists
  GameHooks.on('init', function() { initPhoneSystem(); });
  window.openContactChat = openContactChat; // 087s/087t re-open a chat after a thread

})();