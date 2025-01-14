let socket;
let gameId = null;
let playerId = null;
let playerName = null;
let currentRound = 1;
let playerHand = [];
let isHost = false;
let lastPlayedCard = null;
let gameInitialized = false;
let playedCards = [];
let playerColor = null;
let roundLost = false;

// DOM Elements
const homeScreen = document.getElementById('home-screen');
const loadingScreen = document.getElementById('loading-screen');
const gameScreen = document.getElementById('game-screen');
const hostGameBtn = document.getElementById('host-game');
const joinGameBtn = document.getElementById('join-game-btn');
const startGameBtn = document.getElementById('start-game');
const gameCodeInput = document.getElementById('game-code');
const playerNameInput = document.getElementById('player-name');
const playerList = document.getElementById('player-list');
const lastPlayedCardElement = document.getElementById('last-played-card');
const playerHandElement = document.getElementById('player-hand');
const gameCodeDisplay = document.getElementById('game-code-display');
const displayedGameCode = document.getElementById('displayed-game-code');
const currentRoundElement = document.getElementById('current-round');

const infoButton = document.getElementById('info-button');
const infoModal = document.getElementById('info-modal');
const closeButton = document.querySelector('.close-button');

// Add with other event listeners
infoButton.addEventListener('click', () => {
  infoModal.style.display = 'block';
  // Trigger reflow to ensure transitions work
  infoModal.offsetHeight;
  infoModal.classList.add('show-bg', 'show');
});

// Update the close button click handler
closeButton.addEventListener('click', () => {
  infoModal.classList.remove('show');
  infoModal.classList.remove('show-bg');
  // Wait for animation to complete before hiding
  setTimeout(() => {
      infoModal.style.display = 'none';
  }, 300); // Match this with CSS transition duration
});

// Update the window click handler
window.addEventListener('click', (event) => {
  if (event.target === infoModal) {
      infoModal.classList.remove('show');
      infoModal.classList.remove('show-bg');
      // Wait for animation to complete before hiding
      setTimeout(() => {
          infoModal.style.display = 'none';
      }, 300); // Match this with CSS transition duration
  }
});

const backgroundMusic = new Audio('/background.mp3');
const roundWinSound = new Audio('/roundWin.mp3');
const roundLoseSound = new Audio('/roundLost.mp3');
roundWinSound.volume = 0.3;
roundLoseSound.volume = 0.7;
const cardCorrectSound = new Audio('/cardCorrect.mp3');
let currentPitch = 0; // Starting pitch (lower than normal)
const pitchIncrement = 2; // How much to increase pitch each time



function playCardSound() {
  // Clone the audio element to allow overlapping sounds
  const sound = cardCorrectSound.cloneNode();
  sound.preservesPitch = false;
  // Set the playback rate directly on the audio element
  sound.playbackRate = 2**((currentPitch)/12);
  
  // Play the sound
  sound.play().catch(e => console.log('Error playing sound:', e));
  
  // Increment pitch for next time
  if (currentPitch % 12 == 4 || currentPitch % 12 == 11) {
    currentPitch += 1;
  } else {
    currentPitch += pitchIncrement;
  }
  
  console.log(currentPitch);
  console.log(2**((currentPitch)/12));
  
  // Reset pitch if it gets too high
  // if (currentPitch > 2.0) {
  //     currentPitch = 0.8;
  // }
}

