// game.js - PVZ Heroes Wordle Game Functionality (Hard Mode version)

let plantsData = []; // Store all plant cards
let zombiesData = []; // Store all zombie cards
let cardsData = []; // Store current game mode cards
let targetCard = null; // The card the player needs to guess
let guessHistory = []; // Store all guesses
let hardMode = false; // Hard mode toggle
let lastEndlessCard = null; // Track last card in endless mode to avoid immediate repeats

const rarityRank = {
   "Token": 1,
   "Common": 2,
   "Uncommon": 3,
   "Rare": 4,
   "Event": 5,
   "Super-Rare": 6,
   "Legendary": 7
};

let victoryTimeout = null; // Store victory screen timeout
let loadVictoryTimeout = null;

// Load cards from both CSV files
async function loadCards() {
   try {
       const plantsResponse = await fetch('plants.csv');
       const plantsText = await plantsResponse.text();
       const zombiesResponse = await fetch('zombies.csv');
       const zombiesText = await zombiesResponse.text();

       if (typeof Papa === 'undefined') {
           console.error('PapaParse library not loaded!');
           return;
       }

       const parsedPlants = Papa.parse(plantsText, {
           header: true,
           dynamicTyping: true,
           skipEmptyLines: true
       });

       const parsedZombies = Papa.parse(zombiesText, {
           header: true,
           dynamicTyping: true,
           skipEmptyLines: true
       });

       plantsData = parsedPlants.data.map(card => processCard(card));
       zombiesData = parsedZombies.data.map(card => processCard(card));

   } catch (error) {
       console.error('Error loading cards:', error);
   }
}

// Process a card to split arrays and handle null values
function processCard(card) {
   return {
       ...card,
       class: card.class ? card.class.split(',').map(c => c.trim()) : [],
       tribe: card.tribe ? card.tribe.split(',').map(t => t.trim()) : [],
       trait: card.trait ? card.trait.split(',').map(t => t.trim()) : [],
       strength: (card.strength !== undefined && card.strength !== '') ? card.strength : null,
       health: (card.health !== undefined && card.health !== '') ? card.health : null
   };
}

function showMessage(text, duration = 3000) {
   const messageDiv = document.getElementById('messageBox');
   messageDiv.textContent = text;
   messageDiv.classList.add('show');
   
   setTimeout(() => {
       messageDiv.classList.remove('show');
   }, duration);
}

function startGame(mode) {
   // Clear any pending victory screen timeouts when starting a new game
   if (victoryTimeout) {
       clearTimeout(victoryTimeout);
       victoryTimeout = null;
   }
   if (loadVictoryTimeout) {
       clearTimeout(loadVictoryTimeout);
       loadVictoryTimeout = null;
   }
   
   if (plantsData.length === 0 || zombiesData.length === 0) {
       showMessage('Cards are still loading, please wait...');
       return;
   }

   if (mode === 'classic') {
       cardsData = [...plantsData, ...zombiesData];
   } else if (mode === 'plants') {
       cardsData = plantsData;
   } else if (mode === 'zombies') {
       cardsData = zombiesData;
   } else if (mode === 'endless') {
       cardsData = [...plantsData, ...zombiesData];
   }

   if (cardsData.length === 0) {
       showMessage('No cards available for this mode!');
       return;
   }

   document.body.style.overflow = 'auto';
   document.body.classList.add('game-active');
   document.querySelector('.menu-buttons').style.display = 'none';
   
   // Reset guess bar completely - make sure it's visible
   const guessBar = document.getElementById('guessBar');
   guessBar.classList.add('active');
   guessBar.style.display = 'block'; // Changed from '' to 'block' to ensure it's visible
   guessBar.style.opacity = '1';
   guessBar.style.transition = '';
   
   document.getElementById('guessInput').focus();

   const hardModeBtn = document.getElementById('hardModeBtn');
   if (hardModeBtn) {
       hardModeBtn.style.display = 'block';
       hardModeBtn.classList.remove('locked'); // Remove locked state when starting new game
   }

   window.currentGameMode = mode;
   
   // For endless mode, always start fresh - don't load saved state
   if (mode === 'endless') {
       guessHistory = [];
       window.gameWon = false;
       targetCard = null;
       // Reset hard mode for endless
       hardMode = false;
       if (hardModeBtn) {
           hardModeBtn.classList.remove('active');
           hardModeBtn.textContent = 'Easy Mode';
           hardModeBtn.setAttribute('data-tooltip', 'Easy Mode: No restrictions for guessing');
       }
   } else {
       // Load saved game state for daily modes (this will set hardMode correctly)
       loadGameState(mode);
   }
   
   document.getElementById('boxContainer').innerHTML = '';
   startClassicMode();
}

function startClassicMode() {
   // Set target card if not already set
   if (!targetCard) {
       if (window.currentGameMode === 'endless') {
           // For endless mode, avoid repeating the same card twice in a row
           let newCard;
           let attempts = 0;
           do {
               newCard = cardsData[Math.floor(Math.random() * cardsData.length)];
               attempts++;
           } while (lastEndlessCard && newCard.name === lastEndlessCard.name && attempts < 50);
           
           targetCard = newCard;
           lastEndlessCard = newCard;
       } else {
           targetCard = getDailyCard(window.currentGameMode);
       }
   }
  
   addHeaderRow();
   
   if (window.gameWon) {
       // CHANGED: For won games, wait for render then fade out
       guessHistory.forEach(guessedCard => {
           const matches = compareCards(guessedCard, targetCard);
           addGuessRow(matches, guessedCard, true);
       });
       
       // Only apply dynamic margin on mobile (480px and below)
       if (window.innerWidth <= 480) {
           const marginPerGuess = 40;
           const marginAmount = guessHistory.length * marginPerGuess;
           document.getElementById('boxContainer').style.marginBottom = `${marginAmount}px`;
       } else if (guessHistory.length >= 5) {
           // Desktop: keep original behavior (75px after 5 guesses)
           document.getElementById('boxContainer').style.marginBottom = '75px';
       }
       
       // Wait for the page to fully render the guess bar
       setTimeout(() => {
           const guessBar = document.getElementById('guessBar');
           if (guessBar) {
               // Ensure it's visible and has no transition yet
               guessBar.style.opacity = '1';
               guessBar.style.transition = 'none';
               
               // Force reflow
               void guessBar.offsetHeight;
               
               // Now add transition and start fading
               guessBar.style.transition = 'opacity 0.5s ease';
               
               // Start fade after a tiny delay
               requestAnimationFrame(() => {
                   requestAnimationFrame(() => {
                       guessBar.style.opacity = '0';
                   });
               });
               
               // Remove from layout after fade completes
               setTimeout(() => {
                   guessBar.style.display = 'none';
               }, 500);
           }
       }, 100);
       
       // Clear any existing load victory timeout before setting a new one
       if (loadVictoryTimeout) {
           clearTimeout(loadVictoryTimeout);
       }
       loadVictoryTimeout = setTimeout(() => {
           // Only show victory screen if still in game (not back at menu)
           if (document.body.classList.contains('game-active')) {
               showVictoryScreen(targetCard);
               setTimeout(() => {
                   const victoryBox = document.querySelector('.victory-box');
                   if (victoryBox) {
                       victoryBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
                   }
               }, 150);
           }
           loadVictoryTimeout = null;
       }, 700); // Wait for fade to complete (100ms + 500ms + 100ms buffer)
   } else {
       guessHistory.forEach(guessedCard => {
           const matches = compareCards(guessedCard, targetCard);
           addGuessRow(matches, guessedCard, true);
       });
       
       // Only apply dynamic margin on mobile (480px and below)
       if (window.innerWidth <= 480) {
           const marginPerGuess = 40;
           const marginAmount = guessHistory.length * marginPerGuess;
           document.getElementById('boxContainer').style.marginBottom = `${marginAmount}px`;
       } else if (guessHistory.length >= 5) {
           // Desktop: keep original behavior (75px after 5 guesses)
           document.getElementById('boxContainer').style.marginBottom = '75px';
       }
   }
  
   setupAutocomplete();
}

