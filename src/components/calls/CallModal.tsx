import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { ScreenShareOptions } from '../../types';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  PhoneIncoming,
  ChevronLeft,
  X,
  RefreshCw,
  Volume2,
  VolumeX,
  Users,
  Maximize2,
  Minimize2,
  LayoutGrid,
  PictureInPicture2,
  Camera,
  Sparkles,
  AppWindow,
  Globe,
  Check,
  ArrowLeftRight,
} from 'lucide-react';

export const CallModal: React.FC = () => {
  const {
    activeCall,
    incomingCall,
    localStream,
    localCameraStream,
    localScreenStream,
    remoteStream,
    isAudioMuted,
    isVideoMuted,
    isScreenSharing,
    isSpeakerOn,
    cameraFacingMode,
    availableCameras,
    selectedCameraId,
    groupCallParticipants,
    usersDirectory,
    acceptIncomingCall,
    declineOrEndCall,
    toggleMuteAudio,
    toggleMuteVideo,
    startScreenShare,
    stopScreenShare,
    switchCamera,
    refreshAvailableCameras,
    toggleSpeakerphone,
  } = useChat();
  const { profile } = useAuth();

  const [durationSeconds, setDurationSeconds] = useState(0);
  const [layoutMode, setLayoutMode] = useState<'pip' | 'grid'>('pip');
  const [isSwappedStage, setIsSwappedStage] = useState(false);
  const [fitContain, setFitContain] = useState(false);
  const [showScreenShareModal, setShowScreenShareModal] = useState(false);
  const [showCameraMenu, setShowCameraMenu] = useState(false);
  const [screenOptions, setScreenOptions] = useState<ScreenShareOptions>({
    surface: 'monitor',
    resolution: '1080p',
    fps: 30,
    includeSystemAudio: true,
  });

  const mainVideoRef = useRef<HTMLVideoElement | null>(null);
  const pipVideoRef = useRef<HTMLVideoElement | null>(null);
  const gridRemoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const gridLocalVideoRef = useRef<HTMLVideoElement | null>(null);
  const miniCamPreviewRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const isCaller = Boolean(activeCall && profile && activeCall.callerId === profile.uid);

  // Determine whether remote participant currently has active camera or screen share
  const remoteScreenSharing = Boolean(
    activeCall &&
      (isCaller
        ? activeCall.calleeScreenSharing
        : activeCall.callerScreenSharing ?? activeCall.isScreenSharing)
  );

  const remoteVideoFlag = Boolean(
    activeCall &&
      (isCaller
        ? activeCall.calleeVideoEnabled || activeCall.calleeScreenSharing
        : (activeCall.callerVideoEnabled ?? activeCall.type === 'video') ||
          activeCall.callerScreenSharing ||
          activeCall.isScreenSharing)
  );

  const remoteAudioMuted = Boolean(
    activeCall &&
      (isCaller ? activeCall.calleeAudioMuted : activeCall.callerAudioMuted)
  );

  const liveRemoteVideoTracks =
    remoteStream?.getVideoTracks().filter(t => t.readyState === 'live' && !t.muted) || [];

  const hasRemoteVideo = Boolean(
    remoteStream &&
      remoteStream.getVideoTracks().length > 0 &&
      (remoteVideoFlag || remoteScreenSharing || liveRemoteVideoTracks.length > 0)
  );

  const activeLocalVisualStream = isScreenSharing
    ? localScreenStream || localStream
    : localCameraStream || localStream;

  const hasLocalVideo = Boolean(
    activeLocalVisualStream &&
      (!isVideoMuted || isScreenSharing) &&
      activeLocalVisualStream.getVideoTracks().some(t => t.readyState === 'live')
  );

  const hasSimultaneousCamDuringScreenShare = Boolean(
    isScreenSharing &&
      !isVideoMuted &&
      localCameraStream &&
      localCameraStream.getVideoTracks().some(t => t.readyState === 'live')
  );

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

  // Automatically switch to fit-contain when anyone shares screen so text/UI is never cropped
  useEffect(() => {
    if (isScreenSharing || remoteScreenSharing) {
      setFitContain(true);
    } else {
      setFitContain(false);
    }
  }, [isScreenSharing, remoteScreenSharing]);

  // Bind strictly VIDEO-ONLY streams to video elements across PIP and Grid modes so <video> never leaks audio
  useEffect(() => {
    const toVideoOnlyStream = (s: MediaStream | null): MediaStream | null => {
      if (!s) return null;
      const vTracks = s.getVideoTracks().filter(t => t.readyState === 'live');
      if (vTracks.length === 0) return null;
      return new MediaStream(vTracks);
    };

    const primaryVideoStream = toVideoOnlyStream(
      isSwappedStage ? activeLocalVisualStream : remoteStream
    );
    const secondaryVideoStream = toVideoOnlyStream(
      isSwappedStage ? remoteStream : activeLocalVisualStream
    );
    const remoteVideoOnly = toVideoOnlyStream(remoteStream);
    const localVideoOnly = toVideoOnlyStream(activeLocalVisualStream);
    const camPreviewVideoOnly = toVideoOnlyStream(localCameraStream);

    const bindSilentVideo = (el: HTMLVideoElement | null, targetStream: MediaStream | null) => {
      if (!el) return;
      el.muted = true;
      el.volume = 0;
      const currentTracks = (el.srcObject as MediaStream | null)?.getVideoTracks() || [];
      const nextTracks = targetStream?.getVideoTracks() || [];
      const sameTrack =
        currentTracks.length === nextTracks.length &&
        currentTracks.every((t, i) => t.id === nextTracks[i]?.id);

      if (!sameTrack || (el.srcObject === null && targetStream !== null) || (el.srcObject !== null && targetStream === null)) {
        el.srcObject = targetStream;
      }
      if (targetStream) {
        el.play().catch(() => {});
      }
    };

    bindSilentVideo(mainVideoRef.current, primaryVideoStream);
    bindSilentVideo(pipVideoRef.current, secondaryVideoStream);
    bindSilentVideo(gridRemoteVideoRef.current, remoteVideoOnly);
    bindSilentVideo(gridLocalVideoRef.current, localVideoOnly);
    if (hasSimultaneousCamDuringScreenShare) {
      bindSilentVideo(miniCamPreviewRef.current, camPreviewVideoOnly);
    }
  }, [
    remoteStream,
    activeLocalVisualStream,
    localCameraStream,
    hasRemoteVideo,
    hasLocalVideo,
    hasSimultaneousCamDuringScreenShare,
    isSwappedStage,
    layoutMode,
    activeCall?.status,
    activeCall?.updatedAt,
  ]);

  // Attach remote audio tracks to dedicated audio element and enforce 100% silence when mic or speaker is off
  useEffect(() => {
    const audioEl = remoteAudioRef.current;
    if (!audioEl) return;

    const shouldSilenceRemote = !isSpeakerOn || remoteAudioMuted;

    if (!remoteStream || shouldSilenceRemote) {
      audioEl.muted = true;
      audioEl.volume = 0;
      audioEl.pause();
      return;
    }

    const liveAudioTracks = remoteStream
      .getAudioTracks()
      .filter(t => t.readyState === 'live' && t.enabled);

    if (liveAudioTracks.length === 0) {
      audioEl.muted = true;
      audioEl.volume = 0;
      return;
    }

    const currentAudioTracks = (audioEl.srcObject as MediaStream | null)?.getAudioTracks() || [];
    const sameAudio =
      currentAudioTracks.length === liveAudioTracks.length &&
      currentAudioTracks.every((t, i) => t.id === liveAudioTracks[i]?.id);

    if (!sameAudio) {
      audioEl.srcObject = new MediaStream(liveAudioTracks);
    }

    audioEl.muted = false;
    audioEl.volume = 1.0;
    audioEl.play().catch(() => {});
  }, [remoteStream, activeCall, isSpeakerOn, remoteAudioMuted]);

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
  const peerUid = isCaller ? activeCall.calleeId : activeCall.callerId;
  const peerUser = usersDirectory.find(u => u.uid === peerUid);
  const displayPeerName =
    groupCallParticipants.length > 1
      ? activeCall.callerName
      : peerUser?.displayName || activeCall.callerName || 'Собеседник';
  const displayPeerAvatar =
    groupCallParticipants.length > 1
      ? activeCall.callerAvatar
      : peerUser?.avatarUrl || activeCall.callerAvatar;

  const isGroupCall = groupCallParticipants.length > 1;

  // Stage & PIP assignment based on whether user swapped them
  const mainStageHasVideo = isSwappedStage ? hasLocalVideo : hasRemoteVideo;
  const pipHasVideo = isSwappedStage ? hasRemoteVideo : hasLocalVideo;
  const mainStageIsLocal = isSwappedStage;
  const pipIsLocal = !isSwappedStage;

  const mainStageMirror =
    mainStageIsLocal && !isScreenSharing && cameraFacingMode === 'user';
  const pipMirror =
    pipIsLocal && !isScreenSharing && cameraFacingMode === 'user';

  const handleStartScreenShareConfirm = async () => {
    setShowScreenShareModal(false);
    await startScreenShare(screenOptions);
  };

  return (
    <div
      onDoubleClick={() => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen?.().catch(() => {});
        } else {
          document.exitFullscreen?.().catch(() => {});
        }
      }}
      className="fixed inset-0 w-screen h-[100dvh] bg-[#070814] z-50 text-white select-none overflow-hidden"
    >
      {/* Dedicated hidden audio element so WebRTC voice audio always plays in real time */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      <div className="relative w-full h-full overflow-hidden bg-gradient-to-b from-[#1A133B] via-[#11132E] to-[#090B1A] flex flex-col justify-between">
        {/* Main Stage / Grid Backdrop */}
        <div className="absolute inset-0">
          {layoutMode === 'grid' && !isGroupCall ? (
            /* Discord / Zoom 50-50 Split Grid View */
            <div className="w-full h-full grid grid-cols-1 md:grid-cols-2 gap-3 p-3 sm:p-5 pt-20 pb-28 bg-[#090B1A]">
              {/* Remote Participant Tile */}
              <div className="relative rounded-2xl overflow-hidden bg-[#131633] border border-white/15 flex items-center justify-center shadow-2xl">
                {hasRemoteVideo ? (
                  <video
                    ref={gridRemoteVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full ${
                      remoteScreenSharing || fitContain ? 'object-contain bg-black' : 'object-cover'
                    }`}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 text-center">
                    <img
                      src={displayPeerAvatar}
                      alt={displayPeerName}
                      className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover ring-4 ring-[#8B5CF6]/50 shadow-xl mb-3"
                    />
                    <span className="text-sm font-bold text-white">{displayPeerName}</span>
                    <span className="text-xs text-[#9AA3D4] mt-1">
                      {activeCall.status === 'ringing' ? 'Вызов...' : 'Камера выключена'}
                    </span>
                  </div>
                )}
                <div className="absolute bottom-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/65 backdrop-blur-md border border-white/10 text-xs font-semibold">
                  <span>{displayPeerName}</span>
                  {remoteScreenSharing && (
                    <span className="px-2 py-0.5 rounded-md bg-[#6351FF] text-[10px] font-bold">
                      Экран
                    </span>
                  )}
                  {remoteAudioMuted && (
                    <span className="inline-flex items-center gap-1 text-rose-400 text-[11px]">
                      <MicOff className="w-3.5 h-3.5" />
                      <span>Без звука</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Local Participant Tile */}
              <div className="relative rounded-2xl overflow-hidden bg-[#131633] border border-[#6351FF]/40 flex items-center justify-center shadow-2xl">
                {hasLocalVideo ? (
                  <video
                    ref={gridLocalVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full ${
                      isScreenSharing || fitContain ? 'object-contain bg-black' : 'object-cover'
                    } ${!isScreenSharing && cameraFacingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 text-center">
                    <img
                      src={profile?.avatarUrl || activeCall.callerAvatar}
                      alt="Вы"
                      className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover ring-4 ring-[#6351FF]/50 shadow-xl mb-3"
                    />
                    <span className="text-sm font-bold text-white">
                      {profile?.displayName || 'Вы'} (Вы)
                    </span>
                    <span className="text-xs text-[#9AA3D4] mt-1">Камера выключена</span>
                  </div>
                )}
                <div className="absolute bottom-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/65 backdrop-blur-md border border-white/10 text-xs font-semibold">
                  <span>Вы ({cameraFacingMode === 'user' ? 'Фронтальная' : 'Основная'})</span>
                  {isScreenSharing && (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-[10px] font-bold">
                      Демонстрация экрана
                    </span>
                  )}
                  {isAudioMuted && <MicOff className="w-3.5 h-3.5 text-rose-400" />}
                </div>
              </div>
            </div>
          ) : mainStageHasVideo ? (
            <video
              ref={mainVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full ${
                (mainStageIsLocal ? isScreenSharing : remoteScreenSharing) || fitContain
                  ? 'object-contain bg-[#05060F]'
                  : 'object-cover'
              } ${mainStageMirror ? 'scale-x-[-1]' : ''}`}
            />
          ) : isGroupCall ? (
            <div className="w-full h-full flex flex-col justify-center bg-[radial-gradient(circle_at_50%_30%,rgba(124,58,237,0.35),rgba(10,12,28,0.95))] p-4 sm:p-8 pt-20 pb-28 overflow-y-auto">
              <div className="flex items-center justify-center gap-1.5 text-xs sm:text-sm font-semibold text-indigo-300 mb-4">
                <Users className="w-4 h-4" />
                <span>Групповой звонок ({groupCallParticipants.length + 1} уч.)</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 max-w-6xl mx-auto w-full">
                {groupCallParticipants.map(part => (
                  <div
                    key={part.uid}
                    className="rounded-2xl bg-[#141736]/90 border border-[#2E356B] p-4 sm:p-6 flex flex-col items-center justify-center text-center"
                  >
                    <img
                      src={part.avatarUrl}
                      alt={part.displayName}
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover ring-2 ring-[#7C3AED] mb-2.5"
                    />
                    <span className="text-xs sm:text-sm font-bold text-white truncate max-w-full">
                      {part.displayName}
                    </span>
                    <span
                      className={`text-[10px] sm:text-xs font-mono mt-0.5 ${
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
              <div className="relative mb-5">
                <img
                  src={mainStageIsLocal ? profile?.avatarUrl || displayPeerAvatar : displayPeerAvatar}
                  alt={mainStageIsLocal ? 'Вы' : displayPeerName}
                  className="w-32 h-32 sm:w-40 sm:h-40 rounded-full object-cover ring-4 ring-[#8B5CF6]/60 shadow-[0_0_40px_rgba(139,92,246,0.6)]"
                />
              </div>
              <p className="text-xs sm:text-sm text-[#B4BCE6] max-w-md">
                {activeCall.status === 'ringing'
                  ? 'Вызов собеседника в реальном времени (WebRTC)...'
                  : remoteAudioMuted
                  ? 'Собеседник выключил микрофон / камеру — звук не передаётся'
                  : isAudioMuted
                  ? 'Ваш микрофон выключен — собеседник вас не слышит'
                  : !isSpeakerOn
                  ? 'Динамик выключен — звук собеседника заглушён'
                  : activeCall.isScreenSharing
                  ? 'Демонстрация экрана активна'
                  : 'Соединение WebRTC установлено — вы на связи'}
              </p>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/75 pointer-events-none" />
        </div>

        {/* Top Bar: < | Peer Name + Status/Timer + Mode Controls | X */}
        <div className="relative z-10 flex items-center justify-between px-4 sm:px-8 pt-4 sm:pt-6 pb-3 gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={declineOrEndCall}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center text-white transition-colors cursor-pointer"
              title="Свернуть / Выйти"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => setLayoutMode(prev => (prev === 'pip' ? 'grid' : 'pip'))}
              className="px-3 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center gap-1.5 text-xs font-semibold text-white transition-colors cursor-pointer"
              title="Переключить вид (Картинка-в-картинке / Сетка как в Discord)"
            >
              {layoutMode === 'pip' ? (
                <>
                  <LayoutGrid className="w-4 h-4 text-[#A78BFA]" />
                  <span className="hidden sm:inline">Сетка</span>
                </>
              ) : (
                <>
                  <PictureInPicture2 className="w-4 h-4 text-[#A78BFA]" />
                  <span className="hidden sm:inline">Докладчик</span>
                </>
              )}
            </button>

            {(hasRemoteVideo || hasLocalVideo) && (
              <button
                type="button"
                onClick={() => setFitContain(prev => !prev)}
                className="px-3 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center gap-1.5 text-xs font-semibold text-white transition-colors cursor-pointer"
                title={fitContain ? 'Заполнить экран' : 'Вписать видео целиком'}
              >
                {fitContain ? (
                  <>
                    <Maximize2 className="w-4 h-4 text-emerald-400" />
                    <span className="hidden md:inline">Весь кадр</span>
                  </>
                ) : (
                  <>
                    <Minimize2 className="w-4 h-4 text-indigo-300" />
                    <span className="hidden md:inline">Заполнить</span>
                  </>
                )}
              </button>
            )}
          </div>

          <div className="text-center min-w-0 px-2">
            <div className="flex items-center justify-center gap-2">
              <h3 className="text-base sm:text-lg font-extrabold text-white truncate">
                {displayPeerName}
              </h3>
              {(isScreenSharing || remoteScreenSharing) && (
                <span className="px-2 py-0.5 rounded-md bg-[#6351FF] text-[10px] font-bold uppercase tracking-wider">
                  Экран LIVE
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-[#D5DAFF] font-mono mt-0.5">
              {activeCall.status === 'connected'
                ? formatDuration(durationSeconds)
                : 'Вызов...'}
            </p>
          </div>

          <button
            type="button"
            onClick={declineOrEndCall}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center text-white transition-colors cursor-pointer"
            title="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Active Screen Share Floating Banner (Zoom / Discord style) */}
        {isScreenSharing && (
          <div className="relative z-20 mx-auto px-4 py-2 rounded-2xl bg-emerald-950/90 border border-emerald-500/40 backdrop-blur-xl shadow-xl flex items-center gap-3 text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-semibold text-emerald-100">
              Вы демонстрируете свой экран собеседнику
            </span>
            <button
              type="button"
              onClick={() => setShowScreenShareModal(true)}
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors cursor-pointer"
            >
              Сменить окно
            </button>
            <button
              type="button"
              onClick={() => stopScreenShare()}
              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold transition-colors cursor-pointer"
            >
              Остановить показ
            </button>
          </div>
        )}

        {/* Picture-in-Picture (PIP) Self-View / Secondary View in Top-Right */}
        {layoutMode === 'pip' && (
          <div className="relative z-10 flex-1 px-4 sm:px-8 pointer-events-none flex flex-col items-end gap-3">
            <div
              onClick={() => setIsSwappedStage(prev => !prev)}
              title="Нажмите, чтобы поменять местами с главным экраном"
              className="w-32 h-44 sm:w-48 sm:h-64 md:w-64 md:h-44 rounded-2xl overflow-hidden bg-[#151836] border-2 border-white/25 hover:border-[#8B5CF6] shadow-2xl relative pointer-events-auto cursor-pointer group transition-all"
            >
              {pipHasVideo ? (
                <video
                  ref={pipVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className={`w-full h-full ${
                    (pipIsLocal ? isScreenSharing : remoteScreenSharing)
                      ? 'object-contain bg-black'
                      : 'object-cover'
                  } ${pipMirror ? 'scale-x-[-1]' : ''}`}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-[#181C3E] text-center p-2">
                  {pipIsLocal ? (
                    <>
                      {isAudioMuted ? (
                        <MicOff className="w-6 h-6 text-rose-400 mb-1" />
                      ) : (
                        <Mic className="w-6 h-6 text-[#A78BFA] mb-1" />
                      )}
                      <span className="text-[11px] sm:text-xs font-bold text-white">Вы</span>
                      <span className="text-[9px] sm:text-[11px] text-[#8E96C2]">
                        {isScreenSharing
                          ? 'Экран'
                          : isVideoMuted
                          ? 'Камера выкл.'
                          : isAudioMuted
                          ? 'Микрофон выкл.'
                          : 'На связи'}
                      </span>
                    </>
                  ) : (
                    <>
                      <img
                        src={displayPeerAvatar}
                        alt={displayPeerName}
                        className="w-12 h-12 rounded-full object-cover ring-2 ring-[#7C3AED] mb-1.5"
                      />
                      <span className="text-[11px] sm:text-xs font-bold text-white truncate max-w-full px-2">
                        {displayPeerName}
                      </span>
                      <span className="text-[9px] sm:text-[11px] text-[#8E96C2]">
                        На связи
                      </span>
                    </>
                  )}
                </div>
              )}

              {/* Bottom badge inside PIP */}
              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between px-2 py-1 rounded-lg bg-black/65 backdrop-blur-md text-[10px] font-semibold text-white">
                <span className="truncate">
                  {pipIsLocal
                    ? isScreenSharing
                      ? 'Ваш экран'
                      : `Вы (${cameraFacingMode === 'user' ? 'Фронт.' : 'Осн.'})`
                    : displayPeerName}
                </span>
                <ArrowLeftRight className="w-3 h-3 text-indigo-300 opacity-80 group-hover:opacity-100 shrink-0" />
              </div>
            </div>

            {/* Extra mini webcam preview when simultaneously screen-sharing + camera is ON */}
            {hasSimultaneousCamDuringScreenShare && (
              <div className="w-24 h-32 sm:w-36 sm:h-24 rounded-xl overflow-hidden bg-[#151836] border border-[#6351FF] shadow-xl relative pointer-events-auto">
                <video
                  ref={miniCamPreviewRef}
                  autoPlay
                  muted
                  playsInline
                  className={`w-full h-full object-cover ${
                    cameraFacingMode === 'user' ? 'scale-x-[-1]' : ''
                  }`}
                />
                <div className="absolute bottom-1 left-1.5 px-1.5 py-0.5 rounded bg-black/65 text-[9px] font-semibold">
                  Камера
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bottom Call Control Buttons:
            1. Микрофон (Вкл/Выкл)
            2. Камера (Вкл/Выкл)
            3. Сменить камеру (Фронтальная / Основная + выбор устройства)
            4. Громкая связь (Динамик)
            5. Демонстрация экрана (WebRTC выбор источника)
            6. Завершить вызов */}
        <div className="relative z-20 flex items-center justify-center gap-3 sm:gap-4 px-4 pb-6 sm:pb-8 pt-4 flex-wrap">
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
                : 'bg-[#6351FF] text-white shadow-lg shadow-[#6351FF]/40'
            }`}
            title={isVideoMuted ? 'Включить камеру' : 'Выключить камеру'}
          >
            {isVideoMuted ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>

          {/* Switch Camera Button (Front / Back + Device Picker on context/long action) */}
          <div className="relative">
            <button
              type="button"
              onClick={async () => {
                await switchCamera();
                await refreshAvailableCameras();
              }}
              onContextMenu={e => {
                e.preventDefault();
                refreshAvailableCameras();
                setShowCameraMenu(prev => !prev);
              }}
              className="w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white backdrop-blur-md border border-white/15 flex items-center justify-center transition-all cursor-pointer"
              title={`Переключить камеру (сейчас: ${
                cameraFacingMode === 'user' ? 'Фронтальная' : 'Основная'
              })`}
            >
              <RefreshCw className="w-5 h-5" />
            </button>

            {availableCameras.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  refreshAvailableCameras();
                  setShowCameraMenu(prev => !prev);
                }}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#6351FF] text-white text-[10px] font-bold flex items-center justify-center border border-white/30 shadow cursor-pointer"
                title="Выбрать камеру из списка"
              >
                {availableCameras.length}
              </button>
            )}

            {showCameraMenu && (
              <div className="absolute bottom-14 left-1/2 -translate-x-1/2 w-64 rounded-2xl bg-[#11142D]/95 backdrop-blur-xl border border-white/15 p-3 shadow-2xl text-left z-30">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-[#A78BFA]" />
                    <span>Выбор камеры</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCameraMenu(false)}
                    className="text-white/60 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={async () => {
                      if (cameraFacingMode !== 'user') await switchCamera();
                      setShowCameraMenu(false);
                    }}
                    className={`w-full px-2.5 py-2 rounded-xl text-xs flex items-center justify-between cursor-pointer ${
                      cameraFacingMode === 'user'
                        ? 'bg-[#6351FF]/30 text-white font-semibold'
                        : 'hover:bg-white/10 text-white/80'
                    }`}
                  >
                    <span>Фронтальная камера</span>
                    {cameraFacingMode === 'user' && <Check className="w-3.5 h-3.5 text-[#A78BFA]" />}
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      if (cameraFacingMode !== 'environment') await switchCamera();
                      setShowCameraMenu(false);
                    }}
                    className={`w-full px-2.5 py-2 rounded-xl text-xs flex items-center justify-between cursor-pointer ${
                      cameraFacingMode === 'environment'
                        ? 'bg-[#6351FF]/30 text-white font-semibold'
                        : 'hover:bg-white/10 text-white/80'
                    }`}
                  >
                    <span>Основная (задняя) камера</span>
                    {cameraFacingMode === 'environment' && (
                      <Check className="w-3.5 h-3.5 text-[#A78BFA]" />
                    )}
                  </button>

                  {availableCameras.map((cam, idx) => (
                    <button
                      key={cam.deviceId || idx}
                      type="button"
                      onClick={async () => {
                        await switchCamera(cam.deviceId);
                        setShowCameraMenu(false);
                      }}
                      className={`w-full px-2.5 py-2 rounded-xl text-xs flex items-center justify-between cursor-pointer ${
                        selectedCameraId === cam.deviceId
                          ? 'bg-[#6351FF]/30 text-white font-semibold'
                          : 'hover:bg-white/10 text-white/80'
                      }`}
                    >
                      <span className="truncate pr-2">
                        {cam.label || `Камера #${idx + 1}`}
                      </span>
                      {selectedCameraId === cam.deviceId && (
                        <Check className="w-3.5 h-3.5 text-[#A78BFA] shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

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
            onClick={() => {
              if (isScreenSharing) {
                stopScreenShare();
              } else {
                setShowScreenShareModal(true);
              }
            }}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              isScreenSharing
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/40'
                : 'bg-white/15 hover:bg-white/25 text-white backdrop-blur-md border border-white/15'
            }`}
            title={
              isScreenSharing
                ? 'Остановить демонстрацию экрана'
                : 'Демонстрация экрана (выбор экрана, окна или вкладки)'
            }
          >
            {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
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

        {/* Zoom / Discord Screen Share Source & Quality Selector Modal */}
        {showScreenShareModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-3xl bg-[#11142D] border border-white/15 p-6 shadow-2xl text-white space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#6351FF]/20 border border-[#6351FF]/40 flex items-center justify-center text-[#A78BFA]">
                    <Monitor className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold">Демонстрация экрана</h4>
                    <p className="text-xs text-[#9AA3D4]">
                      Выберите тип источника и качество потока WebRTC
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowScreenShareModal(false)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Source Type Selection */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#B4BCE6]">
                  Что вы хотите показать?
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      setScreenOptions(prev => ({ ...prev, surface: 'monitor' }))
                    }
                    className={`p-3 rounded-2xl border text-center flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      screenOptions.surface === 'monitor'
                        ? 'bg-[#6351FF]/25 border-[#6351FF] text-white'
                        : 'bg-white/5 border-white/10 text-[#B4BCE6] hover:bg-white/10'
                    }`}
                  >
                    <Monitor className="w-5 h-5 text-[#A78BFA]" />
                    <span className="text-xs font-semibold">Весь экран</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setScreenOptions(prev => ({ ...prev, surface: 'window' }))
                    }
                    className={`p-3 rounded-2xl border text-center flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      screenOptions.surface === 'window'
                        ? 'bg-[#6351FF]/25 border-[#6351FF] text-white'
                        : 'bg-white/5 border-white/10 text-[#B4BCE6] hover:bg-white/10'
                    }`}
                  >
                    <AppWindow className="w-5 h-5 text-[#A78BFA]" />
                    <span className="text-xs font-semibold">Окно</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setScreenOptions(prev => ({ ...prev, surface: 'browser' }))
                    }
                    className={`p-3 rounded-2xl border text-center flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      screenOptions.surface === 'browser'
                        ? 'bg-[#6351FF]/25 border-[#6351FF] text-white'
                        : 'bg-white/5 border-white/10 text-[#B4BCE6] hover:bg-white/10'
                    }`}
                  >
                    <Globe className="w-5 h-5 text-[#A78BFA]" />
                    <span className="text-xs font-semibold">Вкладка</span>
                  </button>
                </div>
              </div>

              {/* Resolution & Frame Rate */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#B4BCE6]">Разрешение</label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-white/5 border border-white/10">
                    {(['1080p', '720p'] as const).map(res => (
                      <button
                        key={res}
                        type="button"
                        onClick={() =>
                          setScreenOptions(prev => ({ ...prev, resolution: res }))
                        }
                        className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          screenOptions.resolution === res
                            ? 'bg-[#6351FF] text-white'
                            : 'text-[#B4BCE6] hover:text-white'
                        }`}
                      >
                        {res}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#B4BCE6]">Частота кадров</label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-white/5 border border-white/10">
                    {([30, 60] as const).map(fpsVal => (
                      <button
                        key={fpsVal}
                        type="button"
                        onClick={() =>
                          setScreenOptions(prev => ({ ...prev, fps: fpsVal }))
                        }
                        className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          screenOptions.fps === fpsVal
                            ? 'bg-[#6351FF] text-white'
                            : 'text-[#B4BCE6] hover:text-white'
                        }`}
                      >
                        {fpsVal} FPS
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* System Audio Toggle */}
              <label className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/10 cursor-pointer">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-[#A78BFA]" />
                  <div>
                    <div className="text-xs font-bold text-white">Передавать звук компьютера</div>
                    <div className="text-[11px] text-[#9AA3D4]">
                      Собеседник услышит звук из выбранной вкладки или экрана
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={screenOptions.includeSystemAudio}
                  onChange={e =>
                    setScreenOptions(prev => ({
                      ...prev,
                      includeSystemAudio: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 accent-[#6351FF]"
                />
              </label>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowScreenShareModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleStartScreenShareConfirm}
                  className="flex-1 py-2.5 rounded-xl bg-[#6351FF] hover:bg-[#523EE8] text-xs font-bold text-white shadow-lg shadow-[#6351FF]/40 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Monitor className="w-4 h-4" />
                  <span>Выбрать экран</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