// Initialize socket connection
function initializeSocket() {
    socket = io();

    socket.on('gameCreated', ({ gameId: gId, playerId: pId }) => {
        gameId = gId;
        playerId = pId;
        isHost = true;
        showLoadingScreen();
        displayGameCode(gameId);
    });

    socket.on('gameJoined', ({ gameId: gId, playerId: pId }) => {
        gameId = gId;
        playerId = pId;
        showLoadingScreen();
    });

    socket.on('playersUpdate', (players) => {
        updatePlayerList(players);
    });

    socket.on('gameStarted', (gameData) => {
      gameInitialized = true;
      currentRound = gameData.currentRound;
      showGameScreen();
      updateRoundDisplay();
      updatePlayerSeats(gameData.players);
      // Increase delay to ensure DOM is ready
      setTimeout(() => {
          initializeCardHoverEffects();
      }, 1000); // Increased from 500ms to 1000ms
  });

  socket.on('dealtCards', (cards) => {
    playerHand = cards.sort((a, b) => a - b);
    
    const animatingCards = document.querySelectorAll('.animate__bounceOutDown');
    if (animatingCards.length > 0) {
        setTimeout(() => {
            renderPlayerHand(true);
            updateRoundDisplay();
            
            // initializeCardHoverEffects(); // Add this line
        }, 2000);
    } else {
        renderPlayerHand(true);
        updateRoundDisplay();
        // Increase delay here as well
        // setTimeout(() => {
        //     initializeCardHoverEffects();
        // }, 1000); // Increased from 100ms to 1000ms
    }
});

  socket.on('cardPlayed', (gameData) => {
    // Check if any cards would be higher than the played card
    const hasHigherCards = playerHand.some(card => card < gameData.lastPlayedCard.card);
    lastPlayedCard = gameData.lastPlayedCard;
    playedCards = gameData.playedCards;
    currentRound = gameData.currentRound;
    updatePlayedCards();
    updateRoundDisplay();
    
    // Play the card sound with current pitch
    playCardSound();
    // Only process the card play if it's not going to trigger a loss
    if (!hasHigherCards) {
        // Add white pulse animation to table
        const gameTable = document.querySelector('.game-table');
        gameTable.classList.add('pulse-white');
        
        // Remove pulse class after animation completes
        setTimeout(() => {
            gameTable.classList.remove('pulse-white');
        }, 500);
    }
});

  
socket.on('roundWon', (data) => {
  // Add green pulse animation to table
  const gameTable = document.querySelector('.game-table');
  gameTable.classList.add('pulse-green');
  
  // Start confetti
  // confetti.start();
  currentPitch = 0;
  
  // Get played cards and create a map of unique colors
  const playedCardsElement = document.getElementById('played-cards');
  const cards = Array.from(playedCardsElement.getElementsByClassName('played-card'));
  const uniqueColorCards = new Map();
  
  cards.forEach(card => {
      const color = card.style.borderColor;
      if (!uniqueColorCards.has(color)) {
          uniqueColorCards.set(color, card);
      }
  });
  
  setTimeout(() => {
      roundWinSound.play().catch(e => console.log('Error playing sound:', e));
      
      // Create particles only for one card of each unique color
      uniqueColorCards.forEach(card => {
          createParticlesFromElement(card);
      });
      
      // Make all cards fade out
      cards.forEach(card => {
          card.style.opacity = '0';
      });
  }, 800);
  
  // Wait for animation and delay before continuing
  setTimeout(() => {
      gameTable.classList.remove('pulse-green');
      // confetti.stop();
      
      // Move state updates inside the timeout
      lastPlayedCard = null;
      playedCards = [];
      if (data && data.nextRound) {
          currentRound = data.nextRound;
          updateRoundDisplay();
      }
      updatePlayedCards();
  }, 2000);
});
    // Add this new function for particle creation
    function createParticlesFromElement(element) {
      // Get all played cards
      const playedCardsElement = document.getElementById('played-cards');
      const cards = Array.from(playedCardsElement.getElementsByClassName('played-card'));
      
      // Create a map of unique colors to their corresponding card elements
      const uniqueColorCards = new Map();
      cards.forEach(card => {
          const color = card.style.borderColor;
          if (!uniqueColorCards.has(color)) {
              uniqueColorCards.set(color, card);
          }
      });
      // alert(uniqueColorCards.length);
      // Create particles for one card of each unique color
      uniqueColorCards.forEach((card) => {
          const rect = card.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          
          // Create exactly 7 particles for this color
          for (let i = 0; i < 8 / uniqueColorCards.size; i++) {
              const particle = document.createElement('div');
              particle.className = 'particle';
              
              const x = centerX - rect.width/2 + Math.random() * rect.width;
              const y = centerY - rect.height/2 + Math.random() * rect.height;
              
              particle.style.left = `${x}px`;
              particle.style.top = `${y}px`;
              
              particle.style.backgroundColor = "#fff";
              particle.style.color = card.style.borderColor;
              
              document.body.appendChild(particle);
              
              const angle = Math.random() * Math.PI * 2;
              const velocity = 2 + Math.random() * 4;
              const dx = Math.cos(angle) * velocity;
              const dy = Math.sin(angle) * velocity;
              
              particle.animate([
                  { 
                      transform: 'translate(0, 0) scale(1)', 
                      opacity: 1,
                      boxShadow: '0 0 10px 2px currentColor, 0 0 20px 4px currentColor, 0 0 30px 6px currentColor'
                  },
                  { 
                      transform: `translate(${dx * 50}px, ${dy * 50}px) scale(0)`, 
                      opacity: 0,
                      boxShadow: '0 0 0 0 currentColor, 0 0 0 0 currentColor, 0 0 0 0 currentColor'
                  }
              ], {
                  duration: 600 + Math.random() * 200,
                  easing: 'ease-out',
                  fill: 'forwards',
                  composite: 'add'
              }).onfinish = () => particle.remove();
          }
      });
  }

  socket.on('roundLost', (data) => {
    console.log('Received roundLost event:', data);
    roundLost = true;
    
    // Add red pulse animation to table
    const gameTable = document.querySelector('.game-table');
    gameTable.classList.add('pulse-red');
    roundLoseSound.play().catch(e => console.log('Error playing sound:', e));
    currentPitch = 0;
    
    setTimeout(() => {
        
        console.log("Round lost! A card was played that was higher than remaining cards.");

        if (isHost) {
          const restartButton = document.createElement('button');
          restartButton.id = 'restart-button';
          restartButton.textContent = 'Restart';
          restartButton.addEventListener('click', () => {
              socket.emit('restartGame', { gameId });
              restartButton.remove();
              roundLost = false;
          });
          const scanlineDiv = document.createElement('div');
          scanlineDiv.classList.add('scanlines');
          restartButton.appendChild(scanlineDiv);
          
          // Update positioning
          restartButton.style.position = 'absolute';
          restartButton.style.left = '50%';
          restartButton.style.top = '20%'; // Moved up slightly
          restartButton.style.transform = 'translate(-50%, -50%)';
          restartButton.style.zIndex = '1000';
          
          document.querySelector('.table-center').appendChild(restartButton);
      } else {
          const waitingText = document.createElement('div');
          waitingText.id = 'waiting-text';
          waitingText.textContent = 'Waiting for host to restart...';
          waitingText.style.color = '#fff';
          waitingText.style.textAlign = 'center';
          waitingText.style.whiteSpace = 'nowrap'; // Prevent text wrapping
          waitingText.style.minWidth = '250px'; // Ensure enough width for text
          
          // Update positioning
          waitingText.style.position = 'absolute';
          waitingText.style.left = '50%';
          waitingText.style.top = '20%'; // Moved up slightly
          waitingText.style.transform = 'translate(-50%, -50%)';
          waitingText.style.zIndex = '1000';
          
          document.querySelector('.table-center').appendChild(waitingText);
      }
      const playedCardsElement = document.getElementById('played-cards');
        if (playedCardsElement) {
            playedCardsElement.style.marginTop = '90px'; // Add space below button/text
        }

        // Reveal all players' cards
        if (data && data.playerHands) {
          console.log('Revealing player hands:', data.playerHands);
          data.playerHands.forEach(playerData => {
              const playerSeats = document.querySelectorAll('.player-seat');
              const playerSeat = Array.from(playerSeats).find(seat => 
                  seat.querySelector('.player-name').textContent === playerData.name
              );
              
              if (playerSeat) {
                  const cardContainer = playerSeat.querySelector('.player-cards');
                  cardContainer.innerHTML = ''; // Clear existing card backs
                  
                  // Calculate spread width based on number of cards
                  const spreadWidth = Math.min(10, 100 / playerData.hand.length); // Maximum 25px spread per card
                  
                  // Create and animate new cards
                  playerData.hand.forEach((card, index) => {
                      const cardElement = document.createElement('div');
                      cardElement.classList.add('card-back');
                      cardElement.style.borderColor = playerData.color;
                      
                      // Calculate horizontal offset for spread
                      const offset = (index - (playerData.hand.length - 1) / 2) * spreadWidth;
                      
                      // Start with no transform
                      cardElement.style.transform = 'rotateY(0deg)';
                      cardElement.style.transition = 'transform 0.3s ease-in-out';
                      cardElement.style.position = 'relative';
                      cardElement.style.marginLeft = '0';
                      
                      // Add card number (hidden initially)
                      const cardNumber = document.createElement('span');
                      cardNumber.textContent = card;
                      cardNumber.style.opacity = '0';
                      cardNumber.style.transition = 'opacity 0.3s ease-in-out';
                      cardElement.appendChild(cardNumber);
                      
                      cardContainer.appendChild(cardElement);
                      
                      // First translate the cards outward
                      setTimeout(() => {
                          cardElement.style.transform = `translateX(${offset}px)`;
                      }, 50);
  
                      // Then flip them over after the translation is complete
                      setTimeout(() => {
                          cardElement.style.transform = `translateX(${offset}px) rotateY(180deg)`;
                          cardNumber.style.opacity = '1';
                      }, 400 + (index * 50)); // Start flipping after translation is done
                  });
              }
          });
      }
        
        // Animate all cards in player's hand
        // const handCards = document.querySelectorAll('#player-hand .card');
        // handCards.forEach(card => {
        //     card.classList.add('animate__animated', 'animate__bounceOutDown');
        // });
        
        // Remove pulse class and reset game state after animation
        setTimeout(() => {
            gameTable.classList.remove('pulse-red');
            // lastPlayedCard = null;
            // playedCards = [];
            // currentRound = 1;
            // updatePlayedCards();
            // updateRoundDisplay();
        }, 2000);
    }, 500);
});

socket.on('roundUpdate', (data) => {
  // Remove restart button if it exists
  const restartButton = document.getElementById('restart-button');
  if (restartButton) {
      restartButton.remove();
  }

  const waitingText = document.getElementById('waiting-text');
    if (waitingText) {
        waitingText.remove();
    }
    
  
  // Add animations to played cards and hand cards
  const playedCards = document.querySelectorAll('#played-cards .played-card');
  const handCards = document.querySelectorAll('#player-hand .card');
  
  // Add bounceOutDown animation to played cards and hand cards
  [...playedCards, ...handCards].forEach(card => {
      card.classList.add('animate__animated', 'animate__bounceOutDown');
  });
  
  // Add slide-to-center animation for seat cards
  const seatCards = document.querySelectorAll('.player-cards .card-back');
  seatCards.forEach(card => {
      const container = card.closest('.player-cards');
      const containerRect = container.getBoundingClientRect();
      const centerX = containerRect.width / 2;
      
      card.style.transition = 'all 0.5s ease-in-out';
      card.style.position = 'absolute';
      card.style.left = `${centerX}px`;
      card.style.transform = 'translateX(-50%)';
      // card.style.opacity = '0';
  });
  
  // Increase timeout to allow animations to complete
  setTimeout(() => {
    const playedCardsElement = document.getElementById('played-cards');
    if (playedCardsElement) {
        playedCardsElement.style.marginTop = '0px'; // Add space below button/text
    }
      roundLost = false;
      currentRound = data.currentRound;
      lastPlayedCard = data.lastPlayedCard;
      playedCards = data.playedCards || [];
      
      // Delay the UI updates until animations are done
      setTimeout(() => {
          updateRoundDisplay();
          updatePlayedCards();
      }, 500);
  }, 600); // Increased from 100ms to 600ms to match animation duration
});

    socket.on('error', (message) => {
        alert(message);
    });

    // Initialize the color picker after socket setup
    initializeColorPicker();
}

