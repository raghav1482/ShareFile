const socket = io("https://sharefile-213g.onrender.com/"); // Connect to the signaling server

const peer = new RTCPeerConnection();
let dataChannel;
let receivedChunks = [];
let receivedFileName = "received_file"; // Default file name

// Handle ICE candidates
peer.onicecandidate = (event) => {
    if (event.candidate) {
        socket.emit("ice-candidate", event.candidate);
    }
};

// Handle remote ICE candidates
socket.on("ice-candidate", (candidate) => {
    peer.addIceCandidate(new RTCIceCandidate(candidate));
});

// Create offer and data channel (only for the offerer)
async function createOffer() {
    dataChannel = peer.createDataChannel("fileTransfer");
    setupDataChannel();

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    socket.emit("offer", offer);
}

// Handle incoming offer
socket.on("offer", async (offer) => {
    peer.ondatachannel = (event) => {
        dataChannel = event.channel;
        setupDataChannel();
    };

    await peer.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    socket.emit("answer", answer);
});

// Handle answer
socket.on("answer", async (answer) => {
    await peer.setRemoteDescription(new RTCSessionDescription(answer));
});

// Set up the data channel
function setupDataChannel() {
    dataChannel.onopen = () => console.log("Data channel is open");
    dataChannel.onmessage = (event) => handleFileChunk(event.data);
}

// Send file in chunks
async function sendFile() {
    if (!dataChannel || dataChannel.readyState !== "open") {
        alert("Connection is not ready yet!");
        return;
    }

    const fileInput = document.getElementById("fileInput");
    if (!fileInput.files.length) return;

    const file = fileInput.files[0];
    const chunkSize = 16 * 1024; // 16KB chunks
    let offset = 0;

    while (offset < file.size) {
        const chunk = file.slice(offset, offset + chunkSize);
        const arrayBuffer = await chunk.arrayBuffer();
        dataChannel.send(arrayBuffer);
        offset += chunkSize;
    }

    dataChannel.send("EOF"); // End of file signal
}

// Handle received file chunks
function handleFileChunk(data) {
    if (data === "EOF") {
        // Assemble the received file
        const receivedBlob = new Blob(receivedChunks);
        const downloadLink = document.createElement("a");
        downloadLink.classList.add("file-received");
        downloadLink.href = URL.createObjectURL(receivedBlob);
        downloadLink.download = receivedFileName;
        downloadLink.textContent = "Download File";
        document.getElementById("receivedFiles").appendChild(downloadLink);
        receivedChunks = [];
    } else {
        receivedChunks.push(data);
    }
}

// Start connection when page loads
createOffer();