function addHeaderRow() {
   const boxContainer = document.getElementById('boxContainer');
   const headerRow = document.createElement('div');
   headerRow.className = 'header-row';

   const headers = [
       'Card', 'Class', 'Cost', 'Strength', 'Health',
       'Tribe', 'Trait', 'Type', 'Rarity', 'Set'
   ];

   headers.forEach(label => {
       const div = document.createElement('div');
       div.className = 'header-label';
       div.textContent = label;
       headerRow.appendChild(div);
   });

   boxContainer.appendChild(headerRow);
}

// Autocomplete functionality
function setupAutocomplete() {
   const input = document.getElementById('guessInput');
   const dropdown = document.getElementById('autocompleteDropdown');

   input.value = '';
   dropdown.innerHTML = '';
   dropdown.classList.remove('active');

   input.oninput = function() {
       if (window.gameWon) {
           dropdown.innerHTML = '';
           dropdown.classList.remove('active');
           return;
       }
      
       const value = this.value.trim().toLowerCase();
       if (value.length === 0) {
           dropdown.innerHTML = '';
           dropdown.classList.remove('active');
           return;
       }

       const matches = cardsData.filter(card => {
           if (!card.name || guessHistory.some(g => g.name === card.name)) {
               return false;
           }

           const cardNameLower = card.name.toLowerCase();
           const words = cardNameLower.split(/\s+/);
           return words.some(word => word.startsWith(value));
       }).slice(0, 10);

       if (matches.length > 0) {
           dropdown.innerHTML = matches.map(card => {
               const iconHtml = card.icon ? `<img src="images/${card.icon}" class="autocomplete-icon" alt="${card.name}">` : '';
               return `<div class="autocomplete-item" data-name="${card.name}">
                   ${iconHtml}<span>${card.name}</span>
               </div>`;
           }).join('');
           dropdown.classList.add('active');

           dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
               item.onclick = function() {
                   if (window.gameWon) return;
                  
                   input.value = this.dataset.name;
                   dropdown.innerHTML = '';
                   dropdown.classList.remove('active');
                   guess();
               };
           });
       } else {
           dropdown.innerHTML = '';
           dropdown.classList.remove('active');
       }
   };

   input.onkeydown = function(e) {
       if (e.key === 'Enter') {
           e.preventDefault();
           if (window.gameWon) return;
           guess();
       } else if (e.key === 'Escape') {
           dropdown.innerHTML = '';
           dropdown.classList.remove('active');
       }
   };
}

function guess() {
   const input = document.getElementById('guessInput');
   const dropdown = document.getElementById('autocompleteDropdown');
   const guessText = input.value.trim();

   const guessedCard = cardsData.find(card =>
       card.name && card.name.toLowerCase() === guessText.toLowerCase()
   );

   if (guessedCard) {
       if (guessHistory.some(g => g.name === guessedCard.name)) {
           showMessage('You already guessed this card!');
           input.value = '';
           return;
       }

       if (hardMode && guessHistory.length > 0) {
           if (!validateHardModeGuess(guessedCard)) {
               showMessage('Invalid guess: does not match all revealed hints');
               input.value = '';
               return;
           }
       }

       const matches = compareCards(guessedCard, targetCard);
       addGuessRow(matches, guessedCard, false); // false = show animation
       guessHistory.push(guessedCard);

       if (guessHistory.length === 1 && hardMode) {
           const btn = document.getElementById('hardModeBtn');
           if (btn) {
               btn.classList.add('locked');
           }
       }

        if (guessedCard.name === targetCard.name) {
            window.gameWon = true;
            // Save state for daily modes when won
            if (window.currentGameMode !== 'endless') {
                updateStats(guessHistory.length);  // This line already exists
                updateGlobalStats(guessHistory.length); // ADD THIS LINE
                saveGameState(window.currentGameMode);
            }
            // Clear any existing victory timeout before setting a new one
            if (victoryTimeout) {
                clearTimeout(victoryTimeout);
            }
            victoryTimeout = setTimeout(() => {
                // Only show victory screen if still in game (not back at menu)
                if (document.body.classList.contains('game-active')) {
                    showVictoryScreen(guessedCard);
                }
                victoryTimeout = null;
            }, 3700);
        }
   } else {
       showMessage('Card not found! Please select a valid card from the dropdown.');
   }

   input.value = '';
   dropdown.innerHTML = '';
   dropdown.classList.remove('active');
   input.focus();
   
   // Only apply dynamic margin on mobile (480px and below)
   if (window.innerWidth <= 480) {
       const marginPerGuess = 40;
       const marginAmount = guessHistory.length * marginPerGuess;
       document.getElementById('boxContainer').style.marginBottom = `${marginAmount}px`;
   } else if (guessHistory.length >= 5) {
       // Desktop: keep original behavior (75px after 5 guesses)
       document.getElementById('boxContainer').style.marginBottom = '75px';
   } else {
       // Desktop: reset margin if less than 5 guesses
       document.getElementById('boxContainer').style.marginBottom = '';
   }
}