// Event Listeners
hostGameBtn.addEventListener('click', hostNewGame);
joinGameBtn.addEventListener('click', joinGame);
startGameBtn.addEventListener('click', () => {
    socket.emit('startGame', { gameId });
});

// Game Functions
function hostNewGame() {
    backgroundMusic.loop = true; // Make the music loop continuously
    backgroundMusic.volume = 0.1; // Set volume to 50%
    backgroundMusic.play().catch(e => console.log('Error playing background music:', e));
    setPlayerName();
    socket.emit('hostGame', { playerName, playerColor });
}

function joinGame() {
  backgroundMusic.loop = true; // Make the music loop continuously
  backgroundMusic.volume = 0.1; // Set volume to 50%
  backgroundMusic.play().catch(e => console.log('Error playing background music:', e));
    const code = gameCodeInput.value.toUpperCase();
    setPlayerName();
    socket.emit('joinGame', { gameId: code, playerName, playerColor });
}

function playCard(index) {
  // Add check for roundLost
  if (roundLost) return;
  
  const card = playerHand[index];
  socket.emit('playCard', { gameId, card, playerName });
  playerHand.splice(index, 1);
  renderPlayerHand();
  setTimeout(() => {
      initializeCardHoverEffects();
  }, 100);
}
// UI Functions
function updatePlayerList(players) {
    playerList.innerHTML = '';
    players.forEach(player => {
        const li = document.createElement('li');
        const colorIndicator = document.createElement('div');
        colorIndicator.className = 'player-color-indicator';
        colorIndicator.style.backgroundColor = player.color || '#666';
        
        li.appendChild(colorIndicator);
        li.appendChild(document.createTextNode(
            player.name + (player.isHost ? ' (Host)' : '')
        ));
        playerList.appendChild(li);
    });
    
    if (isHost) {
        startGameBtn.classList.remove('hidden');
    }
    
    if (gameInitialized) {
        updatePlayerSeats(players);
    }
}

