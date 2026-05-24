// Multiplayer WebSocket Client Module
let socket = null;
let currentRoomId = null;
let isHost = false;

export function getSocketState() {
  return socket ? socket.readyState : null;
}

export function connectSocket(onEvent) {
  // Disconnect existing if any
  if (socket) {
    socket.close();
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  socket = new WebSocket(`${protocol}//${host}/ws`);

  socket.onopen = () => {
    onEvent({ type: 'connected' });
  };

  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'room_created':
          currentRoomId = message.roomId;
          isHost = true;
          onEvent({ type: 'room_joined', roomId: message.roomId, players: message.players, text: message.text, isHost: true });
          break;
          
        case 'player_joined':
          onEvent({ type: 'room_update', players: message.players, text: message.text });
          break;
          
        case 'player_left':
          onEvent({ type: 'room_update', players: message.players, leftUser: message.leftUser });
          break;
          
        case 'new_host':
          if (message.hostName === localStorage.getItem('username')) {
            isHost = true;
          }
          onEvent({ type: 'host_update', hostName: message.hostName, isHost });
          break;

        case 'countdown':
          onEvent({ type: 'countdown', value: message.value, text: message.text });
          break;

        case 'race_start':
          onEvent({ type: 'race_start' });
          break;

        case 'progress_update':
          onEvent({ type: 'progress_update', players: message.players });
          break;

        case 'your_rank':
          onEvent({ type: 'your_rank', rank: message.rank });
          break;

        case 'race_finished':
          onEvent({ type: 'race_finished', results: message.results });
          break;

        case 'error':
          onEvent({ type: 'error', message: message.message });
          break;
      }
    } catch (err) {
      console.error('Error parsing server message:', err);
    }
  };

  socket.onclose = () => {
    onEvent({ type: 'disconnected' });
    socket = null;
  };

  socket.onerror = (err) => {
    console.error('Socket error:', err);
    onEvent({ type: 'error', message: 'WebSocket connection failed.' });
  };
}

export function createRoom(username, userId) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ type: 'create_room', username, userId }));
}

export function joinRoom(roomId, username, userId) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ type: 'join_room', roomId, username, userId }));
}

export function triggerRaceStart() {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ type: 'start_countdown' }));
}

export function sendProgress(progress, wpm, accuracy) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ type: 'progress', progress, wpm, accuracy }));
}

export function sendFinish(wpm, accuracy) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ type: 'finish', wpm, accuracy }));
}

export function disconnect() {
  if (socket) {
    socket.close();
    socket = null;
  }
  currentRoomId = null;
  isHost = false;
}

// ----------------------------------------------------
// UI RENDERING HELPERS
// ----------------------------------------------------

// Render live opponent progress rails
export function renderOpponentTracks(containerId, players, clientUsername) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '';

  players.forEach(player => {
    const isClient = player.username === clientUsername;
    
    const trackRow = document.createElement('div');
    trackRow.className = `track-row ${player.finished ? 'finished-player' : ''}`;

    const infoDiv = document.createElement('div');
    infoDiv.className = 'track-info';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'player-name';
    nameSpan.textContent = player.username + (isClient ? ' (You)' : '');
    
    const wpmSpan = document.createElement('span');
    wpmSpan.className = 'player-wpm';
    wpmSpan.textContent = `${Math.round(player.wpm)} WPM`;

    infoDiv.appendChild(nameSpan);
    infoDiv.appendChild(wpmSpan);

    const progressOuter = document.createElement('div');
    progressOuter.className = 'track-progress-bar';

    const progressRail = document.createElement('div');
    progressRail.className = 'rail';
    progressRail.style.width = `${Math.round(player.progress * 100)}%`;

    progressOuter.appendChild(progressRail);
    
    trackRow.appendChild(infoDiv);
    trackRow.appendChild(progressOuter);

    container.appendChild(trackRow);
  });
}

// Render Results Podium
export function renderPodium(containerId, results) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '';

  // Order of standing for styling: 2nd place on left, 1st in middle, 3rd on right
  const podiumOrder = [];
  if (results[1]) podiumOrder.push({ pos: 'second', data: results[1] });
  if (results[0]) podiumOrder.push({ pos: 'first', data: results[0] });
  if (results[2]) podiumOrder.push({ pos: 'third', data: results[2] });

  podiumOrder.forEach(stand => {
    const standDiv = document.createElement('div');
    standDiv.className = `podium-stand ${stand.pos}`;

    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'avatar';
    avatarDiv.textContent = stand.pos === 'first' ? '👑' : stand.pos === 'second' ? '⭐' : '⚡';

    const nameDiv = document.createElement('div');
    nameDiv.className = 'name';
    nameDiv.textContent = stand.data.username;

    const scoreDiv = document.createElement('div');
    scoreDiv.className = 'score';
    scoreDiv.textContent = `${Math.round(stand.data.wpm)} WPM`;

    const rankDiv = document.createElement('div');
    rankDiv.className = 'rank-num';
    rankDiv.textContent = stand.pos === 'first' ? '1' : stand.pos === 'second' ? '2' : '3';

    standDiv.appendChild(avatarDiv);
    standDiv.appendChild(nameDiv);
    standDiv.appendChild(scoreDiv);
    standDiv.appendChild(rankDiv);

    container.appendChild(standDiv);
  });
}