function validateHardModeGuess(guessedCard) {
   const props = ['class', 'cost', 'strength', 'health', 'tribe', 'trait', 'type', 'rarity', 'set'];
  
   const constraints = {};
  
   for (const prop of props) {
       constraints[prop] = {
           mustBeExactly: null,
           mustIncludeOneOf: []
       };
   }
  
   for (const previousGuess of guessHistory) {
       const matches = compareCards(previousGuess, targetCard);
      
       for (const prop of props) {
           const color = matches[prop];
           const previousValue = previousGuess[prop];
           const targetValue = targetCard[prop];
          
           // Only enforce GREEN constraints (exact matches)
           if (color === 'green') {
               constraints[prop].mustBeExactly = previousValue;
           } 
           // For YELLOW: only enforce for array properties (class, tribe, trait)
           // Yellow means at least one value from the guess exists in target
           // In hard mode, you must reuse at least one of the guessed values that caused yellow
           else if (color === 'yellow' && ['class', 'tribe', 'trait'].includes(prop)) {
               const guessedArray = Array.isArray(previousValue) ? previousValue : [previousValue];
               
               // Store the values from YOUR guess (not the overlapping ones)
               // This way, you must reuse at least one value from what you guessed
               if (guessedArray.length > 0) {
                   constraints[prop].mustIncludeOneOf.push(...guessedArray);
               }
           }
           // Note: RED is completely ignored - no constraints added
       }
   }
  
   // Validate the new guess against constraints
   for (const prop of props) {
       const newValue = guessedCard[prop];
       const constraint = constraints[prop];
      
       // Check GREEN constraint (must be exactly this value)
       if (constraint.mustBeExactly !== null) {
           if (Array.isArray(constraint.mustBeExactly)) {
               if (!Array.isArray(newValue)) return false;
               const sorted1 = [...constraint.mustBeExactly].sort().join(',');
               const sorted2 = [...newValue].sort().join(',');
               if (sorted1 !== sorted2) return false;
           } else {
               if (newValue !== constraint.mustBeExactly) return false;
           }
       }
      
       // Check YELLOW constraint (must include at least one of these values)
       if (constraint.mustIncludeOneOf.length > 0) {
           const uniqueIncludes = [...new Set(constraint.mustIncludeOneOf)];
           let foundAtLeastOne = false;
          
           for (const mustIncludeValue of uniqueIncludes) {
               if (Array.isArray(newValue)) {
                   if (newValue.includes(mustIncludeValue)) {
                       foundAtLeastOne = true;
                       break;
                   }
               } else {
                   if (newValue === mustIncludeValue) {
                       foundAtLeastOne = true;
                       break;
                   }
               }
           }
          
           if (!foundAtLeastOne) return false;
       }
   }
  
   return true;
}

function compareArray(guessedArray, targetArray) {
   const guessed = Array.isArray(guessedArray) ? guessedArray : [guessedArray];
   const target = Array.isArray(targetArray) ? targetArray : [targetArray];
   const guessedClean = guessed.filter(t => t && t !== '');
   const targetClean = target.filter(t => t && t !== '');

   // Both empty = green
   if (guessedClean.length === 0 && targetClean.length === 0) return 'green';
   
   // Exact match (same items, same length) = green
   if (guessedClean.length === targetClean.length && 
       guessedClean.every(t => targetClean.includes(t)) &&
       targetClean.every(t => guessedClean.includes(t))) return 'green';
   
   // Partial overlap = yellow
   if (guessedClean.some(t => targetClean.includes(t))) return 'yellow';
   
   // No overlap = red
   return 'red';
}

function compareNumeric(guessedValue, targetValue) {
   if (guessedValue === null && targetValue === null) return 'green';
   if (guessedValue === null || targetValue === null) return 'red';
   if (guessedValue === targetValue) return 'green';
   return 'red';
}

function compareCards(guessed, target) {
   function arrow(v1, v2) {
       if (v1 === null || v2 === null) return null;
       if (v1 > v2) return "down";
       if (v1 < v2) return "up";
       return null;
   }

   return {
       class: compareArray(guessed.class, target.class),
       cost: guessed.cost === target.cost ? 'green' : 'red',
       strength: compareNumeric(guessed.strength, target.strength),
       health: compareNumeric(guessed.health, target.health),
       tribe: compareArray(guessed.tribe, target.tribe),
       trait: compareArray(guessed.trait, target.trait),
       type: guessed.type === target.type ? 'green' : 'red',
       rarity: guessed.rarity === target.rarity ? 'green' : 'red',
       set: guessed.set === target.set ? 'green' : 'red',
       arrows: {
           cost: arrow(guessed.cost, target.cost),
           strength: arrow(guessed.strength, target.strength),
           health: arrow(guessed.health, target.health),
           rarity: arrow(rarityRank[guessed.rarity], rarityRank[target.rarity])
       }
   };
}