function initializeCardHoverEffects() {
  const playerHand = document.getElementById('player-hand');
  console.log('Initializing hover effects', playerHand);
  
  // Remove any existing event listeners first
  playerHand.removeEventListener('mouseover', handleMouseOver);
  playerHand.removeEventListener('mouseout', handleMouseOut);
  
  function handleMouseOver(e) {
      if (e.target.classList.contains('card')) {
          console.log('Card hover detected');
          const cards = Array.from(playerHand.children);
          const index = cards.indexOf(e.target);
          
          // Lift current card
          e.target.style.transform = 'translateY(-20px)';
          e.target.style.zIndex = '10';
          
          // Push adjacent cards
          if (index > 0) {
              cards[index - 1].style.transform = 'translateX(-15px)';
          }
          if (index < cards.length - 1) {
              cards[index + 1].style.transform = 'translateX(15px)';
          }
      }
  }
  
  function handleMouseOut(e) {
      if (e.target.classList.contains('card')) {
          const cards = Array.from(playerHand.children);
          cards.forEach(card => {
              card.style.transform = '';
              card.style.zIndex = '';
          });
      }
  }
  
  playerHand.addEventListener('mouseover', handleMouseOver);
  playerHand.addEventListener('mouseout', handleMouseOut);

  
}

function renderPlayerHand(isNewHand = false) {
  playerHandElement.innerHTML = '';
  
  playerHandElement.style.borderColor = playerColor;
  
  playerHand.forEach((card, index) => {
      const cardElement = document.createElement('div');
      cardElement.classList.add('card');
      
      if (isNewHand) {
          cardElement.classList.add('animate__animated', 'animate__backInUp');
          cardElement.style.animationDelay = `${index * 100}ms`;
          
          // Remove animation classes after animation completes
          cardElement.addEventListener('animationend', () => {
              cardElement.classList.remove('animate__animated', 'animate__backInUp');
          }, { once: true }); // Use once:true to automatically remove the listener after it fires
      }
      
      cardElement.textContent = card;
      cardElement.addEventListener('click', () => playCard(index));
      cardElement.style.borderColor = playerColor;
      playerHandElement.appendChild(cardElement);
      
      setTimeout(() => {
          initializeCardHoverEffects();
      }, 1000);
  });
}

