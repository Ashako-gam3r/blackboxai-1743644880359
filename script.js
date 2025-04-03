// Game configuration
const config = {
    width: 20,
    height: 15,
    speed: 200, // ms between moves
    ghostSpeed: 300,
    lives: 3
};

// Game state
let state = {
    score: 0,
    lives: config.lives,
    pacman: { x: 1, y: 1, direction: 'right' },
    ghosts: [],
    pellets: [],
    walls: [],
    gameInterval: null,
    ghostInterval: null
};
let hiddenPellets = []; // Tracks pellets temporarily hidden by ghosts

// Maze layout (ASCII)
const maze = `
####################
#..................#
#.###.###..###.###.#
#..................#
#.###.#....#.###.###
#.....#....#.......#
#.###.#....#.###.###
#..................#
###.###..###.###.###
#..................#
#.###.###..###.###.#
#..................#
####################
`.trim().split('\n');

// Initialize game
function initGame() {
    // Parse maze
    state.walls = [];
    state.pellets = [];
    hiddenPellets = [];
    
    maze.forEach((row, y) => {
        row.split('').forEach((cell, x) => {
            if (cell === '#') state.walls.push({ x, y });
            else if (cell === '.') state.pellets.push({ x, y });
        });
    });

    // Reset game state
    state.score = 0;
    state.lives = config.lives;
    state.pacman = { x: 1, y: 1, direction: 'right' };

    // Initialize ghosts at safe distances
    state.ghosts = [];
    const ghostPositions = [
        { x: 15, y: 5, color: 1, direction: 'left' },
        { x: 5, y: 10, color: 2, direction: 'up' },
        { x: 15, y: 10, color: 3, direction: 'right' },
        { x: 5, y: 5, color: 4, direction: 'down' }
    ].filter(pos => {
        // Ensure ghosts aren't adjacent to player
        const dx = Math.abs(pos.x - state.pacman.x);
        const dy = Math.abs(pos.y - state.pacman.y);
        return dx > 2 || dy > 2;
    });
    
    state.ghosts = ghostPositions;
    updateUI();
}

// Render game grid
function renderGrid() {
    const grid = document.getElementById('game-grid');
    let output = '';
    
    for (let y = 0; y < config.height; y++) {
        for (let x = 0; x < config.width; x++) {
            if (state.walls.some(w => w.x === x && w.y === y)) {
                output += `<span class="wall">#</span>`;
            } else if (state.pellets.some(p => p.x === x && p.y === y)) {
                output += `<span class="pellet">.</span>`;
            } else if (state.pacman.x === x && state.pacman.y === y) {
                output += `<span class="pacman">@</span>`;
            } else {
                const ghost = state.ghosts.find(g => g.x === x && g.y === y);
                if (ghost) {
                    output += `<span class="ghost ghost-${ghost.color}">G</span>`;
                } else {
                    output += ' ';
                }
            }
        }
        output += '\n';
    }
    
    grid.innerHTML = output;
}

// Update UI elements
function updateUI() {
    document.getElementById('score').textContent = state.score;
    document.getElementById('lives').textContent = state.lives;
    renderGrid();
}

// Move Pac-Man
function movePacman() {
    const { x, y, direction } = state.pacman;
    let newX = x, newY = y;
    
    switch (direction) {
        case 'up': newY--; break;
        case 'down': newY++; break;
        case 'left': newX--; break;
        case 'right': newX++; break;
    }
    
    // Check wall collision
    if (state.walls.some(w => w.x === newX && w.y === newY)) {
        return;
    }
    
    // Check boundaries
    if (newX < 0 || newX >= config.width || newY < 0 || newY >= config.height) {
        return;
    }
    
    // Update position
    state.pacman.x = newX;
    state.pacman.y = newY;
    
    // Check pellet collision
    const pelletIndex = state.pellets.findIndex(p => p.x === newX && p.y === newY);
    if (pelletIndex !== -1) {
        state.pellets.splice(pelletIndex, 1);
        state.score += 10;
        document.getElementById('chomp-sound').play();
    }
    
    // Check ghost collision
    checkGhostCollision();
    
    // Check win condition
    if (state.pellets.length === 0) {
        endGame(true);
    }
    
    updateUI();
}

