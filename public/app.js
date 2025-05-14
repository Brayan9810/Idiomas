let socket;
let idiomaActual = "";
let pc = null;
let localStream = null;
let miNombre = "";
let usuarioRemoto = "";

function unirseSala() {
  idiomaActual = document.getElementById('idioma').value;
  miNombre = prompt("Ingresa tu nombre:") || "Anónimo";

  document.getElementById('seleccionIdioma').classList.add('oculto');
  document.getElementById('chat').classList.remove('oculto');
  document.getElementById('usuarios').classList.remove('oculto');
  document.getElementById('videochat').classList.remove('oculto');

  const socket = new WebSocket(
  (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host
);


  socket.onopen = () => {
    socket.send(JSON.stringify({
      tipo: 'join',
      idioma: idiomaActual,
      nombre: miNombre
    }));
  };

  socket.onmessage = async (event) => {
    const data = JSON.parse(event.data);

    if (data.tipo === 'mensaje') {
      const div = document.createElement('div');
      div.textContent = `${data.nombre}: ${data.texto}`;
      document.getElementById('mensajes').appendChild(div);
    }
    

    if (data.tipo === 'usuarios') {
      const lista = document.getElementById('listaUsuarios');
      lista.innerHTML = '';
      data.lista.forEach(nombre => {
        if (nombre !== miNombre) {
          const li = document.createElement('li');
          li.textContent = nombre;
          li.style.cursor = 'pointer';
          li.onclick = () => {
            usuarioRemoto = nombre;
            socket.send(JSON.stringify({
              tipo: 'invitar',
              para: usuarioRemoto
            }));
            alert(`Invitación enviada a ${usuarioRemoto}`);
          };
          lista.appendChild(li);
        }
      });
    }

    if (data.tipo === 'invitacion') {
      usuarioRemoto = data.de;
      document.getElementById('mensajeInvitacion').textContent = `${usuarioRemoto} quiere hacer una videollamada contigo.`;
      document.getElementById('modalInvitacion').classList.remove('oculto');
    }

    if (data.tipo === 'respuesta-invitacion') {
      if (data.aceptada) {
        usuarioRemoto = data.de;
        iniciarLlamada();
      } else {
        alert(`${data.de} rechazó tu invitación.`);
      }
    }

    if (data.tipo === 'oferta') {
      await prepararRecepcionLlamada(data.oferta);
    }

    if (data.tipo === 'respuesta') {
      await pc.setRemoteDescription(new RTCSessionDescription(data.respuesta));
    }

    if (data.tipo === 'ice' && data.candidato) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidato));
      } catch (e) {
        console.error('Error ICE:', e);
      }
    }
  };
}

function enviarMensaje() {
  const mensaje = document.getElementById('mensajeInput').value;
  socket.send(JSON.stringify({ tipo: 'mensaje', texto}));
  const div = document.createElement('div');
  //div.textContent = `Tú: ${mensaje}`;
  document.getElementById('mensajes').appendChild(div);
  document.getElementById('mensajeInput').value = "";
}

function iniciarLlamada() {
  establecerConexion();
  crearOferta();
}

async function establecerConexion() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  document.getElementById('localVideo').srcObject = localStream;

  pc = new RTCPeerConnection();
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.send(JSON.stringify({
        tipo: 'ice',
        candidato: event.candidate
      }));
    }
  };

  pc.ontrack = (event) => {
    document.getElementById('remoteVideo').srcObject = event.streams[0];
  };
}

async function crearOferta() {
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  socket.send(JSON.stringify({
    tipo: 'oferta',
    oferta: offer
  }));
}

async function prepararRecepcionLlamada(oferta) {
  await establecerConexion();
  await pc.setRemoteDescription(new RTCSessionDescription(oferta));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  socket.send(JSON.stringify({
    tipo: 'respuesta',
    respuesta: answer
  }));
}

function aceptarInvitacion() {
  document.getElementById('modalInvitacion').classList.add('oculto');
  socket.send(JSON.stringify({
    tipo: 'respuesta-invitacion',
    para: usuarioRemoto,
    aceptada: true
  }));
  iniciarLlamada();
}

function rechazarInvitacion() {
  document.getElementById('modalInvitacion').classList.add('oculto');
  socket.send(JSON.stringify({
    tipo: 'respuesta-invitacion',
    para: usuarioRemoto,
    aceptada: false
  }));
}