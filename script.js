let peerConn;
let localStream;
let db;
let callId = "my-call";

function initFirebase() {
  const firebaseConfig = {
    apiKey: "AIzaSyAmWBSqhsChYspp8cnPwV9E7EOnyB4jcqE",
    authDomain: "nonu-a2b10.firebaseapp.com",
    databaseURL: "https://nonu-a2b10-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "nonu-a2b10",
    storageBucket: "nonu-a2b10.firebasestorage.app",
    messagingSenderId: "563739635078",
    appId: "1:563739635078:web:52d355f0d9411317829007"
  };

  firebase.initializeApp(firebaseConfig);
  db = firebase.database();
}

async function getMediaStream() {
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  return localStream;
}

// ==========================
// 📞 CALLER LOGIC
// ==========================
function setupCaller() {
  document.getElementById("callBtn").onclick = async () => {
    const ring = document.getElementById("ringtone");
    const statusText = document.getElementById("status");
    const hangupBtn = document.getElementById("hangupBtn");

    const servers = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        {
          urls: "turn:relay1.expressturn.com:3478",
          username: "efh4VvB3Zzq0PW0vwXxY",
          credential: "tZjNFGnDqR3RFLQf"
        }
      ]
    };

    peerConn = new RTCPeerConnection(servers);

    const stream = await getMediaStream();
    stream.getTracks().forEach(track => peerConn.addTrack(track, stream));

    peerConn.onicecandidate = e => {
      if (e.candidate) {
        db.ref(`${callId}/callerCandidates`).push(JSON.stringify(e.candidate));
      }
    };

    peerConn.ontrack = e => {
      document.getElementById("remoteAudio").srcObject = e.streams[0];
    };

    const offer = await peerConn.createOffer();
    await peerConn.setLocalDescription(offer);
    db.ref(`${callId}`).set({ offer: JSON.stringify(offer) });

    if (ring) ring.play();
    if (statusText) statusText.textContent = "📞 Ringing...";
    if (hangupBtn) hangupBtn.style.display = "inline-block";

    db.ref(`${callId}/answer`).on("value", async snapshot => {
      const data = snapshot.val();
      if (data && !peerConn.currentRemoteDescription) {
        const answer = new RTCSessionDescription(JSON.parse(data));
        await peerConn.setRemoteDescription(answer);
        if (statusText) statusText.textContent = "✅ Call connected";
        if (ring) ring.pause();
      }
    });

    db.ref(`${callId}/receiverCandidates`).on("child_added", snapshot => {
      const candidate = new RTCIceCandidate(JSON.parse(snapshot.val()));
      peerConn.addIceCandidate(candidate);
    });

    if (hangupBtn) {
      hangupBtn.onclick = () => {
        if (peerConn) {
          peerConn.close();
          peerConn = null;
        }
        db.ref(`${callId}`).remove();
        if (statusText) statusText.textContent = "Call ended.";
        hangupBtn.style.display = "none";
        if (ring) {
          ring.pause();
          ring.currentTime = 0;
        }
      };
    }
  };
}

// ==========================
// 📥 RECEIVER LOGIC
// ==========================
function setupReceiver() {
  const ring = document.getElementById("ringtone");
  const statusText = document.getElementById("status");
  const answerBtn = document.getElementById("answerBtn");
  const hangupBtn = document.getElementById("hangupBtn");

  const servers = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      {
        urls: "turn:relay1.expressturn.com:3478",
        username: "efh4VvB3Zzq0PW0vwXxY",
        credential: "tZjNFGnDqR3RFLQf"
      }
    ]
  };

  peerConn = new RTCPeerConnection(servers);

  getMediaStream().then(stream => {
    stream.getTracks().forEach(track => peerConn.addTrack(track, stream));
  });

  peerConn.ontrack = e => {
    document.getElementById("remoteAudio").srcObject = e.streams[0];
  };

  peerConn.onicecandidate = e => {
    if (e.candidate) {
      db.ref(`${callId}/receiverCandidates`).push(JSON.stringify(e.candidate));
    }
  };

  db.ref(`${callId}`).on("value", async snapshot => {
    const data = snapshot.val();
    console.log("🔥 Data received on Page B:", data);
    if (data && data.offer) {
      if (statusText) statusText.textContent = "📞 Incoming call...";
      if (answerBtn) answerBtn.style.display = "inline-block";
      if (hangupBtn) hangupBtn.style.display = "inline-block";
      if (ring) ring.play();

      answerBtn.onclick = async () => {
        const offer = new RTCSessionDescription(JSON.parse(data.offer));
        await peerConn.setRemoteDescription(offer);

        const answer = await peerConn.createAnswer();
        await peerConn.setLocalDescription(answer);
        db.ref(`${callId}/answer`).set(JSON.stringify(answer));

        if (statusText) statusText.textContent = "✅ Call connected";
        if (ring) ring.pause();
      };

      hangupBtn.onclick = () => {
        if (peerConn) {
          peerConn.close();
          peerConn = null;
        }
        db.ref(`${callId}`).remove();
        if (answerBtn) answerBtn.style.display = "none";
        if (hangupBtn) hangupBtn.style.display = "none";
        if (statusText) statusText.textContent = "Call ended.";
        if (ring) {
          ring.pause();
          ring.currentTime = 0;
        }
      };
    }
  });

  db.ref(`${callId}/callerCandidates`).on("child_added", snapshot => {
    const candidate = new RTCIceCandidate(JSON.parse(snapshot.val()));
    peerConn.addIceCandidate(candidate);
  });
}