// Move ghosts
function moveGhosts() {
    // First restore any pellets that ghosts are moving away from
    state.ghosts.forEach(ghost => {
        const directions = ['up', 'down', 'left', 'right'];
        let newDirection = ghost.direction;
        let attempts = 0;
        let moved = false;
        
        while (!moved && attempts < 4) {
            let newX = ghost.x, newY = ghost.y;
            
            switch (newDirection) {
                case 'up': newY--; break;
                case 'down': newY++; break;
                case 'left': newX--; break;
                case 'right': newX++; break;
            }
            
            // Check if move is valid
            if (!state.walls.some(w => w.x === newX && w.y === newY) &&
                newX >= 0 && newX < config.width && 
                newY >= 0 && newY < config.height) {
                
                // Restore pellet if ghost was covering one
                const pelletIndex = hiddenPellets.findIndex(p => p.x === ghost.x && p.y === ghost.y);
                if (pelletIndex !== -1) {
                    state.pellets.push(hiddenPellets[pelletIndex]);
                    hiddenPellets.splice(pelletIndex, 1);
                }
                
                // Hide pellet if ghost is moving onto one
                const newPelletIndex = state.pellets.findIndex(p => p.x === newX && p.y === newY);
                if (newPelletIndex !== -1) {
                    hiddenPellets.push(state.pellets[newPelletIndex]);
                    state.pellets.splice(newPelletIndex, 1);
                }
                
                ghost.x = newX;
                ghost.y = newY;
                moved = true;
            } else {
                // Try a different direction
                newDirection = directions[Math.floor(Math.random() * directions.length)];
                attempts++;
            }
        }
        
        ghost.direction = newDirection;
    });
    
    checkGhostCollision();
    updateUI();
}

// Check ghost collisions
function checkGhostCollision() {
    state.ghosts.forEach(ghost => {
        if (ghost.x === state.pacman.x && ghost.y === state.pacman.y) {
            // Lose life
            state.lives--;
            if (state.lives <= 0) {
                endGame(false);
            } else {
                // Reset positions
                state.pacman = { x: 1, y: 1, direction: 'right' };
                document.getElementById('game-over-sound').play();
            }
        }
    });
}

// End game
function endGame(win) {
    clearInterval(state.gameInterval);
    clearInterval(state.ghostInterval);
    
    document.getElementById('final-score').textContent = state.score;
    document.getElementById('game-over-screen').classList.remove('hidden');
    document.getElementById('game-container').classList.add('hidden');
    document.getElementById('game-over-sound').play();
}

// Start game
function startGame() {
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-container').classList.remove('hidden');
    
    initGame();
    
    // Start game loop
    state.gameInterval = setInterval(movePacman, config.speed);
    state.ghostInterval = setInterval(moveGhosts, config.ghostSpeed);
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Start game button
    document.getElementById('start-btn').addEventListener('click', startGame);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !document.getElementById('start-screen').classList.contains('hidden')) {
            startGame();
        }
    });
    
    // Restart game button
    document.getElementById('restart-btn').addEventListener('click', () => {
        document.getElementById('game-over-screen').classList.add('hidden');
        startGame();
    });
    
    // Keyboard controls
    document.addEventListener('keydown', (e) => {
        switch (e.key) {
            case 'ArrowUp': state.pacman.direction = 'up'; break;
            case 'ArrowDown': state.pacman.direction = 'down'; break;
            case 'ArrowLeft': state.pacman.direction = 'left'; break;
            case 'ArrowRight': state.pacman.direction = 'right'; break;
        }
    });
});