// Helper Functions
function setPlayerName() {
    playerName = playerNameInput.value.trim() || generatePlayerName();
    return playerName;
}

function generatePlayerName() {
    const adjectives = ['Happy', 'Lucky', 'Sunny', 'Clever', 'Swift'];
    const nouns = ['Panda', 'Tiger', 'Eagle', 'Dolphin', 'Lion'];
    return `${adjectives[Math.floor(Math.random() * adjectives.length)]}${nouns[Math.floor(Math.random() * nouns.length)]}${Math.floor(Math.random() * 100)}`;
}

// UI Update Functions
function showLoadingScreen() {
    homeScreen.classList.add('hidden');
    gameScreen.classList.add('hidden');
    loadingScreen.classList.remove('hidden');
    
    console.log('Home screen hidden:', homeScreen.classList.contains('hidden'));
    console.log('Loading screen hidden:', loadingScreen.classList.contains('hidden'));
}

function showGameScreen() {
    homeScreen.classList.add('hidden');
    loadingScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
}

function displayGameCode(code) {
    displayedGameCode.textContent = code;
    gameCodeDisplay.classList.remove('hidden');
    
    // Copy game code to clipboard
    navigator.clipboard.writeText(code)
        .then(() => {
            // Add a temporary "Copied!" message
            const copyMessage = document.createElement('div');
            copyMessage.textContent = 'Game code copied to clipboard!';
            copyMessage.classList.add('copy-message');
            gameCodeDisplay.appendChild(copyMessage);
            
            // Remove the message after 3 seconds with fade out
            setTimeout(() => {
                copyMessage.classList.add('fade-out');
                // Wait for animation to complete before removing
                setTimeout(() => {
                    copyMessage.remove();
                }, 300); // Match this with CSS animation duration
            }, 2700); // Start fade out slightly before the 3 second mark
        })
        .catch(err => {
            console.error('Failed to copy game code:', err);
        });
}