function addGuessRow(matches, guessedCard, skipAnimation = false) {
   const boxContainer = document.getElementById('boxContainer');
   
   // Create new row
   const row = document.createElement('div');
   row.className = 'box-row';
   
   // Properties to display
   const properties = ['icon', 'class', 'cost', 'strength', 'health', 'tribe', 'trait', 'type', 'rarity', 'set'];
   
   properties.forEach((prop, index) => {
       const box = document.createElement('div');
       box.className = 'box';
       
       if (prop === 'icon') {
           if (guessedCard.icon) {
               const img = document.createElement('img');
               img.src = `images/${guessedCard.icon}`;
               img.alt = guessedCard.name;
               img.className = 'card-icon-box';
               box.appendChild(img);
           }
           box.classList.add('icon-box');
           // Icon appears immediately - no animation
       } else {
           const color = matches[prop];
           box.classList.add(color);
           
           let displayValue = guessedCard[prop];
           if (Array.isArray(displayValue)) displayValue = displayValue.join(', ');
           if (displayValue === null || displayValue === undefined || displayValue === '') displayValue = '-';
           
           // Arrow overlay for numeric/ranked fields
           if (['cost', 'strength', 'health', 'rarity'].includes(prop)) {
               const wrapper = document.createElement("div");
               wrapper.classList.add("number-wrapper");

               const arrowDir = matches.arrows[prop];
               if (arrowDir) {
                   const arrowImg = document.createElement("img");
                   arrowImg.src = arrowDir === "up" ? "images/up.png" : "images/down.png";
                   arrowImg.className = arrowDir === "up" ? "arrow-up-icon" : "arrow-down-icon";
                   wrapper.appendChild(arrowImg);
               }

               const num = document.createElement("span");
               num.textContent = displayValue;
               num.classList.add("number-text");
               wrapper.appendChild(num);
               box.appendChild(wrapper);
           } else {
               box.textContent = displayValue;
           }
           
           if (skipAnimation) {
               // No animation - show immediately
               box.style.opacity = '1';
               box.style.transform = 'translateY(0)';
           } else {
               // Fade in animation for non-icon boxes (left to right)
               box.style.opacity = '0';
               box.style.transform = 'translateY(-10px)';
               box.style.transition = 'opacity 1s ease, transform 0.5s ease';
               
               // Delay increases for each box from left to right
               // index-1 because icon is index 0 and doesn't animate
               setTimeout(() => {
                   box.style.opacity = '1';
                   box.style.transform = 'translateY(0)';
               }, (index - 1) * 400); // 400ms delay between each box
           }
       }
       row.appendChild(box);
   });
   
   // Insert new row at the TOP (after header row)
   const headerRow = boxContainer.querySelector('.header-row');
   if (headerRow && headerRow.nextSibling) {
       boxContainer.insertBefore(row, headerRow.nextSibling);
   } else {
       boxContainer.appendChild(row);
   }
}

async function showVictoryScreen(card) {
   const boxContainer = document.getElementById('boxContainer');
   
   // Hide and disable the guess bar
   const guessBar = document.getElementById('guessBar');
   if (guessBar) {
       guessBar.style.display = 'none';
   }
   
   // Victory box
   const victoryBox = document.createElement('div');
   victoryBox.className = 'victory-box';
   victoryBox.style.marginTop = '30px';

   const title = document.createElement('div');
   title.className = 'victory-title';
   title.textContent = 'You guessed correctly!';
   victoryBox.appendChild(title);

   const cardName = document.createElement('div');
   cardName.className = 'victory-card-name';
   cardName.textContent = card.name;
   victoryBox.appendChild(cardName);

   if (card.icon) {
       const iconContainer = document.createElement('div');
       iconContainer.className = 'victory-icon-container';
       const icon = document.createElement('img');
       icon.src = `images/${card.icon}`;
       icon.alt = card.name;
       icon.className = 'victory-icon';
       iconContainer.appendChild(icon);
       victoryBox.appendChild(iconContainer);
   }

   const tries = document.createElement('div');
   tries.className = 'victory-tries';
   const tryText = guessHistory.length === 1 ? 'try' : 'tries';
   tries.textContent = `Number of ${tryText}: ${guessHistory.length}`;
   victoryBox.appendChild(tries);

   // For endless mode, show total wins
   if (window.currentGameMode === 'endless') {
       let endlessStats = localStorage.getItem('endlessStats');
       if (!endlessStats) {
           endlessStats = { easyWins: 0, hardWins: 0 };
       } else {
           endlessStats = JSON.parse(endlessStats);
       }
       
       if (hardMode) {
           endlessStats.hardWins = (endlessStats.hardWins || 0) + 1;
       } else {
           endlessStats.easyWins = (endlessStats.easyWins || 0) + 1;
       }
       
       localStorage.setItem('endlessStats', JSON.stringify(endlessStats));
       
       const totalWins = document.createElement('div');
       totalWins.className = 'victory-tries';
       totalWins.style.fontSize = '18px';
       totalWins.style.marginTop = '10px';
       if (hardMode) {
           totalWins.textContent = `Total hard mode wins: ${endlessStats.hardWins}`;
       } else {
           totalWins.textContent = `Total easy mode wins: ${endlessStats.easyWins}`;
       }
       victoryBox.appendChild(totalWins);
   }

   // Only show countdown for non-endless modes
   if (window.currentGameMode !== 'endless') {
       const nextCardLabel = document.createElement('div');
       nextCardLabel.className = 'victory-next-label';
       nextCardLabel.textContent = 'Next card in';
       victoryBox.appendChild(nextCardLabel);

       const countdown = document.createElement('div');
       countdown.className = 'victory-countdown';
       countdown.id = 'victoryCountdown';
       victoryBox.appendChild(countdown);

       const divider = document.createElement('div');
       divider.style.width = '100%';
       divider.style.height = '2px';
       divider.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
       divider.style.margin = '20px 0';
       victoryBox.appendChild(divider);
   }

   const nextModeLabel = document.createElement('div');
   nextModeLabel.className = 'victory-next-mode-label';
   
   if (window.currentGameMode === 'endless') {
       nextModeLabel.textContent = 'Play Again:';
   } else {
       nextModeLabel.textContent = 'Next Mode:';
   }
   victoryBox.appendChild(nextModeLabel);

   const currentMode = window.currentGameMode;
   let nextMode, nextModeName, nextModeIcon;
   
   if (currentMode === 'classic') {
       nextMode = 'plants';
       nextModeName = 'Plants';
       nextModeIcon = 'images/plant_icon.png';
   } else if (currentMode === 'plants') {
       nextMode = 'zombies';
       nextModeName = 'Zombies';
       nextModeIcon = 'images/zombie_icon.png';
   } else if (currentMode === 'zombies') {
       nextMode = 'endless';
       nextModeName = 'Endless';
       nextModeIcon = 'images/endless.png';
   } else if (currentMode === 'endless') {
       nextMode = 'endless';
       nextModeName = 'Play Again';
       nextModeIcon = 'images/endless.png';
   }

   const modeIconClickable = document.createElement('img');
   modeIconClickable.src = nextModeIcon;
   modeIconClickable.alt = nextModeName;
   modeIconClickable.className = 'victory-mode-icon-clickable';
   modeIconClickable.onclick = function() {
       if (currentMode === 'endless') {
           guessHistory = [];
           window.gameWon = false;
           targetCard = null;
           document.getElementById('boxContainer').innerHTML = '';
           startGame('endless');
       } else {
           startGame(nextMode);
       }
   };
   modeIconClickable.onerror = function() {
       this.style.display = 'none';
   };
   victoryBox.appendChild(modeIconClickable);

   if (window.currentGameMode !== 'endless') {
       const modeName = document.createElement('div');
       modeName.className = 'victory-mode-name';
       modeName.textContent = nextModeName;
       victoryBox.appendChild(modeName);
   }

   // CHANGED: Button now calls showGlobalStatsPopup instead of showStatsPopup
   if (window.currentGameMode !== 'endless') {
        const statsButton = document.createElement('button');
        statsButton.className = 'stats-button';
        statsButton.textContent = '📊 Compare Results';
        statsButton.onclick = () => showGlobalStatsPopup(); // CHANGED THIS LINE
        victoryBox.appendChild(statsButton);
    }  

   const proceedText = document.createElement('div');
   proceedText.className = 'victory-proceed-text';
   proceedText.textContent = 'Click the icon to proceed';
   victoryBox.appendChild(proceedText);

   boxContainer.appendChild(victoryBox);
   
   // Share box and countdown for non-endless modes
   if (window.currentGameMode !== 'endless') {
       const shareBox = document.createElement('div');
       shareBox.className = 'share-box';
       shareBox.style.marginTop = '20px';

       const shareTitle = document.createElement('div');
       shareTitle.className = 'share-title';
       shareTitle.innerHTML = '🎉 Great job!';
       shareBox.appendChild(shareTitle);

       const shareSubtitle = document.createElement('div');
       shareSubtitle.className = 'share-subtitle';
       shareSubtitle.textContent = 'Share your results';
       shareBox.appendChild(shareSubtitle);

       const resultsBox = document.createElement('div');
       resultsBox.className = 'share-results-box';
       
       const getModeResult = (mode) => {
           const savedState = loadGameStateForMode(mode);
           if (savedState) {
               const tries = savedState.guessHistory.length;
               const tryText = tries === 1 ? 'try' : 'tries';
               
               if (savedState.gameWon) {
                   let emoji;
                   if (tries === 1) emoji = '🥇';
                   else if (tries === 2) emoji = '🥈';
                   else if (tries === 3) emoji = '🥉';
                   else emoji = '🔥';
                   return `${tries} ${tryText} ${emoji}`;
               } else if (tries > 0) {
                   return `${tries} ${tryText} ❌`;
               }
           }
           return '0 tries ❌';
       };
       
       const getModeName = (mode) => {
           const savedState = loadGameStateForMode(mode);
           const difficulty = (savedState && savedState.hardMode) ? 'hard' : 'easy';
           const modeName = mode.charAt(0).toUpperCase() + mode.slice(1);
           return `${modeName} ${difficulty} mode`;
       };
       
       const resultsText = `My PvZ Heroes Wordle results for today:

${getModeName('classic')}: ${getModeResult('classic')}
${getModeName('plants')}: ${getModeResult('plants')}
${getModeName('zombies')}: ${getModeResult('zombies')}

https://pvzheroeswordle.com`;
       
       resultsBox.textContent = resultsText;
       shareBox.appendChild(resultsBox);

       const copyButton = document.createElement('button');
       copyButton.className = 'share-copy-button';
       copyButton.innerHTML = '📋 Copy';
       copyButton.onclick = function() {
           navigator.clipboard.writeText(resultsText).then(() => {
               copyButton.innerHTML = '✅ Copied!';
               setTimeout(() => {
                   copyButton.innerHTML = '📋 Copy';
               }, 2000);
           }).catch(err => {
               console.error('Failed to copy:', err);
               alert('Failed to copy to clipboard');
           });
       };
       shareBox.appendChild(copyButton);

       boxContainer.appendChild(shareBox);
       
       startCountdown();
   }
   
   setTimeout(() => {
       victoryBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
   }, 100);
}

