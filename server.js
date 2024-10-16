const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Initialize game state
let gameState = {
    currentPlayer: 'Ruperto',
    score: {'Ruperto': 100000, 'Juan': 100000, 'Mauricio': 100000},
    diamondStates: [],
    goldBarStates: [],
    rubyStates: [],
    trophyStates: [],
    takenRowsByPlayer: {Ruperto: [], Juan: [], Mauricio: []},
    takenCount: 0,
    timeLeft: 10,
};

// Function to initialize the board
const initializeBoard = () => {
    const tokens = [
        ...Array(8).fill({ type: 'win', points: 20000 }),
        ...Array(8).fill({ type: 'lose', points: -23000 })
    ];
    const shuffledTokens = shuffleArray([...tokens]);

    gameState.diamondStates = shuffledTokens.slice(0, 4).map(token => ({ ...token, emoji: '💎', available: true }));
    gameState.goldBarStates = shuffledTokens.slice(4, 8).map(token => ({ ...token, emoji: '💰', available: true }));
    gameState.rubyStates = shuffledTokens.slice(8, 12).map(token => ({ ...token, emoji: '🔴', available: true }));
    gameState.trophyStates = shuffledTokens.slice(12, 16).map(token => ({ ...token, emoji: '🏆', available: true }));

    gameState.takenCount = 0;
    Object.keys(gameState.takenRowsByPlayer).forEach(player => {
        gameState.takenRowsByPlayer[player] = [];
    });
};

// Function to shuffle an array
const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

// Initialize the board at the start
initializeBoard();

app.use(express.static('public'));



let reiniciosHoy = 0;
let mesaBloqueada = false;
const HORA_REINICIO = 18; // 6 AM

io.on('connection', (socket) => {
    console.log('A user connected');
    socket.emit('initialState', gameState);
    socket.emit('syncReiniciosCount', reiniciosHoy);
    socket.emit('syncBlockState', mesaBloqueada);
    if (mesaBloqueada) {
      socket.emit('mesaBloqueada');
    }
  
    socket.on('updateState', (updatedState) => {
      gameState = updatedState;
      
      if (gameState.takenCount >= 16) {
        resetGame();
      }
      
      io.emit('stateChanged', gameState);
    });
  
    socket.on('updateReiniciosCount', (count) => {
        reiniciosHoy = count;
        io.emit('syncReiniciosCount', reiniciosHoy);
        
        if (reiniciosHoy >= 5) {
          mesaBloqueada = true;
          io.emit('mesaBloqueada');
          io.emit('syncBlockState', mesaBloqueada);
        }
      });
    socket.on('mesaBloqueada', () => {
        mesaBloqueada = true;
        io.emit('mesaBloqueada');
      });
    
      socket.on('mesaDesbloqueada', () => {
        mesaBloqueada = false;
        reiniciosHoy = 0;
        io.emit('mesaDesbloqueada');
        io.emit('syncReiniciosCount', reiniciosHoy);
        io.emit('syncBlockState', mesaBloqueada);
      });

    socket.on('registerPlayer', (username) => {
        if (!gameState.score[username]) {
            gameState.score[username] = 100000;
            gameState.takenRowsByPlayer[username] = [];
        }
        io.emit('updatePlayersList', Object.keys(gameState.score));
    });

    socket.on('takeToken', (data) => {
        const { player, rowId, index } = data;
        const row = gameState[rowId];
        
        if (row[index].available) {
            row[index].available = false;
            gameState.takenCount++;
            gameState.takenRowsByPlayer[player].push(rowId);
            
            // Ensure the score is a number before adding
            if (typeof gameState.score[player] !== 'number') {
                gameState.score[player] = 100000;
            }
            gameState.score[player] += row[index].points;
            
            // Prevent negative scores
            if (gameState.score[player] < 0) {
                gameState.score[player] = 0;
            }
            
            if (gameState.takenCount >= 16) {
                resetGame();
            }
            
            io.emit('stateChanged', gameState);
        }
    });
    

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

const reiniciarContadorYDesbloquearMesa = () => {
    const ahora = new Date();
    if (ahora.getHours() === HORA_REINICIO && ahora.getMinutes() === 0) {
      reiniciosHoy = 0;
      mesaBloqueada = false;
      io.emit('mesaDesbloqueada');
      io.emit('syncReiniciosCount', reiniciosHoy);
      io.emit('syncBlockState', mesaBloqueada);
      console.log("Mesa desbloqueada y contador reiniciado a las 6 AM");
    }
  };
  

// Ejecutar la función de reinicio cada minuto
setInterval(reiniciarContadorYDesbloquearMesa, 60000);

// Function to reset the game
const resetGame = () => {
    initializeBoard();
    gameState.currentPlayer = 'Ruperto';
    gameState.timeLeft = 10;
    io.emit('gameReset', gameState);
};

socket.on('disconnect', () => {
    console.log('A user disconnected');
});


server.listen(3000, () => {
    console.log('listening on *:3000');
});