function updateLastPlayedCard() {
    lastPlayedCardElement.textContent = lastPlayedCard ? 
        `${lastPlayedCard.player} played: ${lastPlayedCard.card}` : 
        'No card played yet';
}

function updateRoundDisplay() {
    currentRoundElement.textContent = currentRound;
}



function updatePlayedCards() {
    const playedCardsElement = document.getElementById('played-cards');
    playedCardsElement.innerHTML = '';
    
    playedCards.forEach((playedCard, index) => {
        const cardElement = document.createElement('div');
        cardElement.classList.add('played-card');
        cardElement.innerHTML = `
            <span class="card-number">${playedCard.card}</span>
        `;
        
        // Add the player's color to the card border
        cardElement.style.borderColor = playedCard.color;
        
        // Calculate random rotation between -5 and 5 degrees
        const randomRotation = Math.random() * 10 - 5;
        
        cardElement.style.transform = `rotate(${randomRotation}deg)`;
        cardElement.style.zIndex = index;
        
        cardElement.style.top = `-${index * 2}px`;
        cardElement.style.left = `${index * 2}px`;
        
        playedCardsElement.appendChild(cardElement);
    });
}

// Add this function after initializeSocket()
function updatePlayerSeats(players) {
  const seatsContainer = document.querySelector('.player-seats');
  seatsContainer.innerHTML = '';
  
  const totalPlayers = players.length;
  
  // Add color to image mapping
  const colorImages = {
      '#9C142B': 'red.png',
      '#FFD000': 'yellow.png',
      '#00B0AD': 'cyan.png',
      '#66FF5E': 'green.png'
  };
  
  players.forEach((player, index) => {
      const seat = document.createElement('div');
      seat.classList.add('player-seat');
      
      if (player.name === playerName) {
          seat.classList.add('current-player');
      }
      
      // Calculate position around the table
      let angle;
      if (player.name === playerName) {
          // Current player is always at bottom (90 degrees)
          angle = 90;
      } else {
          // Find the relative position of this player
          const currentPlayerIndex = players.findIndex(p => p.name === playerName);
          const relativeIndex = (index - currentPlayerIndex + totalPlayers) % totalPlayers;
          
          // Map relative positions to fixed angles based on player count
          switch(totalPlayers) {
              case 2:
                  // Two players: bottom and top
                  angle = relativeIndex === 1 ? 270 : 90;
                  break;
              case 3:
                  // Three players: bottom, right, and top
                  switch(relativeIndex) {
                      case 1: angle = 0; break;   // right side
                      case 2: angle = 270; break; // top
                      default: angle = 90;        // bottom
                  }
                  break;
              case 4:
                  // Four players: one on each side
                  switch(relativeIndex) {
                      case 1: angle = 0; break;   // right side
                      case 2: angle = 270; break; // top
                      case 3: angle = 180; break; // left side
                      default: angle = 90;        // bottom
                  }
                  break;
              default:
                  angle = 90; // fallback
          }
      }
      
      const radius = 42; // Keep existing radius
      const radian = angle * (Math.PI / 180);
      
      const left = 50 + radius * Math.cos(radian);
      const top = 50 + radius * Math.sin(radian);
      
      seat.style.left = `${left}%`;
      seat.style.top = `${top}%`;
      seat.style.transform = 'translate(-50%, -50%)';
      
      // Rest of the seat creation code remains the same
      const cardCount = player.handSize !== undefined ? player.handSize : currentRound;
      const seatColor = player.name === playerName ? playerColor : player.color;
      
      const cardBacks = Array(cardCount).fill('').map(() => 
          `<div class="card-back" style="border-color: ${seatColor || '#ccc'}"></div>`
      ).join('');
      
      const avatarStyle = seatColor && colorImages[seatColor] 
          ? `background-image: url(${colorImages[seatColor]}); background-size: 100%; background-position: center; border-color: ${seatColor}`
          : `border-color: #ccc`;
      
      seat.innerHTML = `
          <div class="player-name">${player.name}</div>
          <div class="player-avatar" style="${avatarStyle}"></div>
          <div class="player-cards">${cardBacks}</div>
      `;
      
      seatsContainer.appendChild(seat);
  });
}