function updateStats(numGuesses) {
    const mode = window.currentGameMode;
    if (mode === 'endless') return;
    
    const difficulty = hardMode ? 'hard' : 'easy';
    const statsKey = `stats_${mode}_${difficulty}`;
    
    let stats = localStorage.getItem(statsKey);
    if (!stats) {
        stats = {
            1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 
            6: 0, 7: 0, 8: 0, 9: 0, '10+': 0,
            totalGames: 0
        };
    } else {
        stats = JSON.parse(stats);
    }
    
    if (numGuesses <= 10) {
        stats[numGuesses]++;
    } else {
        stats['10+']++;
    }
    stats.totalGames++;
    
    localStorage.setItem(statsKey, JSON.stringify(stats));
}

function showStatsPopup() {
    const mode = window.currentGameMode;
    if (mode === 'endless') return;
    
    const difficulty = hardMode ? 'hard' : 'easy';
    const statsKey = `stats_${mode}_${difficulty}`;
    
    let stats = localStorage.getItem(statsKey);
    if (!stats) {
        stats = {
            1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 
            6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 
            '10+': 0,
            totalGames: 0
        };
    } else {
        stats = JSON.parse(stats);
    }
    
    const overlay = document.createElement('div');
    overlay.className = 'stats-popup-overlay';
    overlay.onclick = () => overlay.remove();
    
    const content = document.createElement('div');
    content.className = 'stats-popup-content';
    content.onclick = (e) => e.stopPropagation();
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'stats-close-btn';
    closeBtn.textContent = '✕';
    closeBtn.onclick = () => overlay.remove();
    content.appendChild(closeBtn);
    
    const title = document.createElement('div');
    title.className = 'stats-title';
    const modeName = mode.charAt(0).toUpperCase() + mode.slice(1);
    const difficultyName = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
    title.textContent = `${modeName} - ${difficultyName} Mode`;
    content.appendChild(title);
    
    const subtitle = document.createElement('div');
    subtitle.className = 'stats-subtitle';
    subtitle.textContent = 'GUESS DISTRIBUTION';
    content.appendChild(subtitle);
    
    const statsContainer = document.createElement('div');
    statsContainer.className = 'stats-container';
    
    const maxCount = Math.max(
        stats[1], stats[2], stats[3], stats[4], stats[5],
        stats[6], stats[7], stats[8], stats[9], stats['10+']
    );
    
    const guessCategories = [1, 2, 3, 4, 5, 6, 7, 8, 9, '10+'];
    
    guessCategories.forEach(guessNum => {
        const count = stats[guessNum];
        const percentage = stats.totalGames > 0 
            ? ((count / stats.totalGames) * 100).toFixed(1)
            : 0;
        
        const row = document.createElement('div');
        row.className = 'stats-row';
        
        const label = document.createElement('div');
        label.className = 'stats-label';
        label.textContent = guessNum;
        row.appendChild(label);
        
        const barContainer = document.createElement('div');
        barContainer.className = 'stats-bar-container';
        
        const bar = document.createElement('div');
        bar.className = 'stats-bar';
        
        if (window.gameWon && guessHistory.length === guessNum) {
            bar.classList.add('current-guess');
        }
        
        const barWidth = maxCount > 0 && count > 0
            ? Math.max(20, (count / maxCount) * 100)
            : 0;
        bar.style.width = `${barWidth}%`;
        
        const barText = document.createElement('span');
        barText.className = 'stats-bar-text';
        barText.textContent = `${count} (${percentage}%)`;
        bar.appendChild(barText);
        
        barContainer.appendChild(bar);
        row.appendChild(barContainer);
        
        statsContainer.appendChild(row);
    });
    
    content.appendChild(statsContainer);
    
    const totalGames = document.createElement('div');
    totalGames.className = 'stats-total';
    totalGames.textContent = `Total Games: ${stats.totalGames}`;
    content.appendChild(totalGames);
    
    overlay.appendChild(content);
    document.body.appendChild(overlay);
}

