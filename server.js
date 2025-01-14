const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// Add debug logging
console.log('Static directory:', path.join(__dirname, 'public'));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Handle root route with debug logging
app.get('/', (req, res) => {
    console.log('Received request for root route');
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Log all requests
app.use((req, res, next) => {
    console.log('Request:', req.method, req.url);
    next();
});

const games = new Map(); // Store game states

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('hostGame', ({ playerName, playerColor }) => {
        const gameId = generateGameId();
        const playerId = socket.id;
        
        games.set(gameId, {
            players: new Map([[playerId, {
                name: playerName,
                isHost: true,
                ready: false,
                color: playerColor
            }]]),
            started: false,
            currentRound: 1,
            deck: [],
            lastPlayedCard: null,
            playedCards: [],
            roundLost: false
        });

        socket.join(gameId);
        socket.emit('gameCreated', { gameId, playerId });
        io.to(gameId).emit('playersUpdate', Array.from(games.get(gameId).players.values()));
    });

    socket.on('joinGame', ({ gameId, playerName, playerColor }) => {
        const game = games.get(gameId);
        if (!game) {
            socket.emit('error', 'Game not found');
            return;
        }
    
        // Add player limit check
        if (game.players.size >= 4) {
            socket.emit('error', 'Max players in lobby');
            return;
        }
    
        const playerId = socket.id;
        game.players.set(playerId, {
            name: playerName,
            isHost: false,
            ready: false,
            color: playerColor
        });
    
        socket.join(gameId);
        socket.emit('gameJoined', { gameId, playerId });
        io.to(gameId).emit('playersUpdate', Array.from(game.players.values()));
    });

    socket.on('startGame', ({ gameId }) => {
        const game = games.get(gameId);
        if (!game) return;

        game.started = true;
        game.deck = shuffleArray([...Array(100)].map((_, i) => i + 1));
        game.currentRound = 1;
        game.lastPlayedCard = null;
        game.playedCards = [];
        game.roundLost = false;

        dealCards(game);
        io.to(gameId).emit('gameStarted', {
            currentRound: game.currentRound,
            players: Array.from(game.players.entries()).map(([id, player]) => ({
                name: player.name,
                isHost: player.isHost,
                handSize: game.currentRound,
                color: player.color
            }))
        });
    });

    socket.on('playCard', ({ gameId, card, playerName }) => {
        const game = games.get(gameId);
        if (!game) return;

        // Get player data
        const playerData = game.players.get(socket.id);
        if (!playerData || !playerData.hand) return;

        // Check if card is valid to play
        if (game.lastPlayedCard && card <= game.lastPlayedCard.card) {
            socket.emit('invalidMove');
            return;
        }

        // Remove the card from player's hand
        const cardIndex = playerData.hand.indexOf(card);
        if (cardIndex === -1) {
            socket.emit('error', 'Card not found in hand');
            return;
        }
        playerData.hand.splice(cardIndex, 1);

        // Update game state
        game.lastPlayedCard = { player: playerName, card };
        game.playedCards.push({ 
            player: playerName, 
            card: card,
            color: playerData.color
        });
        io.to(gameId).emit('cardPlayed', {
            lastPlayedCard: { 
                player: playerName, 
                card: card,
                color: playerData.color
            },
            playedCards: game.playedCards,
            currentRound: game.currentRound
        });

        // Check if round is complete
        checkRoundCompletion(gameId, card);

        // When emitting playersUpdate, include color
        io.to(gameId).emit('playersUpdate', Array.from(game.players.entries()).map(([id, player]) => ({
            name: player.name,
            isHost: player.isHost,
            handSize: player.hand ? player.hand.length : 0,
            color: player.color
        })));
    });

    socket.on('restartGame', ({ gameId }) => {
        const game = games.get(gameId);
        if (!game) return;
        
        game.currentRound = 1;
        resetRound(game, gameId);
    });

    socket.on('updatePlayerColor', ({ gameId, color }) => {
        const game = games.get(gameId);
        if (!game) return;

        const player = game.players.get(socket.id);
        if (player) {
            player.color = color;
            io.to(gameId).emit('playersUpdate', Array.from(game.players.values()));
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        // Clean up games when players disconnect
        for (const [gameId, game] of games) {
            if (game.players.has(socket.id)) {
                game.players.delete(socket.id);
                if (game.players.size === 0) {
                    games.delete(gameId);
                } else {
                    io.to(gameId).emit('playersUpdate', Array.from(game.players.values()));
                }
            }
        }
    });
});

function dealCards(game) {
    const playerCount = game.players.size;
    const cardsPerPlayer = game.currentRound;
    const dealtCards = game.deck.slice(0, playerCount * cardsPerPlayer);
    
    let i = 0;
    for (const [playerId, playerData] of game.players) {
        const playerCards = dealtCards.slice(i * cardsPerPlayer, (i + 1) * cardsPerPlayer);
        // Store the hand in player data
        playerData.hand = playerCards;
        // Send the cards to the player
        io.to(playerId).emit('dealtCards', playerCards);
        i++;
    }
    
    game.deck = game.deck.slice(playerCount * cardsPerPlayer);
}

function checkRoundCompletion(gameId, playedCard) {
    const game = games.get(gameId);
    if (!game) return;

    let roundLost = false;
    let allCardsPlayed = true;

    // Add debug logging
    console.log('Checking round completion...');
    console.log('Played card:', playedCard);

    // Check each player's hand
    for (const [_, playerData] of game.players) {
        if (!playerData.hand) continue;
        console.log('Player hand:', playerData.name, playerData.hand);
        
        if (playerData.hand.length > 0) {
            allCardsPlayed = false;
            
            // Check if any remaining cards are lower than the played card
            if (playerData.hand.some(card => playedCard > card)) {
                console.log('Round lost! Found lower card in hand:', playerData.hand);
                roundLost = true;
                break;
            }
        }
    }

    if (roundLost) {
        console.log('Emitting roundLost event...');
        // Collect all players' hands
        const playerHands = Array.from(game.players.entries()).map(([id, player]) => ({
            name: player.name,
            hand: player.hand || [],
            color: player.color
        }));

        console.log('Player hands data:', playerHands);
    
        // First emit the cardPlayed event to all players to show the losing card
        io.to(gameId).emit('cardPlayed', {
            lastPlayedCard: game.lastPlayedCard,
            playedCards: game.playedCards,
            currentRound: game.currentRound
        });
    
        // Add a small delay before triggering the loss animation
        setTimeout(() => {
            // game.currentRound = 1;
            game.roundLost = true;
            io.to(gameId).emit('roundLost', { playerHands });
            
            // Reset the game state
            // setTimeout(() => {
            //     resetRound(game, gameId);
            // }, 2000);
        }, 500);
    } else if (allCardsPlayed) {
        // Advance to next round
        game.currentRound++;
        game.roundLost = false;
        
        // First notify of the win
        io.to(gameId).emit('roundWon');
        
        // Delay the round reset and new cards
        setTimeout(() => {
            // Reset the game state for next round
            resetRound(game, gameId);
        }, 2000);
    }
}

function resetRound(game, gameId) {
    game.deck = shuffleArray([...Array(100)].map((_, i) => i + 1));
    game.lastPlayedCard = null;
    game.playedCards = [];
    
    // Send round update before dealing cards
    io.to(gameId).emit('roundUpdate', {
        currentRound: game.currentRound,
        lastPlayedCard: null,
        playedCards: []
    });
    
    // Add this: Update player information including hand sizes
    io.to(gameId).emit('gameStarted', {
        currentRound: game.currentRound,
        players: Array.from(game.players.entries()).map(([id, player]) => ({
            name: player.name,
            isHost: player.isHost,
            handSize: game.currentRound,
            color: player.color
        }))
    });
    
    // Deal cards after updates
    dealCards(game);
}

function generateGameId() {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Access the app at http://localhost:${PORT}`);
});