// Add this function after initializeSocket()
function initializeColorPicker() {
  const colorCircles = document.querySelectorAll('.color-circle');
  
  // Map of colors to their corresponding image files
  const colorImages = {
      '#9C142B': 'red.png',
      '#FFD000': 'yellow.png',
      '#00B0AD': 'cyan.png',
      '#66FF5E': 'green.png'
  };
  
  // Set the background image for each circle
  colorCircles.forEach(circle => {
      const color = circle.dataset.color;
      // Only process colors that have corresponding images
      if (colorImages[color]) {
          circle.style.backgroundColor = 'transparent'; // Remove background color
          circle.style.backgroundImage = `url(${colorImages[color]})`; // Add background image
          circle.style.backgroundSize = 'cover'; // Ensure image covers the circle
          circle.style.backgroundPosition = 'center'; // Center the image
          
          circle.addEventListener('click', () => {
              // Remove selected class from all circles
              colorCircles.forEach(c => c.classList.remove('selected'));
              // Add selected class to clicked circle
              circle.classList.add('selected');
              playerColor = color;
              
              // Emit color change to server
              if (gameId) {
                  socket.emit('updatePlayerColor', { gameId, color });
              }
          });
      } else {
          // Hide or remove circles for colors that don't have images
          circle.style.display = 'none';
      }
  });
}

// Initialize the socket connection when the page loads
initializeSocket(); 


class Stage {
    constructor() {
      this.renderParam = {
        clearColor: 0x666666,
        width: window.innerWidth,
        height: window.innerHeight
      };
  
      this.cameraParam = {
        left: -1,
        right: 1,
        top: 1,
        bottom: 1,
        near: 0,
        far: -1
      };
  
      this.scene = null;
      this.camera = null;
      this.renderer = null;
      this.geometry = null;
      this.material = null;
      this.mesh = null;
  
      this.isInitialized = false;
    }
  
    init() {
      this._setScene();
      this._setRender();
      this._setCamera();
  
      this.isInitialized = true;
    }
  
    _setScene() {
      this.scene = new THREE.Scene();
    }
  