function startCountdown() {
   const countdownElement = document.getElementById('victoryCountdown');
   function updateCountdown() {
       const now = new Date();
       
       // Get current time in Pacific Time using proper UTC offset
       const pacificTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
       
       // Set next reset time to 10:00 AM Pacific Time
       let nextReset = new Date(pacificTime);
       nextReset.setHours(10, 0, 0, 0);
       
       // If we've already passed 10 AM today, set to tomorrow
       if (pacificTime >= nextReset) {
           nextReset.setDate(nextReset.getDate() + 1);
       }
       
       // Calculate difference
       const diff = nextReset - pacificTime;
       const hours = Math.floor(diff / (1000 * 60 * 60));
       const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
       const seconds = Math.floor((diff % (1000 * 60)) / 1000);
       countdownElement.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
   }
   updateCountdown();
   setInterval(updateCountdown, 1000);
}

function autoNormalizeAndCenterIcon(imgElement) {
   const img = new Image();
   img.src = imgElement.src;

   img.onload = function () {
       const canvas = document.createElement("canvas");
       canvas.width = img.width;
       canvas.height = img.height;
       const ctx = canvas.getContext("2d");
       ctx.drawImage(img, 0, 0);
       const { data } = ctx.getImageData(0, 0, img.width, img.height);

       let left = img.width, right = 0, top = img.height, bottom = 0;
       let found = false;

       for (let y = 0; y < img.height; y++) {
           for (let x = 0; x < img.width; x++) {
               const alpha = data[(y * img.width + x) * 4 + 3];
               if (alpha > 10) {
                   found = true;
                   if (x < left) left = x;
                   if (x > right) right = x;
                   if (y < top) top = y;
                   if (y > bottom) bottom = y;
               }
           }
       }

       if (!found) return;

       const emptyLeft = left;
       const emptyRight = img.width - right;
       const emptyTop = top;
       const emptyBottom = img.height - bottom;

       const shiftX = (emptyLeft - emptyRight) / 2;
       const shiftY = (emptyTop - emptyBottom) / 2;

       const TARGET_VISIBLE_WIDTH = 250;
       const visibleWidth = right - left;
       const scale = TARGET_VISIBLE_WIDTH / visibleWidth;

       imgElement.style.transform =
           `translate(${shiftX}px, ${shiftY}px) scale(${scale})`;
   };
}

function toggleHardMode() {
   const btn = document.getElementById('hardModeBtn');
   
   if (guessHistory.length > 0) {
       showMessage('Hard Mode cannot be changed once you have started guessing!');
       return;
   }
   
   hardMode = !hardMode;
   
   // Don't save globally - it will be saved per-game when you make a guess
   
   if (hardMode) {
       btn.classList.add('active');
       btn.textContent = 'Hard Mode';
       btn.setAttribute('data-tooltip', 'Hard Mode: Any revealed hints must be used in subsequent guesses');
   } else {
       btn.classList.remove('active');
       btn.textContent = 'Easy Mode';
       btn.setAttribute('data-tooltip', 'Easy Mode: No restrictions for guessing');
   }
}

loadCards();

document.addEventListener('DOMContentLoaded', function() {
   const hardModeBtn = document.getElementById('hardModeBtn');
   if (hardModeBtn) {
       hardModeBtn.style.display = 'none';
       // Always start with Easy Mode as default
       hardModeBtn.classList.remove('active');
       hardModeBtn.textContent = 'Easy Mode';
       hardModeBtn.setAttribute('data-tooltip', 'Easy Mode: No restrictions for guessing');
   }

   const logo = document.querySelector('.title');
   if (logo) logo.addEventListener('click', () => resetToMenu());
});

function resetToMenu() {
   // Clear any pending victory screen timeouts
   if (victoryTimeout) {
       clearTimeout(victoryTimeout);
       victoryTimeout = null;
   }
   if (loadVictoryTimeout) {
       clearTimeout(loadVictoryTimeout);
       loadVictoryTimeout = null;
   }


   document.body.classList.remove('game-active');
   document.body.style.overflow = 'hidden';
   
   document.querySelector('.menu-buttons').style.display = 'flex';
   const guessBar = document.getElementById('guessBar');
   guessBar.classList.remove('active');
   guessBar.style.display = '';
   guessBar.style.opacity = '1'; // CHANGED: Reset opacity
   guessBar.style.transition = ''; // CHANGED: Reset transition
   document.getElementById('boxContainer').innerHTML = '';
   
   document.getElementById('boxContainer').style.marginBottom = '';
   
   const hardModeBtn = document.getElementById('hardModeBtn');
   if (hardModeBtn) {
       hardModeBtn.classList.remove('locked');
       hardModeBtn.style.display = 'none';
   }
   
   window.scrollTo({ top: 0, behavior: 'smooth' });
}
// Info popup functions
function showInfoPopup() {
   const popup = document.getElementById('infoPopup');
   if (popup) {
       popup.classList.add('active');
   }
}

function closeInfoPopup() {
   const popup = document.getElementById('infoPopup');
   if (popup) {
       popup.classList.remove('active');
   }
}

// Close popup with Escape key
document.addEventListener('keydown', function(e) {
   if (e.key === 'Escape') {
       closeInfoPopup();
   }
});

