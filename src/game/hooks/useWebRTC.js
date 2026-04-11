import { useCallback, useEffect, useRef, useState } from 'react'

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

/**
 * WebRTC peer connection for exchanging webcam video.
 * Uses the game WebSocket as a signaling channel.
 *
 * @param {WebSocket|null} ws - Game WebSocket
 * @param {MediaStream|null} localStream - local webcam stream
 * @param {boolean} isInitiator - player_index === 0 creates the offer
 * @param {boolean} ready - Start WebRTC only when true (after game_start)
 */
export function useWebRTC(ws, localStream, isInitiator, ready) {
  const remoteVideoRef = useRef(null)
  const remoteStreamRef = useRef(null)
  const pcRef = useRef(null)
  const iceCandidateQueue = useRef([])
  const [connectionState, setConnectionState] = useState('new')

  const attachRemoteVideoRef = useCallback((node) => {
    remoteVideoRef.current = node
    if (node && remoteStreamRef.current && node.srcObject !== remoteStreamRef.current) {
      node.srcObject = remoteStreamRef.current
      node.play?.().catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (!ws || !ready || !localStream) return

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    pcRef.current = pc
    let offerTimer = null
    console.log('[WebRTC] init', { isInitiator, ready, trackCount: localStream.getTracks().length })

    // Add local tracks
    localStream.getTracks().forEach(track => {
      pc.addTrack(track, localStream)
    })

    // Remote stream
    pc.ontrack = (e) => {
      if (e.streams[0]) {
        remoteStreamRef.current = e.streams[0]
      }
      if (remoteVideoRef.current && remoteStreamRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current
        remoteVideoRef.current.play?.().catch(() => {})
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
      console.log('[WebRTC] connection state', pc.connectionState)
    }

    function onMessage(e) {
      let msg
      try { msg = JSON.parse(e.data) } catch { return }

      if (msg.type === 'webrtc_offer') {
        console.log('[WebRTC] received offer')
        pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: msg.sdp }))
          .then(() => {
            iceCandidateQueue.current.forEach(c => pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {}))
            iceCandidateQueue.current = []
            return pc.createAnswer()
          })
          .then(answer => pc.setLocalDescription(answer))
          .then(() => {
            ws.send(JSON.stringify({ type: 'webrtc_answer', sdp: pc.localDescription.sdp }))
          })
          .catch(err => console.warn('WebRTC answer error:', err))
      }

      if (msg.type === 'webrtc_answer') {
        console.log('[WebRTC] received answer')
        pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: msg.sdp }))
          .then(() => {
            iceCandidateQueue.current.forEach(c => pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {}))
            iceCandidateQueue.current = []
          })
          .catch(err => console.warn('WebRTC set answer error:', err))
      }

      if (msg.type === 'webrtc_ice') {
        if (pc.remoteDescription) {
          pc.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch(() => {})
        } else {
          iceCandidateQueue.current.push(msg.candidate)
        }
      }
    }

    ws.addEventListener('message', onMessage)

    // Initiator creates offer after a short delay
    if (isInitiator) {
      offerTimer = setTimeout(() => {
        console.log('[WebRTC] creating offer')
        pc.createOffer()
          .then(offer => pc.setLocalDescription(offer))
          .then(() => {
            ws.send(JSON.stringify({ type: 'webrtc_offer', sdp: pc.localDescription.sdp }))
          })
          .catch(err => console.warn('WebRTC offer error:', err))
      }, 1000)
    }

    return () => {
      if (offerTimer) clearTimeout(offerTimer)
      ws.removeEventListener('message', onMessage)
      pc.close()
      pcRef.current = null
      console.log('[WebRTC] cleanup')
    }
  }, [ws, ready, localStream, isInitiator])

  return { remoteVideoRef, attachRemoteVideoRef, connectionState }
}