    _setRender() {
      this.renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById("webgl-canvas")
      });
      this.renderer.setPixelRatio(window.devicePixelRatio);
      this.renderer.setClearColor(new THREE.Color(this.renderParam.clearColor));
      this.renderer.setSize(this.renderParam.width, this.renderParam.height);
    }
  
    _setCamera() {
      if (!this.isInitialized) {
        this.camera = new THREE.OrthographicCamera(
          this.cameraParam.left,
          this.cameraParam.right,
          this.cameraParam.top,
          this.cameraParam.bottom,
          this.cameraParam.near,
          this.cameraParam.far
        );
      }
      
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
  
      this.camera.aspect = windowWidth / windowHeight;
  
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(windowWidth, windowHeight);
    }
  
    _render() {
      this.renderer.render(this.scene, this.camera);
    }
  
    onResize() {
      this._setCamera();
    }
  
    onRaf() {
      this._render();
    }
  }
  
  class Mesh {
    constructor(stage) {
      this.canvas = document.getElementById("webgl-canvas");
      this.canvasWidth = this.canvas.width;
      this.canvasHeight = this.canvas.height;
  
      this.uniforms = {
        resolution: { type: "v2", value: [ this.canvasWidth, this.canvasHeight ] },
        time: { type: "f", value: 0.0 },
        xScale: { type: "f", value: 1.0 },
        yScale: { type: "f", value: 0.5 },
        distortion: { type: "f", value: 0.050 }
      };
  
      this.stage = stage;
  
      this.mesh = null;
      
      this.xScale = 1.0;
      this.yScale = 0.5;
      this.distortion = 0.050;
    }
  
    init() {
      this._setMesh();
      // this._setGui();
    }
  
    _setMesh() {
      const position = [
        -1.0, -1.0, 0.0,
         1.0, -1.0, 0.0,
        -1.0,  1.0, 0.0,
         1.0, -1.0, 0.0,
        -1.0,  1.0, 0.0,
         1.0,  1.0, 0.0
      ];
  
      const positions = new THREE.BufferAttribute(new Float32Array(position), 3);
  
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", positions);
  
      const material = new THREE.RawShaderMaterial({
        vertexShader: document.getElementById("js-vertex-shader").textContent,
        fragmentShader: document.getElementById("js-fragment-shader").textContent,
        uniforms: this.uniforms,
        side: THREE.DoubleSide
      });
  
      this.mesh = new THREE.Mesh(geometry, material);
  
      this.stage.scene.add(this.mesh);
    }
    
    _diffuse() {
      // gsap.to(this.mesh.material.uniforms.xScale, {
      //   value: 2,
      //   duration: 0.1,
      //   ease: 'power2.inOut',
      //   repeat: -1,
      //   yoyo: true
      // });
      // gsap.to(this.mesh.material.uniforms.yScale, {
      //   value: 1,
      //   duration: 0.1,
      //   ease: 'power2.inOut',
      //   repeat: -1,
      //   yoyo: true
      // });
    }
    
    _render() {
      this.uniforms.time.value += 0.01;
    }
  
    _setGui() {
      const parameter = {
        xScale: this.xScale,
        yScale: this.yScale,
        distortion: this.distortion
      }
      const gui = new dat.GUI();
      gui.add(parameter, "xScale", 0.00, 5.00, 0.01).onChange((value) => {
        this.mesh.material.uniforms.xScale.value = value;
      });
      gui.add(parameter, "yScale", 0.00, 1.00, 0.01).onChange((value) => {
        this.mesh.material.uniforms.yScale.value = value;
      });
      gui.add(parameter, "distortion", 0.001, 0.100, 0.001).onChange((value) => {
        this.mesh.material.uniforms.distortion.value = value;
      });
    }
  
    onRaf() {
      this._render();
    }
  }
  
  (() => {
    const stage = new Stage();
  
    stage.init();
  
    const mesh = new Mesh(stage);
  
    mesh.init();
  
    window.addEventListener("resize", () => {
      stage.onResize();
    });
    
    window.addEventListener("load", () => {
      setTimeout(() => {
        mesh._diffuse();
      }, 1000);
    });
  
    const _raf = () => {
      window.requestAnimationFrame(() => {
        stage.onRaf();
        mesh.onRaf();
  
        _raf();
      });
    };
  
    _raf();
  })();