// Save/Load game state functions
function saveGameState(mode) {
   const gameState = {
       guessHistory: guessHistory.map(card => card.name),
       targetCard: targetCard.name,
       gameWon: window.gameWon || false,
       hardMode: hardMode,
       dayString: getDayString() // Save the day this was played
   };
   localStorage.setItem(`gameState_${mode}`, JSON.stringify(gameState));
}

function loadGameState(mode) {
   // Check if there's a saved game from today
   if (!isGameFromToday(mode)) {
       // Old game or no game - start fresh
       guessHistory = [];
       window.gameWon = false;
       targetCard = null;
       // Reset hard mode to Easy Mode
       hardMode = false;
       const btn = document.getElementById('hardModeBtn');
       if (btn) {
           btn.classList.remove('active');
           btn.textContent = 'Easy Mode';
           btn.setAttribute('data-tooltip', 'Easy Mode: No restrictions for guessing');
       }
       return;
   }
   
   const savedState = localStorage.getItem(`gameState_${mode}`);
   if (savedState) {
       const state = JSON.parse(savedState);
       
       // Restore target card
       targetCard = cardsData.find(card => card.name === state.targetCard);
       
       // Restore guess history
       guessHistory = state.guessHistory.map(cardName => 
           cardsData.find(card => card.name === cardName)
       ).filter(card => card !== undefined);
       
       // Restore game won state
       window.gameWon = state.gameWon || false;
       
       // ALWAYS restore the exact hard mode state from the saved game
       hardMode = state.hardMode || false;
       const btn = document.getElementById('hardModeBtn');
       if (btn) {
           if (hardMode) {
               btn.classList.add('active');
               btn.textContent = 'Hard Mode';
               btn.setAttribute('data-tooltip', 'Hard Mode: Any revealed hints must be used in subsequent guesses');
           } else {
               btn.classList.remove('active');
               btn.textContent = 'Easy Mode';
               btn.setAttribute('data-tooltip', 'Easy Mode: No restrictions for guessing');
           }
       }
       
       // Lock hard mode button if there are guesses
       if (guessHistory.length > 0) {
           if (btn) {
               btn.classList.add('locked');
           }
       }
   } else {
       // No saved state, start fresh
       guessHistory = [];
       window.gameWon = false;
       targetCard = null;
       // Reset hard mode to Easy Mode
       hardMode = false;
       const btn = document.getElementById('hardModeBtn');
       if (btn) {
           btn.classList.remove('active');
           btn.textContent = 'Easy Mode';
           btn.setAttribute('data-tooltip', 'Easy Mode: No restrictions for guessing');
       }
   }
}

function loadGameStateForMode(mode) {
   // Only return saved state if it's from today
   if (!isGameFromToday(mode)) {
       return null;
   }
   
   const savedState = localStorage.getItem(`gameState_${mode}`);
   if (savedState) {
       return JSON.parse(savedState);
   }
   return null;
}

// Get the current day string in Pacific Time for daily card selection
function getDayString() {
   // Get current UTC time
   const now = new Date();
   
   // Pacific Time is UTC-8 (PST) or UTC-7 (PDT)
   // Convert to Pacific Time by getting the time in that timezone
   const pacificTimeString = now.toLocaleString('en-US', { 
       timeZone: 'America/Los_Angeles',
       year: 'numeric',
       month: '2-digit',
       day: '2-digit',
       hour: '2-digit',
       minute: '2-digit',
       second: '2-digit',
       hour12: false
   });
   
   // Parse the Pacific time string
   // Format will be: "MM/DD/YYYY, HH:MM:SS"
   const [datePart, timePart] = pacificTimeString.split(', ');
   const [month, day, year] = datePart.split('/');
   const [hour] = timePart.split(':');
   
   // Create a date object representing the current Pacific time
   const pacificDate = new Date(`${year}-${month}-${day}T${timePart}`);
   const pacificHour = parseInt(hour);
   
   // If it's before 10 AM Pacific, use yesterday's date
   if (pacificHour < 10) {
       pacificDate.setDate(pacificDate.getDate() - 1);
   }
   
   // Format as YYYY-MM-DD
   const finalYear = pacificDate.getFullYear();
   const finalMonth = String(pacificDate.getMonth() + 1).padStart(2, '0');
   const finalDay = String(pacificDate.getDate()).padStart(2, '0');
   
   return `${finalYear}-${finalMonth}-${finalDay}`;
}

// Seeded random number generator for consistent daily cards
function seededRandom(seed) {
   // Use a better hash function for more random distribution
   let hash = seed;
   hash = ((hash << 5) - hash) + seed;
   hash = hash & hash; // Convert to 32-bit integer
   hash = Math.abs(hash);
   
   // Multiple rounds of mixing for better distribution
   const x = Math.sin(hash) * 10000;
   const y = Math.cos(hash * 0.5) * 10000;
   const z = Math.sin(hash * 1.5) * 10000;
   
   const mixed = (x + y + z) / 3;
   return Math.abs(mixed - Math.floor(mixed));
}

// Get daily card for a specific mode
function getDailyCard(mode) {
   const dayString = getDayString();
   
   // Create a unique seed for each mode and day using a better hash
   let seed = 0;
   for (let i = 0; i < dayString.length; i++) {
       seed = ((seed << 5) - seed) + dayString.charCodeAt(i);
       seed = seed & seed; // Convert to 32bit integer
   }
   
   // Add mode-specific offset to seed
   if (mode === 'plants') seed += 1000;
   else if (mode === 'zombies') seed += 2000;
   else if (mode === 'classic') seed += 3000;
   
   // Make seed positive
   seed = Math.abs(seed);
   
   // Use seeded random to pick card
   const randomValue = seededRandom(seed);
   const index = Math.floor(randomValue * cardsData.length);
   
   return cardsData[index];
}

