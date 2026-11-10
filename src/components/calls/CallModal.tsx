import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '../../context/ChatContext';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  PhoneIncoming,
  ChevronLeft,
  X,
  RefreshCw,
  Volume2,
  VolumeX,
  Users,
} from 'lucide-react';

export const CallModal: React.FC = () => {
  const {
    activeCall,
    incomingCall,
    localStream,
    remoteStream,
    isAudioMuted,
    isVideoMuted,
    isScreenSharing,
    isSpeakerOn,
    cameraFacingMode,
    groupCallParticipants,
    usersDirectory,
    acceptIncomingCall,
    declineOrEndCall,
    toggleMuteAudio,
    toggleMuteVideo,
    toggleScreenShare,
    switchCamera,
    toggleSpeakerphone,
  } = useChat();

  const [durationSeconds, setDurationSeconds] = useState(0);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // Start call duration timer ONLY when the call is actually connected
  useEffect(() => {
    if (!activeCall || activeCall.status !== 'connected') {
      setDurationSeconds(0);
      return;
    }

    const timer = setInterval(() => {
      setDurationSeconds(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [activeCall?.callId, activeCall?.status]);

  // Attach local camera/screen stream to PIP video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, activeCall, isVideoMuted, isScreenSharing]);

  // Attach remote stream to both video and dedicated audio elements for guaranteed real-time voice
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.volume = isSpeakerOn ? 1.0 : 0.25;
      remoteAudioRef.current.play().catch(() => {});
    }
  }, [remoteStream, activeCall, isSpeakerOn]);

  // Update speaker volume immediately when toggled
  useEffect(() => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.volume = isSpeakerOn ? 1.0 : 0.25;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.volume = isSpeakerOn ? 1.0 : 0.25;
    }
  }, [isSpeakerOn]);

  // Incoming Call Banner (shows caller name, avatar, and Accept / Decline buttons)
  if (incomingCall && !activeCall) {
    return (
      <div className="fixed top-6 right-6 z-50 bg-[#101228]/95 backdrop-blur-xl border border-[#4A3AFF]/50 rounded-3xl p-5 shadow-2xl shadow-[#050611]/90 w-88 text-white animate-bounce">
        <div className="flex items-center gap-3.5 mb-4">
          <img
            src={incomingCall.callerAvatar}
            alt={incomingCall.callerName}
            className="w-12 h-12 rounded-2xl object-cover ring-2 ring-[#7C3AED]"
          />
          <div className="flex-1 overflow-hidden">
            <div className="text-xs font-semibold text-[#A78BFA] uppercase tracking-wider flex items-center gap-1.5">
              <PhoneIncoming className="w-3.5 h-3.5" />
              <span>Входящий {incomingCall.type === 'video' ? 'видеозвонок' : 'аудиозвонок'}</span>
            </div>
            <h4 className="text-base font-bold truncate">{incomingCall.callerName}</h4>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={declineOrEndCall}
            className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <PhoneOff className="w-4 h-4" />
            <span>Отклонить</span>
          </button>
          <button
            type="button"
            onClick={acceptIncomingCall}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Phone className="w-4 h-4" />
            <span>Принять</span>
          </button>
        </div>
      </div>
    );
  }

  if (!activeCall) return null;

  const formatDuration = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Resolve remote peer info (when we are the caller, show callee's name/avatar; when callee, show caller's)
  const peerUser = usersDirectory.find(u => u.uid === activeCall.calleeId);
  const displayPeerName =
    groupCallParticipants.length > 1
      ? activeCall.callerName
      : peerUser?.displayName || activeCall.callerName || 'Собеседник';
  const displayPeerAvatar =
    groupCallParticipants.length > 1
      ? activeCall.callerAvatar
      : peerUser?.avatarUrl || activeCall.callerAvatar;

  const hasRemoteVideo = Boolean(remoteStream && remoteStream.getVideoTracks().length > 0);
  const isGroupCall = groupCallParticipants.length > 1;

  return (
    <div className="fixed inset-0 bg-[#070814]/95 backdrop-blur-xl flex items-center justify-center p-3 md:p-6 z-50 text-white select-none">
      {/* Dedicated hidden audio element so WebRTC voice audio always plays in real time */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      <div className="relative w-full max-w-md h-[90vh] max-h-[780px] rounded-[36px] overflow-hidden bg-gradient-to-b from-[#1A133B] via-[#11132E] to-[#090B1A] border-2 border-[#32386E] shadow-[0_24px_80px_rgba(0,0,0,0.85)] flex flex-col justify-between">
        {/* Main Remote Video / Avatar / Group Grid Backdrop */}
        <div className="absolute inset-0">
          {hasRemoteVideo ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : isGroupCall ? (
            <div className="w-full h-full flex flex-col justify-center bg-[radial-gradient(circle_at_50%_30%,rgba(124,58,237,0.35),rgba(10,12,28,0.95))] p-5 pt-20 pb-28 overflow-y-auto">
              <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-indigo-300 mb-3">
                <Users className="w-4 h-4" />
                <span>Групповой звонок ({groupCallParticipants.length + 1} уч.)</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {groupCallParticipants.map(part => (
                  <div
                    key={part.uid}
                    className="rounded-2xl bg-[#141736]/90 border border-[#2E356B] p-3 flex flex-col items-center justify-center text-center"
                  >
                    <img
                      src={part.avatarUrl}
                      alt={part.displayName}
                      className="w-16 h-16 rounded-full object-cover ring-2 ring-[#7C3AED] mb-2"
                    />
                    <span className="text-xs font-bold text-white truncate max-w-full">
                      {part.displayName}
                    </span>
                    <span
                      className={`text-[10px] font-mono mt-0.5 ${
                        part.status === 'connected' ? 'text-emerald-400' : 'text-amber-300'
                      }`}
                    >
                      {part.status === 'connected' ? 'В звонке' : 'Вызов...'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_30%,rgba(124,58,237,0.35),rgba(10,12,28,0.95))] p-6 text-center">
              <div className="relative mb-4">
                <img
                  src={displayPeerAvatar}
                  alt={displayPeerName}
                  className="w-32 h-32 rounded-full object-cover ring-4 ring-[#8B5CF6]/60 shadow-[0_0_40px_rgba(139,92,246,0.6)]"
                />
              </div>
              <p className="text-xs text-[#B4BCE6] max-w-xs">
                {activeCall.status === 'ringing'
                  ? 'Вызов собеседника в реальном времени (WebRTC)...'
                  : activeCall.isScreenSharing
                  ? 'Демонстрация экрана активна'
                  : 'Соединение WebRTC установлено — вы на связи'}
              </p>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/75 pointer-events-none" />
        </div>

        {/* Top Bar: < | Peer Name + Status/Timer | X */}
        <div className="relative z-10 flex items-center justify-between px-5 pt-5 pb-3">
          <button
            type="button"
            onClick={declineOrEndCall}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center text-white transition-colors cursor-pointer"
            title="Свернуть / Выйти"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="text-center min-w-0 px-2">
            <h3 className="text-base font-extrabold text-white truncate">
              {displayPeerName}
            </h3>
            <p className="text-xs text-[#D5DAFF] font-mono mt-0.5">
              {activeCall.status === 'connected'
                ? formatDuration(durationSeconds)
                : 'Вызов...'}
            </p>
          </div>

          <button
            type="button"
            onClick={declineOrEndCall}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center text-white transition-colors cursor-pointer"
            title="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Picture-in-Picture (PIP) Self-View in Top-Right */}
        <div className="relative z-10 flex-1 px-5 pointer-events-none">
          <div className="ml-auto w-28 h-38 rounded-2xl overflow-hidden bg-[#151836] border-2 border-white/25 shadow-2xl relative pointer-events-auto">
            {localStream && (!isVideoMuted || isScreenSharing) && localStream.getVideoTracks().length > 0 ? (
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className={`w-full h-full object-cover ${
                  !isScreenSharing && cameraFacingMode === 'user' ? 'scale-x-[-1]' : ''
                }`}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-[#181C3E] text-center p-2">
                {isAudioMuted ? (
                  <MicOff className="w-6 h-6 text-rose-400 mb-1" />
                ) : (
                  <Mic className="w-6 h-6 text-[#A78BFA] mb-1" />
                )}
                <span className="text-[11px] font-bold text-white">Вы</span>
                <span className="text-[9px] text-[#8E96C2]">
                  {isScreenSharing ? 'Экран' : isAudioMuted ? 'Микрофон выкл.' : 'На связи'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Call Control Buttons:
            1. Микрофон (Вкл/Выкл)
            2. Камера (Вкл/Выкл)
            3. Сменить камеру (Фронтальная / Задняя)
            4. Громкая связь (Динамик)
            5. Демонстрация экрана
            6. Завершить вызов */}
        <div className="relative z-10 flex items-center justify-center gap-2.5 sm:gap-3.5 px-4 pb-7 pt-4 flex-wrap">
          <button
            type="button"
            onClick={toggleMuteAudio}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              isAudioMuted
                ? 'bg-red-500 text-white shadow-lg shadow-red-500/40'
                : 'bg-white/15 hover:bg-white/25 text-white backdrop-blur-md border border-white/15'
            }`}
            title={isAudioMuted ? 'Включить микрофон' : 'Выключить микрофон'}
          >
            {isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <button
            type="button"
            onClick={() => toggleMuteVideo()}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              isVideoMuted
                ? 'bg-red-500 text-white shadow-lg shadow-red-500/40'
                : 'bg-white/15 hover:bg-white/25 text-white backdrop-blur-md border border-white/15'
            }`}
            title={isVideoMuted ? 'Включить камеру' : 'Выключить камеру'}
          >
            {isVideoMuted ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>

          <button
            type="button"
            onClick={() => switchCamera()}
            className="w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white backdrop-blur-md border border-white/15 flex items-center justify-center transition-all cursor-pointer"
            title="Переключить камеру (фронтальная / основная)"
          >
            <RefreshCw className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={toggleSpeakerphone}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              isSpeakerOn
                ? 'bg-[#6351FF] text-white shadow-lg shadow-[#6351FF]/40'
                : 'bg-white/15 hover:bg-white/25 text-white backdrop-blur-md border border-white/15'
            }`}
            title={isSpeakerOn ? 'Громкая связь включена' : 'Включить громкую связь'}
          >
            {isSpeakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          <button
            type="button"
            onClick={() => toggleScreenShare()}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              isScreenSharing
                ? 'bg-[#6351FF] text-white shadow-lg shadow-[#6351FF]/40'
                : 'bg-white/15 hover:bg-white/25 text-white backdrop-blur-md border border-white/15'
            }`}
            title="Демонстрация экрана"
          >
            <Monitor className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={declineOrEndCall}
            className="w-12 h-12 rounded-full bg-[#EF4444] hover:bg-[#DC2626] text-white shadow-[0_0_24px_rgba(239,68,68,0.65)] flex items-center justify-center transition-all cursor-pointer"
            title="Завершить звонок"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};


