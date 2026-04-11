import { useEffect, useRef, useState } from 'react'

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

/**
 * WebRTC peer connection for exchanging webcam video.
 * Uses the game WebSocket as a signaling channel.
 *
 * @param {WebSocket|null} ws - Game WebSocket (relays unknown msg types to opponent)
 * @param {MediaStream|null} localStream - From useWebcam
 * @param {boolean} isInitiator - player_index === 0 creates the offer
 * @param {boolean} ready - Start WebRTC only when true (after game_start)
 */
export function useWebRTC(ws, localStream, isInitiator, ready) {
  const remoteVideoRef = useRef(null)
  const pcRef = useRef(null)
  const iceCandidateQueue = useRef([])
  const [connectionState, setConnectionState] = useState('new')

  useEffect(() => {
    if (!ws || !localStream || !ready) return

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    pcRef.current = pc

    // Add local tracks
    localStream.getTracks().forEach(track => {
      pc.addTrack(track, localStream)
    })

    // Remote stream
    pc.ontrack = (e) => {
      if (remoteVideoRef.current && e.streams[0]) {
        remoteVideoRef.current.srcObject = e.streams[0]
      }
    }

    // ICE candidates → send via WebSocket
    pc.onicecandidate = (e) => {
      if (e.candidate && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'webrtc_ice',
          candidate: e.candidate.toJSON(),
        }))
      }
    }

    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState)
    }

    // Handle signaling messages from WebSocket
    function onMessage(e) {
      let msg
      try { msg = JSON.parse(e.data) } catch { return }

      if (msg.type === 'webrtc_offer') {
        pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: msg.sdp }))
          .then(() => {
            // Process queued ICE candidates
            iceCandidateQueue.current.forEach(c => pc.addIceCandidate(new RTCIceCandidate(c)))
            iceCandidateQueue.current = []
            return pc.createAnswer()
          })
          .then(answer => pc.setLocalDescription(answer))
          .then(() => {
            ws.send(JSON.stringify({
              type: 'webrtc_answer',
              sdp: pc.localDescription.sdp,
            }))
          })
          .catch(err => console.warn('WebRTC answer error:', err))
      }

      if (msg.type === 'webrtc_answer') {
        pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: msg.sdp }))
          .then(() => {
            iceCandidateQueue.current.forEach(c => pc.addIceCandidate(new RTCIceCandidate(c)))
            iceCandidateQueue.current = []
          })
          .catch(err => console.warn('WebRTC set answer error:', err))
      }

      if (msg.type === 'webrtc_ice') {
        if (pc.remoteDescription) {
          pc.addIceCandidate(new RTCIceCandidate(msg.candidate))
            .catch(() => {})
        } else {
          iceCandidateQueue.current.push(msg.candidate)
        }
      }
    }

    ws.addEventListener('message', onMessage)

    // Initiator creates offer after a short delay
    if (isInitiator) {
      setTimeout(() => {
        pc.createOffer()
          .then(offer => pc.setLocalDescription(offer))
          .then(() => {
            ws.send(JSON.stringify({
              type: 'webrtc_offer',
              sdp: pc.localDescription.sdp,
            }))
          })
          .catch(err => console.warn('WebRTC offer error:', err))
      }, 500)
    }

    return () => {
      ws.removeEventListener('message', onMessage)
      pc.close()
      pcRef.current = null
    }
  }, [ws, localStream, isInitiator, ready])

  return { remoteVideoRef, connectionState }
}