// Check if saved game is from today
function isGameFromToday(mode) {
   const savedState = localStorage.getItem(`gameState_${mode}`);
   if (!savedState) return false;
   
   const state = JSON.parse(savedState);
   const savedDay = state.dayString;
   const currentDay = getDayString();
   
   return savedDay === currentDay;
}
// Update global statistics in Firebase
async function updateGlobalStats(guessCount) {
    if (typeof db === 'undefined') {
        console.log('Firebase not available');
        return;
    }
    
    const mode = window.currentGameMode;
    if (mode === 'endless') return;
    
    const dayString = getDayString();
    const docName = `global_distribution_${mode}`; // Single document per mode
    const globalDocRef = db.collection("stats").doc(docName);
    const field = guessCount >= 10 ? "10+" : guessCount.toString();

    try {
        // First, check if we need to reset (if it's a new day)
        const doc = await globalDocRef.get();
        
        if (doc.exists) {
            const data = doc.data();
            const lastResetDate = data.lastResetDate;
            
            // If the stored date is different from today, reset all stats
            if (lastResetDate !== dayString) {
                console.log(`🔄 New day detected! Resetting stats for ${mode}. Old date: ${lastResetDate}, New date: ${dayString}`);
                
                // Reset all fields to 0 and set new date
                await globalDocRef.set({
                    "1": 0,
                    "2": 0,
                    "3": 0,
                    "4": 0,
                    "5": 0,
                    "6": 0,
                    "7": 0,
                    "8": 0,
                    "9": 0,
                    "10+": 0,
                    totalGames: 0,
                    lastResetDate: dayString,
                    mode: mode
                });
            }
        } else {
            // Document doesn't exist, create it with initial values
            console.log(`📝 Creating new stats document for ${mode}`);
            await globalDocRef.set({
                "1": 0,
                "2": 0,
                "3": 0,
                "4": 0,
                "5": 0,
                "6": 0,
                "7": 0,
                "8": 0,
                "9": 0,
                "10+": 0,
                totalGames: 0,
                lastResetDate: dayString,
                mode: mode
            });
        }
        
        // Now increment the appropriate field
        await globalDocRef.update({
            [field]: firebase.firestore.FieldValue.increment(1),
            totalGames: firebase.firestore.FieldValue.increment(1)
        });
        
        console.log(`✅ Global stats updated for ${mode} on ${dayString}:`, field);
    } catch (e) {
        console.error("❌ Firebase update failed:", e);
    }
}

// Get global statistics from Firebase
async function getGlobalStats() {
    if (typeof db === 'undefined') {
        console.log('Firebase not available');
        return null;
    }
    
    const mode = window.currentGameMode;
    if (mode === 'endless') return null;
    
    const dayString = getDayString();
    const docName = `global_distribution_${mode}`; // Single document per mode
    
    try {
        const doc = await db.collection("stats").doc(docName).get();
        if (doc.exists) {
            const data = doc.data();
            const lastResetDate = data.lastResetDate;
            
            // Check if the data is from today
            if (lastResetDate === dayString) {
                console.log(`✅ Global stats fetched for ${mode} on ${dayString}:`, data);
                return data;
            } else {
                // Data is from a previous day, return empty stats
                // (The next player to submit will trigger the reset)
                console.log(`⚠️ Stats are from ${lastResetDate}, but today is ${dayString}. Showing empty stats until first submission.`);
                return {
                    totalGames: 0,
                    lastResetDate: dayString,
                    mode: mode
                };
            }
        } else {
            console.log(`⚠️ No stats document found for ${mode}. Showing empty stats.`);
            return {
                totalGames: 0,
                lastResetDate: dayString,
                mode: mode
            };
        }
    } catch (e) {
        console.error("❌ Firebase fetch failed:", e);
        return null;
    }
}

async function showGlobalStatsPopup() {
    const mode = window.currentGameMode;
    if (mode === 'endless') {
        showMessage('Global stats are not available for Endless mode');
        return;
    }
    
    // Fetch global data from Firebase
    const globalData = await getGlobalStats();
    
    if (!globalData) {
        showMessage('Unable to load global stats. Please try again.');
        return;
    }
    
    const overlay = document.createElement('div');
    overlay.className = 'stats-popup-overlay';
    overlay.onclick = () => overlay.remove();
    
    const content = document.createElement('div');
    content.className = 'stats-popup-content';
    content.onclick = (e) => e.stopPropagation();
    
    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'stats-close-btn';
    closeBtn.textContent = '✕';
    closeBtn.onclick = () => overlay.remove();
    content.appendChild(closeBtn);
    
    // Title
    const title = document.createElement('div');
    title.className = 'stats-title';
    title.textContent = 'Community Results';
    content.appendChild(title);
    
    // Subtitle
    const subtitle = document.createElement('div');
    subtitle.className = 'stats-subtitle';
    subtitle.textContent = 'GUESS DISTRIBUTION';
    content.appendChild(subtitle);
    
    // Stats container
    const statsContainer = document.createElement('div');
    statsContainer.className = 'stats-container';
    
    const total = globalData.totalGames || 1;
    const guessCategories = [1, 2, 3, 4, 5, 6, 7, 8, 9, '10+'];
    
    // Find max count for scaling bars
    const maxCount = Math.max(
        globalData[1] || 0,
        globalData[2] || 0,
        globalData[3] || 0,
        globalData[4] || 0,
        globalData[5] || 0,
        globalData[6] || 0,
        globalData[7] || 0,
        globalData[8] || 0,
        globalData[9] || 0,
        globalData['10+'] || 0
    );
    
    guessCategories.forEach(guessNum => {
        const count = globalData[guessNum] || 0;
        const percentage = total > 0 
            ? ((count / total) * 100).toFixed(1)
            : 0;
        
        const row = document.createElement('div');
        row.className = 'stats-row';
        
        const label = document.createElement('div');
        label.className = 'stats-label';
        label.textContent = guessNum;
        row.appendChild(label);
        
        const barContainer = document.createElement('div');
        barContainer.className = 'stats-bar-container';
        
        const bar = document.createElement('div');
        bar.className = 'stats-bar';
        
        // Highlight current player's score
        if (window.gameWon && guessHistory.length === guessNum) {
            bar.classList.add('current-guess');
        }
        
        const barWidth = maxCount > 0 && count > 0
            ? Math.max(20, (count / maxCount) * 100)
            : 0;
        bar.style.width = `${barWidth}%`;
        
        const barText = document.createElement('span');
        barText.className = 'stats-bar-text';
        barText.textContent = `${count} (${percentage}%)`;
        bar.appendChild(barText);
        
        barContainer.appendChild(bar);
        row.appendChild(barContainer);
        
        statsContainer.appendChild(row);
    });
    
    content.appendChild(statsContainer);
    
    const totalGames = document.createElement('div');
    totalGames.className = 'stats-total';
    totalGames.textContent = `Total Community Games: ${globalData.totalGames || 0}`;
    content.appendChild(totalGames);
    
    overlay.appendChild(content);
    document.body.appendChild(overlay);
}